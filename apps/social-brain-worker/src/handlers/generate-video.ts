import {
  ContentPlanSchema,
  V1_PLATFORMS,
  type ContentItem,
  type ContentStatus,
  type VideoGenerator,
  type VideoResult,
} from '@lumenva/core'
import type { BackgroundJob } from '@lumenva/db/jobs'
import type {
  MediaAsset,
  MediaFailure,
  MediaRepository,
  ReadyMediaPatch,
} from '@lumenva/db/media'
import type {
  ImportMediaInput,
  ImportedMedia,
  MediaStorage,
} from '@lumenva/db/storage/media'

export type GenerateVideoContentRepository = {
  getContentItem(id: string): Promise<ContentItem | null>
  setStatus(id: string, status: ContentStatus): Promise<void>
}

export type GenerateVideoVariantRepository = {
  listVariants(contentItemId: string): Promise<Array<{ platform: string }>>
}

export type GenerateVideoMediaRepository = Pick<
  MediaRepository,
  'findForContent' | 'createGenerating' | 'markReady' | 'markFailed'
>

export type GenerateVideoStorage = Pick<MediaStorage, 'importFromUrl'>

export type GenerateVideoDependencies = {
  contentRepository: GenerateVideoContentRepository
  variantRepository: GenerateVideoVariantRepository
  mediaRepository: GenerateVideoMediaRepository
  storage: GenerateVideoStorage
  generator: VideoGenerator
  sleep?: (ms: number) => Promise<void>
  createId?: () => string
  pollIntervalMs?: number
  maxPolls?: number
}

export class GenerateVideoError extends Error {
  readonly code: string
  readonly retryable: boolean

  constructor(code: string, message: string, retryable: boolean) {
    super(message)
    this.name = 'GenerateVideoError'
    this.code = code
    this.retryable = retryable
  }
}

export function createGenerateVideoHandler(deps: GenerateVideoDependencies) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const createId = deps.createId ?? (() => crypto.randomUUID())
  const pollIntervalMs = deps.pollIntervalMs ?? 5_000
  const maxPolls = Math.max(1, deps.maxPolls ?? 120)

  return async function generateVideo(job: BackgroundJob): Promise<void> {
    const contentItemId = readContentItemId(job)
    const content = await deps.contentRepository.getContentItem(contentItemId)

    if (!content) {
      throw new GenerateVideoError('content_not_found', 'Content item was not found', false)
    }
    if (content.workspaceId !== job.workspaceId) {
      throw new GenerateVideoError(
        'content_workspace_mismatch',
        'Content item does not belong to the job workspace',
        false,
      )
    }

    const plan = ContentPlanSchema.safeParse({
      objective: content.objective,
      topic: content.topic,
      hook: content.hook,
      script: content.script,
      videoBrief: content.videoBrief,
    })
    if (!plan.success) {
      throw new GenerateVideoError(
        'invalid_content_plan',
        'Content plan is incomplete for video generation',
        false,
      )
    }

    if (content.status === 'DRAFT') {
      await deps.contentRepository.setStatus(content.id, 'GENERATING')
    } else if (content.status !== 'GENERATING' && content.status !== 'READY_FOR_REVIEW') {
      throw new GenerateVideoError(
        'content_not_generatable',
        `Content in ${content.status} cannot generate video`,
        false,
      )
    }

    let media = await deps.mediaRepository.findForContent(content.id, deps.generator.provider)

    if (media?.status === 'ready' && media.storagePath) {
      await moveToReviewWhenComplete(content.id, deps)
      return
    }

    try {
      if (!media) {
        const submitted = await deps.generator.submit({
          contentItemId: content.id,
          subject: plan.data.topic,
          script: plan.data.script,
          videoBrief: plan.data.videoBrief,
          idempotencyKey: `video:${content.id}`,
        })

        try {
          media = await deps.mediaRepository.createGenerating({
            id: createId(),
            workspaceId: content.workspaceId,
            contentItemId: content.id,
            provider: deps.generator.provider,
            providerAssetId: submitted.providerJobId,
          })
        } catch {
          throw new GenerateVideoError(
            'provider_job_persistence_failed',
            'Video provider accepted the task but its remote id could not be persisted; do not retry blindly',
            false,
          )
        }
      }

      if (!media.providerAssetId) {
        throw new GenerateVideoError(
          'missing_provider_job_id',
          'Generating media is missing its provider job id',
          false,
        )
      }

      const result = await waitForVideoResult(
        deps.generator,
        media.providerAssetId,
        maxPolls,
        pollIntervalMs,
        sleep,
      )
      const downloadUrl = requireDownloadUrl(result)
      const imported = await deps.storage.importFromUrl({
        workspaceId: content.workspaceId,
        contentItemId: content.id,
        assetId: media.id,
        downloadUrl,
      })

      await deps.mediaRepository.markReady(media.id, readyPatch(imported))
      await moveToReviewWhenComplete(content.id, deps)
    } catch (error) {
      const failure = normalizeFailure(error)
      const exhausted = job.attemptCount >= job.maxAttempts
      const terminal = !failure.retryable || exhausted

      if (terminal) {
        if (media) {
          await deps.mediaRepository.markFailed(media.id, {
            code: failure.code,
            message: failure.message,
          })
        }
        await deps.contentRepository.setStatus(content.id, 'FAILED')
        throw new GenerateVideoError(failure.code, failure.message, false)
      }

      throw new GenerateVideoError(failure.code, failure.message, true)
    }
  }
}

async function waitForVideoResult(
  generator: VideoGenerator,
  providerJobId: string,
  maxPolls: number,
  pollIntervalMs: number,
  sleep: (ms: number) => Promise<void>,
): Promise<VideoResult> {
  for (let poll = 0; poll < maxPolls; poll += 1) {
    const result = await generator.fetchResult(providerJobId)

    if (result.state === 'succeeded') return result
    if (result.state === 'failed') {
      const error = result.error ?? {
        code: 'video_generation_failed',
        message: 'Video provider reported a failed task',
        retryable: false,
      }
      throw new GenerateVideoError(error.code, error.message, error.retryable)
    }

    if (poll + 1 < maxPolls) await sleep(pollIntervalMs)
  }

  throw new GenerateVideoError(
    'video_still_running',
    'Video provider task is still running',
    true,
  )
}

function requireDownloadUrl(result: VideoResult): string {
  if (!result.downloadUrl) {
    throw new GenerateVideoError(
      'missing_video_download_url',
      'Successful video task did not include a download URL',
      false,
    )
  }
  return result.downloadUrl
}

async function moveToReviewWhenComplete(
  contentItemId: string,
  deps: GenerateVideoDependencies,
): Promise<void> {
  const variants = await deps.variantRepository.listVariants(contentItemId)
  const platforms = new Set(variants.map((variant) => variant.platform))
  const complete =
    variants.length === V1_PLATFORMS.length &&
    platforms.size === V1_PLATFORMS.length &&
    V1_PLATFORMS.every((platform) => platforms.has(platform))

  if (complete) {
    await deps.contentRepository.setStatus(contentItemId, 'READY_FOR_REVIEW')
  }
}

function readyPatch(imported: ImportedMedia): ReadyMediaPatch {
  return {
    storageBucket: imported.bucket,
    storagePath: imported.path,
    mimeType: imported.mimeType,
    metadata: { sizeBytes: imported.sizeBytes },
  }
}

function readContentItemId(job: BackgroundJob): string {
  if (job.jobType !== 'video.generate') {
    throw new GenerateVideoError('wrong_job_type', 'Expected a video.generate job', false)
  }
  const value = job.payload.contentItemId
  if (typeof value !== 'string' || value.trim() === '') {
    throw new GenerateVideoError('invalid_job_payload', 'video.generate requires contentItemId', false)
  }
  return value
}

function normalizeFailure(error: unknown): GenerateVideoError {
  if (error instanceof GenerateVideoError) return error

  if (error && typeof error === 'object') {
    const shape = error as { code?: unknown; message?: unknown; retryable?: unknown }
    if (typeof shape.code === 'string') {
      return new GenerateVideoError(
        shape.code,
        typeof shape.message === 'string' ? shape.message : 'Video generation failed',
        shape.retryable === true,
      )
    }
  }

  return new GenerateVideoError(
    'video_generation_failed',
    error instanceof Error ? error.message : 'Video generation failed',
    true,
  )
}
