import { describe, expect, it, vi } from 'vitest'

import { snapshotHash } from './review-snapshot'
import { createApprovalService } from './approval-service'
import type {
  ApprovalDecisionRecord,
  ApprovalRepository,
  ApprovalSnapshotSource,
  PendingApproval,
} from './types'

function source(overrides: Partial<ApprovalSnapshotSource> = {}): ApprovalSnapshotSource {
  return {
    workspaceId: 'workspace-1',
    contentId: 'content-1',
    status: 'READY_FOR_REVIEW',
    script: 'Original script',
    mediaAssetIds: ['media-1'],
    variants: [
      { platform: 'instagram', caption: 'IG', title: null, hashtags: ['social'] },
      { platform: 'facebook', caption: 'FB', title: null, hashtags: [] },
      { platform: 'tiktok', caption: 'TT', title: null, hashtags: [] },
      { platform: 'youtube', caption: 'YT', title: 'Short', hashtags: [] },
    ],
    targetAccountIds: ['account-1', 'account-2', 'account-3', 'account-4'],
    proposedPublishMode: 'schedule',
    proposedScheduledFor: '2026-08-19T18:00:00.000Z',
    ...overrides,
  }
}

function createRepository(overrides: Partial<ApprovalRepository> = {}): ApprovalRepository {
  let pending: PendingApproval | null = null
  let latestApproved: ApprovalDecisionRecord | null = null
  let current = source()

  return {
    loadSnapshotSource: vi.fn(async () => current),
    savePendingApproval: vi.fn(async (input) => {
      pending = input
      current = { ...current, status: 'PENDING_APPROVAL' }
    }),
    loadPendingApproval: vi.fn(async () => pending),
    finalizeDecision: vi.fn(async (input) => {
      const record: ApprovalDecisionRecord = {
        id: 'approval-1',
        ...input,
        decidedAt: '2026-08-17T18:30:00.000Z',
      }
      if (input.decision === 'approved') {
        latestApproved = record
        current = { ...current, status: 'APPROVED' }
      } else {
        current = { ...current, status: 'REJECTED' }
      }
      pending = null
      return record
    }),
    loadLatestApproved: vi.fn(async () => latestApproved),
    isWorkspaceOwner: vi.fn(async (_workspaceId, userId) => userId === 'owner-1'),
    ...overrides,
  }
}

function snapshotFor(current: ApprovalSnapshotSource) {
  return {
    contentId: current.contentId,
    script: current.script,
    mediaAssetIds: current.mediaAssetIds,
    variants: current.variants,
    targetAccountIds: current.targetAccountIds,
    scheduledFor: current.proposedScheduledFor,
    publishMode: 'schedule' as const,
  }
}

describe('approval service', () => {
  it('builds and stores the pending review snapshot server-side', async () => {
    const repository = createRepository()
    const service = createApprovalService(repository)

    const requested = await service.requestApproval('content-1')

    expect(requested.snapshot.contentId).toBe('content-1')
    expect(requested.snapshot.script).toBe('Original script')
    expect(requested.snapshot.mediaAssetIds).toEqual(['media-1'])
    expect(requested.snapshot.variants).toHaveLength(4)
    expect(requested.snapshot.targetAccountIds).toHaveLength(4)
    expect(requested.snapshot.scheduledFor).toBe('2026-08-19T18:00:00.000Z')
    expect(requested.snapshot.publishMode).toBe('schedule')
    expect(requested.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
    expect(repository.savePendingApproval).toHaveBeenCalledWith(requested)
  })

  it('changes the snapshot hash when any approved field changes', async () => {
    const mutations: ApprovalSnapshotSource[] = [
      source({ script: 'Changed script' }),
      source({ mediaAssetIds: ['media-2'] }),
      source({
        variants: source().variants.map((variant) =>
          variant.platform === 'instagram' ? { ...variant, caption: 'Changed IG' } : variant,
        ),
      }),
      source({ targetAccountIds: ['account-1', 'account-2', 'account-3', 'account-99'] }),
      source({ proposedScheduledFor: '2026-08-20T18:00:00.000Z' }),
    ]

    const hashes: string[] = []
    for (const current of [source(), ...mutations]) {
      const repository = createRepository({
        loadSnapshotSource: vi.fn(async () => current),
      })
      hashes.push((await createApprovalService(repository).requestApproval('content-1')).snapshotHash)
    }

    expect(new Set(hashes).size).toBe(hashes.length)
  })

  it('requires the authenticated workspace owner to approve', async () => {
    const repository = createRepository()
    const service = createApprovalService(repository)
    await service.requestApproval('content-1')

    await expect(service.approveContent('content-1', 'other-user')).rejects.toMatchObject({
      code: 'owner_required',
    })
    expect(repository.finalizeDecision).not.toHaveBeenCalled()
  })

  it('refuses approval when current content no longer matches the requested snapshot', async () => {
    let current = source()
    const repository = createRepository({
      loadSnapshotSource: vi.fn(async () => current),
    })
    const service = createApprovalService(repository)
    await service.requestApproval('content-1')
    current = source({ script: 'Edited after request', status: 'PENDING_APPROVAL' })

    await expect(service.approveContent('content-1', 'owner-1')).rejects.toMatchObject({
      code: 'approval_stale',
    })
    expect(repository.finalizeDecision).not.toHaveBeenCalled()
  })

  it('records an immutable approved decision only after a matching pending snapshot', async () => {
    const repository = createRepository()
    const service = createApprovalService(repository)
    const requested = await service.requestApproval('content-1')

    const decision = await service.approveContent('content-1', 'owner-1')

    expect(decision.decision).toBe('approved')
    expect(decision.snapshotHash).toBe(requested.snapshotHash)
    expect(decision.decidedBy).toBe('owner-1')
    expect(repository.finalizeDecision).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      decision: 'approved',
      reason: null,
      snapshot: requested.snapshot,
      snapshotHash: requested.snapshotHash,
      publishMode: 'schedule',
      decidedBy: 'owner-1',
    })
  })

  it('records rejection with a reason and never treats it as current approval', async () => {
    const repository = createRepository()
    const service = createApprovalService(repository)
    await service.requestApproval('content-1')

    const decision = await service.rejectContent('content-1', 'owner-1', 'Change the opening hook')

    expect(decision.decision).toBe('rejected')
    expect(decision.reason).toBe('Change the opening hook')
    await expect(service.assertCurrentApproval('content-1')).rejects.toMatchObject({
      code: 'approval_required',
    })
  })

  it('asserts the current approved snapshot and rejects stale approval after later mutation', async () => {
    let current = source()
    let latestApproved: ApprovalDecisionRecord | null = null
    let pending: PendingApproval | null = null
    const repository = createRepository({
      loadSnapshotSource: vi.fn(async () => current),
      savePendingApproval: vi.fn(async (input) => {
        pending = input
        current = { ...current, status: 'PENDING_APPROVAL' }
      }),
      loadPendingApproval: vi.fn(async () => pending),
      finalizeDecision: vi.fn(async (input) => {
        const record: ApprovalDecisionRecord = {
          id: 'approval-1',
          ...input,
          decidedAt: '2026-08-17T18:30:00.000Z',
        }
        latestApproved = record
        pending = null
        current = { ...current, status: 'APPROVED' }
        return record
      }),
      loadLatestApproved: vi.fn(async () => latestApproved),
    })
    const service = createApprovalService(repository)
    await service.requestApproval('content-1')
    await service.approveContent('content-1', 'owner-1')

    await expect(service.assertCurrentApproval('content-1')).resolves.toMatchObject({
      decision: 'approved',
    })

    current = source({ script: 'Mutated after approval', status: 'APPROVED' })
    await expect(service.assertCurrentApproval('content-1')).rejects.toMatchObject({
      code: 'approval_stale',
    })
  })

  it.each(['APPROVED', 'SCHEDULED', 'PUBLISHING', 'RETRYING', 'FAILED', 'PUBLISHED'] as const)(
    'keeps the exact approval current during the publication lifecycle state %s',
    async (status) => {
      const current = source({ status })
      const snapshot = snapshotFor(current)
      const approved: ApprovalDecisionRecord = {
        id: 'approval-current',
        workspaceId: current.workspaceId,
        contentItemId: current.contentId,
        decision: 'approved',
        reason: null,
        snapshot,
        snapshotHash: snapshotHash(snapshot),
        publishMode: 'schedule',
        decidedBy: 'owner-1',
        decidedAt: '2026-08-17T18:30:00.000Z',
      }
      const repository = createRepository({
        loadSnapshotSource: vi.fn(async () => current),
        loadLatestApproved: vi.fn(async () => approved),
      })

      await expect(
        createApprovalService(repository).assertCurrentApproval('content-1'),
      ).resolves.toMatchObject({ id: 'approval-current' })
    },
  )

  it('never revives an old approval in pre-approval or rejected states', async () => {
    for (const status of ['READY_FOR_REVIEW', 'PENDING_APPROVAL', 'REJECTED'] as const) {
      const current = source({ status })
      const snapshot = snapshotFor(current)
      const oldApproval: ApprovalDecisionRecord = {
        id: 'approval-old',
        workspaceId: current.workspaceId,
        contentItemId: current.contentId,
        decision: 'approved',
        reason: null,
        snapshot,
        snapshotHash: snapshotHash(snapshot),
        publishMode: 'schedule',
        decidedBy: 'owner-1',
        decidedAt: '2026-08-17T18:30:00.000Z',
      }
      const repository = createRepository({
        loadSnapshotSource: vi.fn(async () => current),
        loadLatestApproved: vi.fn(async () => oldApproval),
      })

      await expect(
        createApprovalService(repository).assertCurrentApproval('content-1'),
      ).rejects.toMatchObject({ code: 'approval_required' })
    }
  })
})
