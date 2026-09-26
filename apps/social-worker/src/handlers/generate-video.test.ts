import { describe, expect, it, vi } from 'vitest'

import type {
  ContentItem,
  ProviderHealth,
  VideoJobRef,
  VideoResult,
} from '@lumenva/core'
import type { BackgroundJob } from '@lumenva/db/jobs'
import type {
  CreateGeneratingMediaInput,
  MediaAsset,
} from '@lumenva/db/media'
import type {
  ImportMediaInput,
  ImportedMedia,
} from '@lumenva/db/storage/media'

const content: ContentItem = {
  id: 'content-1',
  workspaceId: 'workspace-1',
  objective: 'Teach better hooks',
  topic: 'Social video hooks',
  hook: 'The first two seconds decide whether people stay.',
  script: 'State the result first, prove it quickly, then close with one action.',
  videoBrief: {
    format: '9:16',
    durationTargetSeconds: 35,
    visualDirection: 'Fast vertical cuts',
    voiceDirection: 'Clear and energetic',
  },
  status: 'DRAFT',
  createdAt: '2026-08-17T15:00:00.000Z',
}

const fourVariants = ['instagram', 'facebook', 'tiktok', 'youtube'].map((platform) => ({
  id: `variant-${platform}`,
  contentItemId: 'content-1',
  platform,
  title: null,
  caption: `${platform} caption`,
  hashtags: ['social'],
  metadata: {},
}))

const job: BackgroundJob = {
  id: 'job-1',
  workspaceId: 'workspace-1',
  jobType: 'video.generate',
  payload: { contentItemId: 'content-1' },
  status: 'running',
  attemptCount: 1,
  maxAttempts: 3,
  runAfter: '2026-08-17T15:00:00.000Z',
  lockedBy: 'worker-1',
  lockedAt: '2026-08-17T15:00:00.000Z',
  lastErrorCode: null,
  lastErrorMessage: null,
  completedAt: null,
}

async function loadModule() {
  const mod = await import('./generate-video').catch(() => null)
  expect(mod, 'generate-video handler module must exist').not.toBeNull()
  if (!mod) throw new Error('generate-video module missing')
  return mod
}

function dependencies() {
  const contentRepository = {
    getContentItem: vi.fn(async (): Promise<ContentItem | null> => ({ ...content })),
    setStatus: vi.fn(async () => undefined),
  }
  const variantRepository = {
    listVariants: vi.fn(async () => structuredClone(fourVariants)),
  }
  const mediaRepository = {
    findForContent: vi.fn(async (): Promise<MediaAsset | null> => null),
    createGenerating: vi.fn(
      async (input: CreateGeneratingMediaInput): Promise<MediaAsset> => ({
        id: input.id,
        workspaceId: input.workspaceId,
        contentItemId: input.contentItemId,
        provider: input.provider,
        providerAssetId: input.providerAssetId,
        status: 'generating',
        storageBucket: 'media',
        storagePath: null,
        mimeType: null,
        metadata: {},
      }),
    ),
    markReady: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
  }
  const storage = {
    importFromUrl: vi.fn(
      async (_input: ImportMediaInput): Promise<ImportedMedia> => ({
        bucket: 'media',
        path: 'workspace/workspace-1/content/content-1/asset-1',
        mimeType: 'video/mp4',
        sizeBytes: 1024,
      }),
    ),
  }
  const generator = {
    provider: 'moneyprinter',
    submit: vi.fn(async (): Promise<VideoJobRef> => ({
      provider: 'moneyprinter',
      providerJobId: 'mp-task-1',
      state: 'queued',
    })),
    status: vi.fn(async (): Promise<VideoJobRef> => ({
      provider: 'moneyprinter',
      providerJobId: 'mp-task-1',
      state: 'running',
    })),
    fetchResult: vi
      .fn(async (): Promise<VideoResult> => ({ providerJobId: 'mp-task-1', state: 'running' }))
      .mockResolvedValueOnce({ providerJobId: 'mp-task-1', state: 'running' })
      .mockResolvedValueOnce({
        providerJobId: 'mp-task-1',
        state: 'succeeded',
        downloadUrl: 'https://moneyprinter.test/tasks/mp-task-1/final.mp4',
      }),
    health: vi.fn(async (): Promise<ProviderHealth> => ({
      ok: true,
      checkedAt: '2026-08-17T15:00:00.000Z',
      latencyMs: 1,
      code: null,
      message: null,
    })),
  }

  return {
    contentRepository,
    variantRepository,
    mediaRepository,
    storage,
    generator,
    sleep: vi.fn(async () => undefined),
    createId: () => 'asset-1',
    maxPolls: 4,
  }
}

describe('video.generate handler', () => {
  it('submits, polls, imports media and moves to review only after four variants exist', async () => {
    const mod = await loadModule()
    const deps = dependencies()
    const handler = mod.createGenerateVideoHandler(deps)

    await handler(job)

    expect(deps.contentRepository.setStatus).toHaveBeenNthCalledWith(1, 'content-1', 'GENERATING')
    expect(deps.generator.submit).toHaveBeenCalledWith({
      contentItemId: 'content-1',
      subject: content.topic,
      script: content.script,
      videoBrief: content.videoBrief,
      idempotencyKey: 'video:content-1',
    })
    expect(deps.mediaRepository.createGenerating).toHaveBeenCalledWith({
      id: 'asset-1',
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      provider: 'moneyprinter',
      providerAssetId: 'mp-task-1',
    })
    expect(deps.storage.importFromUrl).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      assetId: 'asset-1',
      downloadUrl: 'https://moneyprinter.test/tasks/mp-task-1/final.mp4',
    })
    expect(deps.mediaRepository.markReady).toHaveBeenCalledWith('asset-1', {
      storageBucket: 'media',
      storagePath: 'workspace/workspace-1/content/content-1/asset-1',
      mimeType: 'video/mp4',
      metadata: { sizeBytes: 1024 },
    })
    expect(deps.contentRepository.setStatus).toHaveBeenLastCalledWith(
      'content-1',
      'READY_FOR_REVIEW',
    )
  })

  it('resumes an existing generating asset without submitting a duplicate provider job', async () => {
    const mod = await loadModule()
    const deps = dependencies()
    deps.mediaRepository.findForContent.mockResolvedValue({
      id: 'asset-existing',
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      provider: 'moneyprinter',
      providerAssetId: 'mp-existing',
      status: 'generating',
      storageBucket: 'media',
      storagePath: null,
      mimeType: null,
      metadata: {},
    })
    deps.generator.fetchResult.mockReset()
    deps.generator.fetchResult.mockResolvedValue({
      providerJobId: 'mp-existing',
      state: 'succeeded',
      downloadUrl: 'https://moneyprinter.test/tasks/mp-existing/final.mp4',
    })

    await mod.createGenerateVideoHandler(deps)(job)

    expect(deps.generator.submit).not.toHaveBeenCalled()
    expect(deps.storage.importFromUrl).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'asset-existing' }),
    )
  })

  it('fails closed when a submitted provider job id cannot be persisted locally', async () => {
    const mod = await loadModule()
    const deps = dependencies()
    deps.mediaRepository.createGenerating.mockRejectedValue(new Error('database unavailable'))

    const error = await mod.createGenerateVideoHandler(deps)(job).then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(deps.generator.submit).toHaveBeenCalledTimes(1)
    expect(error).toMatchObject({
      code: 'provider_job_persistence_failed',
      retryable: false,
    })
    expect(deps.generator.fetchResult).not.toHaveBeenCalled()
    expect(deps.contentRepository.setStatus).toHaveBeenLastCalledWith('content-1', 'FAILED')
  })

  it('marks terminal provider failure as FAILED without requesting retry', async () => {
    const mod = await loadModule()
    const deps = dependencies()
    deps.generator.fetchResult.mockReset()
    deps.generator.fetchResult.mockResolvedValue({
      providerJobId: 'mp-task-1',
      state: 'failed',
      error: { code: 'moneyprinter_task_failed', message: 'validation failed', retryable: false },
    })

    const error = await mod.createGenerateVideoHandler(deps)(job).then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code: 'moneyprinter_task_failed', retryable: false })
    expect(deps.mediaRepository.markFailed).toHaveBeenCalledWith('asset-1', {
      code: 'moneyprinter_task_failed',
      message: 'validation failed',
    })
    expect(deps.contentRepository.setStatus).toHaveBeenLastCalledWith('content-1', 'FAILED')
  })

  it('keeps transient failures retryable while attempts remain', async () => {
    const mod = await loadModule()
    const deps = dependencies()
    deps.generator.submit.mockRejectedValue(
      Object.assign(new Error('temporary'), { code: 'upstream_error', retryable: true }),
    )

    const error = await mod.createGenerateVideoHandler(deps)(job).then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code: 'upstream_error', retryable: true })
    expect(deps.contentRepository.setStatus).not.toHaveBeenCalledWith('content-1', 'FAILED')
  })

  it('marks content FAILED when a retryable failure exhausts the job budget', async () => {
    const mod = await loadModule()
    const deps = dependencies()
    deps.generator.submit.mockRejectedValue(
      Object.assign(new Error('temporary'), { code: 'upstream_error', retryable: true }),
    )

    const lastAttemptJob = { ...job, attemptCount: 3, maxAttempts: 3 }
    const error = await mod.createGenerateVideoHandler(deps)(lastAttemptJob).then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code: 'upstream_error', retryable: false })
    expect(deps.contentRepository.setStatus).toHaveBeenLastCalledWith('content-1', 'FAILED')
  })

  it('does not move to READY_FOR_REVIEW when a platform variant is missing', async () => {
    const mod = await loadModule()
    const deps = dependencies()
    deps.variantRepository.listVariants.mockResolvedValue(structuredClone(fourVariants.slice(0, 3)))
    deps.generator.fetchResult.mockReset()
    deps.generator.fetchResult.mockResolvedValue({
      providerJobId: 'mp-task-1',
      state: 'succeeded',
      downloadUrl: 'https://moneyprinter.test/tasks/mp-task-1/final.mp4',
    })

    await mod.createGenerateVideoHandler(deps)(job)

    expect(deps.mediaRepository.markReady).toHaveBeenCalled()
    expect(deps.contentRepository.setStatus).not.toHaveBeenCalledWith(
      'content-1',
      'READY_FOR_REVIEW',
    )
  })
})
