import { describe, expect, it, vi } from 'vitest'

import { createPublishPostHandler } from './publish-post'

function backgroundJob() {
  return {
    id: 'background-1',
    workspaceId: 'workspace-1',
    jobType: 'publish.execute',
    payload: { publishJobId: 'publish-1' },
    status: 'running' as const,
    attemptCount: 1,
    maxAttempts: 3,
    runAfter: '2026-08-17T18:30:00Z',
    lockedBy: 'worker-1',
    lockedAt: '2026-08-17T18:30:00Z',
    lastErrorCode: null,
    lastErrorMessage: null,
    completedAt: null,
  }
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    id: 'publish-1',
    workspaceId: 'workspace-1',
    contentItemId: 'content-1',
    contentVariantId: 'variant-1',
    approvalId: 'approval-1',
    publishMode: 'schedule' as const,
    scheduledFor: '2026-08-18T18:30:00.000Z',
    idempotencyKey: 'key-1',
    status: 'queued' as const,
    providerPublicationId: null,
    providerAccountId: 'provider-account-1',
    caption: 'Approved caption',
    title: null,
    ...overrides,
  }
}

function media() {
  return [{
    id: 'media-1',
    filename: 'media-1.mp4',
    mimeType: 'video/mp4',
    storageBucket: 'media',
    storagePath: 'workspace/workspace-1/content/content-1/media-1',
    providerMediaAssetId: 'brightbean-media-1',
    providerMediaProcessingStatus: 'completed',
  }]
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    repository: {
      loadContext: vi.fn(async () => context()),
      loadApprovedMedia: vi.fn(async () => media()),
      savePreparedMedia: vi.fn(async () => undefined),
      markPublishing: vi.fn(async () => undefined),
      markResult: vi.fn(async () => undefined),
      markRetrying: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined),
      markReconcileRequired: vi.fn(async () => undefined),
    },
    mediaSource: {
      download: vi.fn(async () => new Uint8Array([1, 2, 3])),
    },
    provider: {
      schedulePost: vi.fn(async () => ({
        providerPublicationId: 'brightbean-post-1',
        providerPlatformPublicationId: 'brightbean-child-1',
        providerAccountId: 'provider-account-1',
        state: 'scheduled' as const,
        externalPostId: null,
        externalUrl: null,
        scheduledFor: '2026-08-18T18:30:00.000Z',
        publishedAt: null,
        errorMessage: null,
      })),
      publishNow: vi.fn(),
      getPublicationStatus: vi.fn(),
      uploadMedia: vi.fn(),
      getMediaStatus: vi.fn(),
    },
    assertCurrentApproval: vi.fn(async () => ({
      id: 'approval-1',
      snapshot: { mediaAssetIds: ['media-1'] },
    })),
    enqueueReconciliation: vi.fn(async () => undefined),
    onPublished: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('publish.execute handler', () => {
  it('publishes one approved job and persists its provider result', async () => {
    const deps = dependencies()
    const handler = createPublishPostHandler(deps as never)

    await handler(backgroundJob())

    expect(deps.repository.markPublishing).toHaveBeenCalledWith('publish-1')
    expect(deps.provider.schedulePost).toHaveBeenCalledWith({
      providerAccountId: 'provider-account-1',
      caption: 'Approved caption',
      title: null,
      providerMediaAssetIds: ['brightbean-media-1'],
      idempotencyKey: 'key-1',
      scheduledFor: '2026-08-18T18:30:00.000Z',
    })
    expect(deps.repository.markResult).toHaveBeenCalledWith(
      'publish-1',
      expect.objectContaining({ state: 'scheduled', providerPublicationId: 'brightbean-post-1' }),
    )
  })

  it('does not reclassify an already-published post when analytics scheduling fails', async () => {
    const deps = dependencies({
      provider: {
        ...dependencies().provider,
        schedulePost: vi.fn(async () => ({
          providerPublicationId: 'brightbean-post-1',
          providerPlatformPublicationId: 'brightbean-child-1',
          providerAccountId: 'provider-account-1',
          state: 'published' as const,
          externalPostId: 'network-post-1',
          externalUrl: 'https://example.test/post/1',
          scheduledFor: '2026-08-18T18:30:00.000Z',
          publishedAt: '2026-08-18T18:31:00.000Z',
          errorMessage: null,
        })),
      },
      onPublished: vi.fn(async () => {
        throw new Error('analytics queue unavailable')
      }),
    })
    const handler = createPublishPostHandler(deps as never)

    await handler(backgroundJob())

    expect(deps.repository.markResult).toHaveBeenCalledWith(
      'publish-1',
      expect.objectContaining({ state: 'published' }),
    )
    expect(deps.repository.markRetrying).not.toHaveBeenCalled()
    expect(deps.repository.markFailed).not.toHaveBeenCalled()
    expect(deps.repository.markReconcileRequired).not.toHaveBeenCalled()
  })

  it('blocks stale approval before any provider side effect', async () => {
    const deps = dependencies({
      assertCurrentApproval: vi.fn(async () => ({ id: 'approval-new', snapshot: { mediaAssetIds: ['media-1'] } })),
    })
    const handler = createPublishPostHandler(deps as never)

    await expect(handler(backgroundJob())).rejects.toMatchObject({ code: 'approval_stale', retryable: false })
    expect(deps.provider.schedulePost).not.toHaveBeenCalled()
    expect(deps.repository.markFailed).toHaveBeenCalledWith('publish-1', 'approval_stale', expect.any(String))
  })

  it('does not publish a second time when a job is already scheduled or published', async () => {
    const deps = dependencies()
    deps.repository.loadContext = vi.fn(async () => context({ status: 'scheduled', providerPublicationId: 'post-existing' }))
    const handler = createPublishPostHandler(deps as never)

    await handler(backgroundJob())

    expect(deps.provider.schedulePost).not.toHaveBeenCalled()
    expect(deps.provider.publishNow).not.toHaveBeenCalled()
  })

  it('moves timeout to reconciliation without blind replay', async () => {
    const deps = dependencies()
    deps.provider.schedulePost = vi.fn(async () => {
      throw Object.assign(new Error('timed out'), { code: 'timeout' })
    })
    const handler = createPublishPostHandler(deps as never)

    await handler(backgroundJob())

    expect(deps.provider.schedulePost).toHaveBeenCalledTimes(1)
    expect(deps.repository.markReconcileRequired).toHaveBeenCalledWith('publish-1', 'timeout', expect.any(String))
    expect(deps.enqueueReconciliation).toHaveBeenCalledWith('workspace-1', 'publish-1')
  })

  it('classifies provider 5xx as retryable without reconciling', async () => {
    const deps = dependencies()
    deps.provider.schedulePost = vi.fn(async () => {
      throw Object.assign(new Error('upstream'), { code: 'upstream_error' })
    })
    const handler = createPublishPostHandler(deps as never)

    await expect(handler(backgroundJob())).rejects.toMatchObject({ code: 'upstream_error', retryable: true })
    expect(deps.repository.markRetrying).toHaveBeenCalledWith('publish-1', 'upstream_error', expect.any(String))
    expect(deps.enqueueReconciliation).not.toHaveBeenCalled()
  })
})
