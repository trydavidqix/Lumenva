import type { ContentStatus } from '../content/status'
import { snapshotHash, type ReviewSnapshot } from './review-snapshot'
import type {
  ApprovalDecisionRecord,
  ApprovalRepository,
  ApprovalSnapshotSource,
  PendingApproval,
} from './types'

const CURRENT_APPROVAL_STATUSES = new Set<ContentStatus>([
  'APPROVED',
  'SCHEDULED',
  'PUBLISHING',
  'RETRYING',
  'FAILED',
  'PUBLISHED',
])

export type ApprovalService = {
  requestApproval(contentItemId: string): Promise<PendingApproval>
  approveContent(contentItemId: string, userId: string): Promise<ApprovalDecisionRecord>
  rejectContent(contentItemId: string, userId: string, reason: string): Promise<ApprovalDecisionRecord>
  assertCurrentApproval(contentItemId: string): Promise<ApprovalDecisionRecord>
}

export class ApprovalServiceError extends Error {
  readonly code:
    | 'content_not_found'
    | 'content_not_ready'
    | 'approval_not_requested'
    | 'approval_stale'
    | 'approval_required'
    | 'owner_required'
    | 'approval_snapshot_invalid'

  constructor(code: ApprovalServiceError['code'], message: string) {
    super(message)
    this.name = 'ApprovalServiceError'
    this.code = code
  }
}

export function createApprovalService(repository: ApprovalRepository): ApprovalService {
  return {
    async requestApproval(contentItemId) {
      const source = await requireSource(repository, contentItemId)
      if (source.status !== 'READY_FOR_REVIEW' && source.status !== 'PENDING_APPROVAL') {
        throw new ApprovalServiceError('content_not_ready', 'Content is not ready for approval')
      }

      const snapshot = buildReviewSnapshot(source)
      const pending: PendingApproval = {
        workspaceId: source.workspaceId,
        contentItemId,
        snapshot,
        snapshotHash: snapshotHash(snapshot),
      }

      await repository.savePendingApproval(pending)
      return pending
    },

    async approveContent(contentItemId, userId) {
      return decide(repository, contentItemId, userId, 'approved', null)
    },

    async rejectContent(contentItemId, userId, reason) {
      return decide(repository, contentItemId, userId, 'rejected', reason.trim())
    },

    async assertCurrentApproval(contentItemId) {
      const source = await requireSource(repository, contentItemId)
      if (!CURRENT_APPROVAL_STATUSES.has(source.status)) {
        throw new ApprovalServiceError('approval_required', 'Current approval is required')
      }

      const approved = await repository.loadLatestApproved(contentItemId)
      if (!approved) {
        throw new ApprovalServiceError('approval_required', 'Current approval is required')
      }

      const currentSnapshot = buildReviewSnapshot(source)
      const currentHash = snapshotHash(currentSnapshot)
      if (currentHash !== approved.snapshotHash) {
        throw new ApprovalServiceError('approval_stale', 'Approved snapshot is no longer current')
      }

      return approved
    },
  }
}

async function decide(
  repository: ApprovalRepository,
  contentItemId: string,
  userId: string,
  decision: 'approved' | 'rejected',
  reason: string | null,
): Promise<ApprovalDecisionRecord> {
  const source = await requireSource(repository, contentItemId)
  const isOwner = await repository.isWorkspaceOwner(source.workspaceId, userId)
  if (!isOwner) {
    throw new ApprovalServiceError('owner_required', 'Workspace owner identity is required')
  }

  const pending = await repository.loadPendingApproval(contentItemId)
  if (!pending) {
    throw new ApprovalServiceError('approval_not_requested', 'Approval has not been requested')
  }

  const currentSnapshot = buildReviewSnapshot(source)
  const currentHash = snapshotHash(currentSnapshot)
  if (pending.snapshotHash !== currentHash) {
    throw new ApprovalServiceError('approval_stale', 'Pending approval snapshot is stale')
  }

  return repository.finalizeDecision({
    workspaceId: source.workspaceId,
    contentItemId,
    decision,
    reason,
    snapshot: pending.snapshot,
    snapshotHash: pending.snapshotHash,
    publishMode: pending.snapshot.publishMode,
    decidedBy: userId,
  })
}

async function requireSource(
  repository: ApprovalRepository,
  contentItemId: string,
): Promise<ApprovalSnapshotSource> {
  const source = await repository.loadSnapshotSource(contentItemId)
  if (!source) {
    throw new ApprovalServiceError('content_not_found', 'Content item not found')
  }
  return source
}

function buildReviewSnapshot(source: ApprovalSnapshotSource): ReviewSnapshot {
  if (!source.script.trim() || source.mediaAssetIds.length === 0) {
    throw new ApprovalServiceError('approval_snapshot_invalid', 'Script and canonical media are required')
  }

  const platforms = new Set(source.variants.map((variant) => variant.platform))
  if (
    source.variants.length !== 4 ||
    platforms.size !== 4 ||
    !['instagram', 'facebook', 'tiktok', 'youtube'].every((platform) => platforms.has(platform as never))
  ) {
    throw new ApprovalServiceError(
      'approval_snapshot_invalid',
      'Exactly one variant per supported platform is required',
    )
  }

  if (source.targetAccountIds.length === 0) {
    throw new ApprovalServiceError('approval_snapshot_invalid', 'At least one target account is required')
  }

  const publishMode = source.proposedPublishMode ?? 'now'
  if (publishMode === 'schedule' && !source.proposedScheduledFor) {
    throw new ApprovalServiceError('approval_snapshot_invalid', 'Scheduled approval requires a time')
  }

  return {
    contentId: source.contentId,
    script: source.script,
    mediaAssetIds: [...source.mediaAssetIds],
    variants: source.variants.map((variant) => ({
      ...variant,
      hashtags: [...variant.hashtags],
    })),
    targetAccountIds: [...source.targetAccountIds],
    scheduledFor: publishMode === 'schedule' ? source.proposedScheduledFor : null,
    publishMode,
  }
}
