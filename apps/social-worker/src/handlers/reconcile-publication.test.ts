import { describe, expect, it, vi } from 'vitest'

import { createReconcilePublicationHandler } from './reconcile-publication'
import type { ReconcilePublicationDependencies } from './reconcile-publication'

function backgroundJob() {
  return {
    id: 'background-reconcile-1', workspaceId: 'workspace-1', jobType: 'publish.reconcile',
    payload: { publishJobId: 'publish-1' }, status: 'running' as const, attemptCount: 1, maxAttempts: 20,
    runAfter: '2026-08-17T18:30:00Z', lockedBy: 'worker-1', lockedAt: '2026-08-17T18:30:00Z',
    lastErrorCode: null, lastErrorMessage: null, completedAt: null,
  }
}

function context(providerPublicationId: string | null) {
  return {
    id: 'publish-1', workspaceId: 'workspace-1', contentItemId: 'content-1', contentVariantId: 'variant-1',
    approvalId: 'approval-1', publishMode: 'schedule' as const, scheduledFor: '2026-08-18T18:30:00.000Z',
    idempotencyKey: 'key-1', status: 'reconcile_required' as const, providerPublicationId,
    providerAccountId: 'provider-account-1', caption: 'Approved caption', title: null,
  }
}

function deps(providerPublicationId: string | null = 'brightbean-post-1') {
  return {
    repository: {
      loadContext: vi.fn(async () => context(providerPublicationId)),
      loadApprovedMedia: vi.fn(async () => [{ id: 'media-1', filename: 'media-1.mp4', mimeType: 'video/mp4', storageBucket: 'media', storagePath: 'path/media-1', providerMediaAssetId: 'brightbean-media-1' }]),
      markResult: vi.fn(async () => undefined), markReconcileRequired: vi.fn(async () => undefined), markFailed: vi.fn(async () => undefined),
    },
    provider: {
      getPublicationStatus: vi.fn<ReconcilePublicationDependencies['provider']['getPublicationStatus']>(async () => ({ providerPublicationId: 'brightbean-post-1', providerPlatformPublicationId: 'brightbean-child-1', providerAccountId: 'provider-account-1', state: 'published', externalPostId: 'network-post-1', externalUrl: null, scheduledFor: '2026-08-18T18:30:00Z', publishedAt: '2026-08-18T18:31:00Z', errorMessage: null })),
      schedulePost: vi.fn(async () => ({ providerPublicationId: 'brightbean-post-1', providerPlatformPublicationId: 'brightbean-child-1', providerAccountId: 'provider-account-1', state: 'scheduled' as const, externalPostId: null, externalUrl: null, scheduledFor: '2026-08-18T18:30:00Z', publishedAt: null, errorMessage: null })),
      publishNow: vi.fn(),
    },
    assertCurrentApproval: vi.fn(async () => ({ id: 'approval-1', snapshot: { mediaAssetIds: ['media-1'] } })),
    onPublished: vi.fn(async () => undefined),
  }
}

describe('publish.reconcile handler', () => {
  it('uses provider status when the BrightBean parent post id is known', async () => {
    const dependencies = deps('brightbean-post-1')
    const handler = createReconcilePublicationHandler(dependencies as never)
    await handler(backgroundJob())
    expect(dependencies.provider.getPublicationStatus).toHaveBeenCalledWith({ providerPublicationId: 'brightbean-post-1', providerAccountId: 'provider-account-1' })
    expect(dependencies.provider.schedulePost).not.toHaveBeenCalled()
    expect(dependencies.repository.markResult).toHaveBeenCalledWith('publish-1', expect.objectContaining({ state: 'published', externalPostId: 'network-post-1' }))
  })

  it('does not reclassify a reconciled published post when follow-up scheduling fails', async () => {
    const dependencies = deps('brightbean-post-1')
    dependencies.onPublished = vi.fn(async () => { throw new Error('analytics unavailable') })
    const handler = createReconcilePublicationHandler(dependencies as never)
    await handler(backgroundJob())
    expect(dependencies.repository.markResult).toHaveBeenCalledWith('publish-1', expect.objectContaining({ state: 'published' }))
    expect(dependencies.repository.markFailed).not.toHaveBeenCalled()
    expect(dependencies.repository.markReconcileRequired).not.toHaveBeenCalled()
  })

  it('replays the exact idempotent create only when timeout left no provider id, then keeps polling', async () => {
    const dependencies = deps(null)
    const handler = createReconcilePublicationHandler(dependencies as never)
    await expect(handler(backgroundJob())).rejects.toMatchObject({ code: 'publication_not_final', retryable: true })
    expect(dependencies.provider.getPublicationStatus).not.toHaveBeenCalled()
    expect(dependencies.provider.schedulePost).toHaveBeenCalledTimes(1)
    expect(dependencies.provider.schedulePost).toHaveBeenCalledWith({ providerAccountId: 'provider-account-1', caption: 'Approved caption', title: null, providerMediaAssetIds: ['brightbean-media-1'], idempotencyKey: 'key-1', scheduledFor: '2026-08-18T18:30:00.000Z' })
    expect(dependencies.repository.markResult).toHaveBeenCalledWith('publish-1', expect.objectContaining({ state: 'scheduled', providerPublicationId: 'brightbean-post-1' }))
  })

  it('keeps an unresolved unknown result in reconciliation', async () => {
    const dependencies = deps('brightbean-post-1')
    dependencies.provider.getPublicationStatus = vi.fn<ReconcilePublicationDependencies['provider']['getPublicationStatus']>(async () => ({ providerPublicationId: 'brightbean-post-1', providerPlatformPublicationId: 'brightbean-child-1', providerAccountId: 'provider-account-1', state: 'unknown', externalPostId: null, externalUrl: null, scheduledFor: null, publishedAt: null, errorMessage: null }))
    const handler = createReconcilePublicationHandler(dependencies as never)
    await expect(handler(backgroundJob())).rejects.toMatchObject({ code: 'publication_still_unknown', retryable: true })
    expect(dependencies.repository.markReconcileRequired).toHaveBeenCalledWith('publish-1', 'publication_still_unknown', expect.any(String))
  })
})