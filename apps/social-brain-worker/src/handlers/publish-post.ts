import type { BackgroundJob } from '@lumenva/db/jobs'

import type {
  ApprovedPublicationMedia,
  CurrentApprovalGuard,
  PublicationFinalizedHook,
  PublicationMediaSource,
  PublicationProvider,
  PublicationWorkerRepository,
} from './publication-types'
import { PublicationWorkerError } from './publication-types'

export type PublishPostDependencies = {
  repository: PublicationWorkerRepository
  mediaSource: PublicationMediaSource
  provider: PublicationProvider
  assertCurrentApproval: CurrentApprovalGuard
  enqueueReconciliation(workspaceId: string, publishJobId: string, runAfter?: string): Promise<void>
  onPublished?: PublicationFinalizedHook
  sleep?: (ms: number) => Promise<void>
  mediaPollIntervalMs?: number
  maxMediaPolls?: number
}

export function createPublishPostHandler(deps: PublishPostDependencies) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const mediaPollIntervalMs = deps.mediaPollIntervalMs ?? 2_000
  const maxMediaPolls = Math.max(1, deps.maxMediaPolls ?? 60)

  return async function publishPost(job: BackgroundJob): Promise<void> {
    const publishJobId = readPublishJobId(job, 'publish.execute')
    const context = await deps.repository.loadContext(publishJobId)
    if (!context) throw new PublicationWorkerError('publish_job_not_found', 'Publish job was not found', false)
    if (context.workspaceId !== job.workspaceId) {
      throw new PublicationWorkerError('publish_workspace_mismatch', 'Publish job does not belong to the background job workspace', false)
    }
    if (context.status === 'published') return
    if (['scheduled', 'publishing', 'unknown', 'reconcile_required'].includes(context.status)) {
      await deps.enqueueReconciliation(
        context.workspaceId,
        context.id,
        context.status === 'scheduled' ? reconciliationAfter(context.scheduledFor) : undefined,
      )
      return
    }
    if (context.status !== 'queued' && context.status !== 'retrying') {
      throw new PublicationWorkerError('publish_job_not_executable', `Publish job in ${context.status} cannot execute`, false)
    }

    const approval = await requireCurrentApproval(context.id, context.contentItemId, context.approvalId, deps)
    let providerMediaAssetIds: string[]
    try {
      const media = await deps.repository.loadApprovedMedia(approval.snapshot.mediaAssetIds)
      providerMediaAssetIds = await prepareMedia(media, deps, maxMediaPolls, mediaPollIntervalMs, sleep)
    } catch (error) {
      const failure = normalizeProviderFailure(error)
      await persistKnownFailure(context.id, failure, deps)
      throw failure
    }

    await deps.repository.markPublishing(context.id)
    let published = false
    try {
      const result = await deps.provider.schedulePost({
        providerAccountId: context.providerAccountId,
        caption: context.caption,
        title: context.title,
        providerMediaAssetIds,
        idempotencyKey: context.idempotencyKey,
        scheduledFor: context.scheduledFor,
      })
      if (result.state === 'unknown') {
        await deps.repository.markReconcileRequired(context.id, 'publication_unknown', 'BrightBean returned an unknown publication state')
        await deps.enqueueReconciliation(context.workspaceId, context.id)
        return
      }
      if (result.state === 'failed') {
        const message = result.errorMessage ?? 'BrightBean reported a failed publication'
        await deps.repository.markFailed(context.id, 'publication_failed', message)
        throw new PublicationWorkerError('publication_failed', message, false)
      }
      await deps.repository.markResult(context.id, result)
      published = result.state === 'published'
      if (result.state === 'queued' || result.state === 'scheduled' || result.state === 'publishing') {
        await deps.enqueueReconciliation(
          context.workspaceId,
          context.id,
          reconciliationAfter(result.scheduledFor ?? context.scheduledFor),
        )
      }
    } catch (error) {
      if (error instanceof PublicationWorkerError && error.code === 'publication_failed') throw error
      const failure = normalizeProviderFailure(error)
      if (failure.code === 'timeout' || failure.code === 'network_error') {
        await deps.repository.markReconcileRequired(context.id, failure.code, failure.message)
        await deps.enqueueReconciliation(context.workspaceId, context.id)
        return
      }
      await persistKnownFailure(context.id, failure, deps)
      throw failure
    }

    if (published) {
      await runPublishedHookBestEffort(deps.onPublished, {
        workspaceId: context.workspaceId,
        contentVariantId: context.contentVariantId,
        publishJobId: context.id,
      })
    }
  }
}

async function runPublishedHookBestEffort(
  hook: PublicationFinalizedHook | undefined,
  input: { workspaceId: string; contentVariantId: string; publishJobId: string },
): Promise<void> {
  if (!hook) return
  try {
    await hook(input)
  } catch (error) {
    console.error('Post-publication follow-up failed', error instanceof Error ? error.message : 'unknown error')
  }
}

async function requireCurrentApproval(publishJobId: string, contentItemId: string, approvalId: string, deps: PublishPostDependencies) {
  try {
    const approval = await deps.assertCurrentApproval(contentItemId)
    if (approval.id !== approvalId) {
      const error = new PublicationWorkerError('approval_stale', 'Publish job belongs to a stale approval', false)
      await deps.repository.markFailed(publishJobId, error.code, error.message)
      throw error
    }
    return approval
  } catch (error) {
    if (error instanceof PublicationWorkerError) throw error
    const normalized = new PublicationWorkerError(readErrorCode(error, 'approval_required'), 'Current exact approval is required before publication', false)
    await deps.repository.markFailed(publishJobId, normalized.code, normalized.message)
    throw normalized
  }
}

async function prepareMedia(
  media: ApprovedPublicationMedia[],
  deps: PublishPostDependencies,
  maxPolls: number,
  pollIntervalMs: number,
  sleep: (ms: number) => Promise<void>,
): Promise<string[]> {
  if (media.length === 0) throw new PublicationWorkerError('approved_media_missing', 'Approved publication has no canonical media', false)
  const ids: string[] = []
  for (const asset of media) {
    let providerMediaAssetId = asset.providerMediaAssetId
    let processingStatus = asset.providerMediaProcessingStatus ?? null
    if (!providerMediaAssetId) {
      const bytes = await deps.mediaSource.download(asset.storageBucket, asset.storagePath)
      if (bytes.byteLength === 0) throw new PublicationWorkerError('approved_media_empty', 'Approved media is empty', false)
      const uploaded = await deps.provider.uploadMedia({
        filename: asset.filename,
        mimeType: asset.mimeType,
        bytes,
        idempotencyKey: `media:${asset.id}`,
      })
      providerMediaAssetId = uploaded.providerMediaAssetId
      processingStatus = uploaded.processingStatus
      await deps.repository.savePreparedMedia(asset.id, providerMediaAssetId, processingStatus)
    }
    if (processingStatus !== 'completed') {
      let ready = false
      for (let poll = 0; poll < maxPolls; poll += 1) {
        const current = await deps.provider.getMediaStatus(providerMediaAssetId)
        processingStatus = current.processingStatus
        await deps.repository.savePreparedMedia(asset.id, providerMediaAssetId, processingStatus)
        if (processingStatus === 'completed') { ready = true; break }
        if (processingStatus === 'failed' || processingStatus === 'error') {
          throw new PublicationWorkerError('brightbean_media_processing_failed', 'BrightBean could not process approved media', false)
        }
        if (poll + 1 < maxPolls) await sleep(pollIntervalMs)
      }
      if (!ready) throw new PublicationWorkerError('brightbean_media_processing_pending', 'BrightBean media processing is still pending', true)
    }
    ids.push(providerMediaAssetId)
  }
  return ids
}

async function persistKnownFailure(publishJobId: string, failure: PublicationWorkerError, deps: PublishPostDependencies): Promise<void> {
  if (failure.retryable) await deps.repository.markRetrying(publishJobId, failure.code, failure.message)
  else await deps.repository.markFailed(publishJobId, failure.code, failure.message)
}

function normalizeProviderFailure(error: unknown): PublicationWorkerError {
  if (error instanceof PublicationWorkerError) return error
  const code = readErrorCode(error, 'publication_provider_error')
  const message = error instanceof Error ? error.message : 'Publication provider failed'
  const retryable = ['rate_limited', 'upstream_error', 'network_error', 'timeout'].includes(code)
  return new PublicationWorkerError(code, message, retryable)
}

function readErrorCode(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const value = (error as { code?: unknown }).code
    if (typeof value === 'string' && value.length > 0) return value
  }
  return fallback
}

function reconciliationAfter(scheduledFor: string): string {
  const parsed = new Date(scheduledFor)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return new Date(parsed.getTime() + 60_000).toISOString()
}

export function readPublishJobId(job: BackgroundJob, expectedType: string): string {
  if (job.jobType !== expectedType) throw new PublicationWorkerError('wrong_job_type', `Expected a ${expectedType} job`, false)
  const value = job.payload.publishJobId
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PublicationWorkerError('invalid_job_payload', `${expectedType} requires publishJobId`, false)
  }
  return value
}
