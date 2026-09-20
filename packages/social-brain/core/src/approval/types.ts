import type { ContentStatus } from '../content/status'
import type { ContentVariantSnapshot, PublishMode, ReviewSnapshot } from './review-snapshot'

export type ApprovalSnapshotSource = {
  workspaceId: string
  contentId: string
  status: ContentStatus
  script: string
  mediaAssetIds: string[]
  variants: ContentVariantSnapshot[]
  targetAccountIds: string[]
  proposedPublishMode: PublishMode | null
  proposedScheduledFor: string | null
}

export type PendingApproval = {
  workspaceId: string
  contentItemId: string
  snapshot: ReviewSnapshot
  snapshotHash: string
}

export type ApprovalDecision = 'approved' | 'rejected'

export type FinalizeApprovalDecisionInput = {
  workspaceId: string
  contentItemId: string
  decision: ApprovalDecision
  reason: string | null
  snapshot: ReviewSnapshot
  snapshotHash: string
  publishMode: PublishMode
  decidedBy: string
}

export type ApprovalDecisionRecord = FinalizeApprovalDecisionInput & {
  id: string
  decidedAt: string
}

export type ApprovalRepository = {
  loadSnapshotSource(contentItemId: string): Promise<ApprovalSnapshotSource | null>
  savePendingApproval(input: PendingApproval): Promise<void>
  loadPendingApproval(contentItemId: string): Promise<PendingApproval | null>
  finalizeDecision(input: FinalizeApprovalDecisionInput): Promise<ApprovalDecisionRecord>
  loadLatestApproved(contentItemId: string): Promise<ApprovalDecisionRecord | null>
  isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean>
}
