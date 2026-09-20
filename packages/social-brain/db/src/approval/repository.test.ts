import { describe, expect, it, vi } from 'vitest'

import type { ReviewSnapshot } from '@lumenva/core'

import { createApprovalRepository } from './repository'
import type {
  ApprovalContentRow,
  ApprovalStore,
  ApprovalStoredDecisionRow,
} from './repository'

const snapshot: ReviewSnapshot = {
  contentId: 'content-1',
  script: 'Script',
  mediaAssetIds: ['media-1'],
  variants: [
    { platform: 'instagram', caption: 'IG', title: null, hashtags: [] },
    { platform: 'facebook', caption: 'FB', title: null, hashtags: [] },
    { platform: 'tiktok', caption: 'TT', title: null, hashtags: [] },
    { platform: 'youtube', caption: 'YT', title: 'Short', hashtags: [] },
  ],
  targetAccountIds: ['account-ig', 'account-fb', 'account-tt', 'account-yt'],
  scheduledFor: '2026-08-19T18:00:00.000Z',
  publishMode: 'schedule',
}

function createStore(): ApprovalStore {
  return {
    getContent: vi.fn(async (): Promise<ApprovalContentRow | null> => ({
      id: 'content-1',
      workspace_id: 'workspace-1',
      status: 'READY_FOR_REVIEW',
      script: 'Script',
      proposed_publish_mode: 'schedule',
      proposed_scheduled_for: '2026-08-19T18:00:00.000Z',
      review_snapshot_json: null,
      review_snapshot_hash: null,
    })),
    listReadyMedia: vi.fn(async () => [{ id: 'media-1' }]),
    listVariants: vi.fn(async () => [
      { platform: 'instagram', caption: 'IG', title: null, hashtags: [] },
      { platform: 'facebook', caption: 'FB', title: null, hashtags: [] },
      { platform: 'tiktok', caption: 'TT', title: null, hashtags: [] },
      { platform: 'youtube', caption: 'YT', title: 'Short', hashtags: [] },
    ]),
    listActiveAccounts: vi.fn(async () => [
      { id: 'account-ig', platform: 'instagram' },
      { id: 'account-fb', platform: 'facebook' },
      { id: 'account-tt', platform: 'tiktok' },
      { id: 'account-yt', platform: 'youtube' },
    ]),
    savePending: vi.fn(async () => undefined),
    finalizeDecision: vi.fn(async (input) => ({
      id: 'approval-1',
      workspace_id: input.workspaceId,
      content_item_id: input.contentItemId,
      decision: input.decision,
      reason: input.reason,
      review_snapshot_json: input.snapshot,
      snapshot_hash: input.snapshotHash,
      publish_mode: input.publishMode,
      decided_by: input.decidedBy,
      decided_at: '2026-08-17T18:30:00.000Z',
    })),
    getLatestApproved: vi.fn(async (): Promise<ApprovalStoredDecisionRow | null> => null),
    isWorkspaceOwner: vi.fn(async (_workspaceId, userId) => userId === 'owner-1'),
  }
}

describe('approval repository', () => {
  it('builds snapshot source from canonical DB state and resolves one active account per platform', async () => {
    const store = createStore()
    const repository = createApprovalRepository(store)

    await expect(repository.loadSnapshotSource('content-1')).resolves.toEqual({
      workspaceId: 'workspace-1',
      contentId: 'content-1',
      status: 'READY_FOR_REVIEW',
      script: 'Script',
      mediaAssetIds: ['media-1'],
      variants: snapshot.variants,
      targetAccountIds: snapshot.targetAccountIds,
      proposedPublishMode: 'schedule',
      proposedScheduledFor: '2026-08-19T18:00:00.000Z',
    })
  })

  it('refuses ambiguous or missing destination accounts instead of targeting every account', async () => {
    const store = createStore()
    store.listActiveAccounts = vi.fn(async () => [
      { id: 'ig-1', platform: 'instagram' },
      { id: 'ig-2', platform: 'instagram' },
      { id: 'fb-1', platform: 'facebook' },
      { id: 'tt-1', platform: 'tiktok' },
      { id: 'yt-1', platform: 'youtube' },
    ])

    await expect(createApprovalRepository(store).loadSnapshotSource('content-1')).rejects.toThrow(
      'Destination accounts are not uniquely resolvable',
    )
  })

  it('stores a pending review snapshot on the content item and moves it to pending approval', async () => {
    const store = createStore()
    const repository = createApprovalRepository(store)

    await repository.savePendingApproval({
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      snapshot,
      snapshotHash: 'hash-1',
    })

    expect(store.savePending).toHaveBeenCalledWith('content-1', {
      review_snapshot_json: snapshot,
      review_snapshot_hash: 'hash-1',
      status: 'PENDING_APPROVAL',
    })
  })

  it('maps pending review state back to the core contract', async () => {
    const store = createStore()
    store.getContent = vi.fn(async (): Promise<ApprovalContentRow | null> => ({
      id: 'content-1',
      workspace_id: 'workspace-1',
      status: 'PENDING_APPROVAL',
      script: 'Script',
      proposed_publish_mode: 'schedule',
      proposed_scheduled_for: '2026-08-19T18:00:00.000Z',
      review_snapshot_json: snapshot,
      review_snapshot_hash: 'hash-1',
    }))
    const repository = createApprovalRepository(store)

    await expect(repository.loadPendingApproval('content-1')).resolves.toEqual({
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      snapshot,
      snapshotHash: 'hash-1',
    })
  })

  it('delegates the final decision to one atomic store operation', async () => {
    const store = createStore()
    const repository = createApprovalRepository(store)

    const result = await repository.finalizeDecision({
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      decision: 'approved',
      reason: null,
      snapshot,
      snapshotHash: 'hash-1',
      publishMode: 'schedule',
      decidedBy: 'owner-1',
    })

    expect(store.finalizeDecision).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      id: 'approval-1',
      decision: 'approved',
      snapshotHash: 'hash-1',
      publishMode: 'schedule',
    })
  })

  it('maps the latest approved decision and validates owner membership through the store', async () => {
    const store = createStore()
    const latestApproved: ApprovalStoredDecisionRow = {
      id: 'approval-1',
      workspace_id: 'workspace-1',
      content_item_id: 'content-1',
      decision: 'approved',
      reason: null,
      review_snapshot_json: snapshot,
      snapshot_hash: 'hash-1',
      publish_mode: 'schedule',
      decided_by: 'owner-1',
      decided_at: '2026-08-17T18:30:00.000Z',
    }
    store.getLatestApproved = vi.fn(async () => latestApproved)
    const repository = createApprovalRepository(store)

    await expect(repository.loadLatestApproved('content-1')).resolves.toMatchObject({
      id: 'approval-1',
      decision: 'approved',
    })
    await expect(repository.isWorkspaceOwner('workspace-1', 'owner-1')).resolves.toBe(true)
    await expect(repository.isWorkspaceOwner('workspace-1', 'other-user')).resolves.toBe(false)
  })
})
