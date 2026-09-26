import { createHash } from 'node:crypto'

import type { ApprovalDecisionRecord } from '../approval/types'
import type { PublishMode } from '../approval/review-snapshot'
import type { SocialPlatform } from '../social/types'

export type PublicationJobStatus =
  | 'queued'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'retrying'
  | 'unknown'
  | 'reconcile_required'
  | 'cancelled'

export type PublicationTarget = {
  contentVariantId: string
  platform: SocialPlatform
  socialAccountId: string
}

export type EnsurePublishJobInput = {
  workspaceId: string
  contentItemId: string
  contentVariantId: string
  socialAccountId: string
  approvalId: string
  platform: SocialPlatform
  publishMode: PublishMode
  scheduledFor: string | null
  idempotencyKey: string
}

export type PublicationJobRecord = EnsurePublishJobInput & {
  id: string
  status: PublicationJobStatus
}

export type EnsuredPublicationJob = {
  job: PublicationJobRecord
  created: boolean
}

export type PublicationRepository = {
  listPublicationTargets(
    contentItemId: string,
    targetAccountIds: string[],
  ): Promise<PublicationTarget[]>
  ensurePublishJob(input: EnsurePublishJobInput): Promise<EnsuredPublicationJob>
  markContentPublicationState(contentItemId: string, mode: PublishMode): Promise<void>
  getPublishJob(id: string): Promise<PublicationJobRecord | null>
  markForRetry(id: string): Promise<PublicationJobRecord>
}

export type PublicationServiceDependencies = {
  repository: PublicationRepository
  assertCurrentApproval(contentItemId: string): Promise<ApprovalDecisionRecord>
  enqueuePublishJob(job: PublicationJobRecord): Promise<void>
}

export type CreatePublishJobsInput = {
  mode: PublishMode
}

export type PublicationService = {
  createPublishJobs(
    contentItemId: string,
    input: CreatePublishJobsInput,
  ): Promise<PublicationJobRecord[]>
  retryPublishJob(publishJobId: string): Promise<PublicationJobRecord>
}

export class PublicationServiceError extends Error {
  readonly code:
    | 'publish_mode_mismatch'
    | 'publication_targets_invalid'
    | 'publish_job_not_found'
    | 'publish_retry_not_allowed'
    | 'approval_stale'

  constructor(code: PublicationServiceError['code'], message: string) {
    super(message)
    this.name = 'PublicationServiceError'
    this.code = code
  }
}

const PLATFORMS: readonly SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
]

export function createPublicationService(
  dependencies: PublicationServiceDependencies,
): PublicationService {
  return {
    async createPublishJobs(contentItemId, input) {
      const approval = await dependencies.assertCurrentApproval(contentItemId)
      validateApprovedMode(approval, input.mode)

      const targets = await dependencies.repository.listPublicationTargets(
        contentItemId,
        approval.snapshot.targetAccountIds,
      )
      validateTargets(targets, approval.snapshot.targetAccountIds)

      const scheduledFor = input.mode === 'schedule'
        ? approval.snapshot.scheduledFor
        : approval.decidedAt

      if (!scheduledFor) {
        throw new PublicationServiceError(
          'publish_mode_mismatch',
          'Approved publication requires an exact provider execution time',
        )
      }

      const ensuredJobs: EnsuredPublicationJob[] = []
      for (const target of targets) {
        const ensured = await dependencies.repository.ensurePublishJob({
          workspaceId: approval.workspaceId,
          contentItemId,
          contentVariantId: target.contentVariantId,
          socialAccountId: target.socialAccountId,
          approvalId: approval.id,
          platform: target.platform,
          publishMode: input.mode,
          scheduledFor,
          idempotencyKey: publishIdempotencyKey({
            contentItemId,
            contentVariantId: target.contentVariantId,
            socialAccountId: target.socialAccountId,
            approvalSnapshotHash: approval.snapshotHash,
            publishMode: input.mode,
            scheduledFor,
          }),
        })
        ensuredJobs.push(ensured)
      }

      await dependencies.repository.markContentPublicationState(contentItemId, input.mode)

      for (const ensured of ensuredJobs) {
        if (ensured.created) {
          await dependencies.enqueuePublishJob(ensured.job)
        }
      }

      return ensuredJobs.map(({ job }) => job)
    },

    async retryPublishJob(publishJobId) {
      const job = await dependencies.repository.getPublishJob(publishJobId)
      if (!job) {
        throw new PublicationServiceError('publish_job_not_found', 'Publish job not found')
      }
      if (job.status !== 'failed') {
        throw new PublicationServiceError(
          'publish_retry_not_allowed',
          'Only failed publication jobs may be retried directly',
        )
      }

      const approval = await dependencies.assertCurrentApproval(job.contentItemId)
      if (approval.id !== job.approvalId) {
        throw new PublicationServiceError(
          'approval_stale',
          'Publish job belongs to a stale approval',
        )
      }

      const retried = await dependencies.repository.markForRetry(job.id)
      await dependencies.enqueuePublishJob(retried)
      return retried
    },
  }
}

function validateApprovedMode(approval: ApprovalDecisionRecord, mode: PublishMode): void {
  if (
    approval.decision !== 'approved' ||
    approval.publishMode !== mode ||
    approval.snapshot.publishMode !== mode
  ) {
    throw new PublicationServiceError(
      'publish_mode_mismatch',
      'Requested publication mode differs from the approved snapshot',
    )
  }
}

function validateTargets(targets: PublicationTarget[], approvedAccountIds: string[]): void {
  if (targets.length !== PLATFORMS.length) {
    throw new PublicationServiceError(
      'publication_targets_invalid',
      'Exactly four publication targets are required',
    )
  }

  const platforms = new Set(targets.map((target) => target.platform))
  const accounts = new Set(targets.map((target) => target.socialAccountId))
  const approvedAccounts = new Set(approvedAccountIds)

  if (
    platforms.size !== PLATFORMS.length ||
    accounts.size !== PLATFORMS.length ||
    !PLATFORMS.every((platform) => platforms.has(platform)) ||
    !targets.every((target) => approvedAccounts.has(target.socialAccountId))
  ) {
    throw new PublicationServiceError(
      'publication_targets_invalid',
      'Publication targets do not match the approved four-platform snapshot',
    )
  }
}

export function publishIdempotencyKey(input: {
  contentItemId: string
  contentVariantId: string
  socialAccountId: string
  approvalSnapshotHash: string
  publishMode: PublishMode
  scheduledFor: string | null
}): string {
  const canonical = JSON.stringify([
    input.contentItemId,
    input.contentVariantId,
    input.socialAccountId,
    input.approvalSnapshotHash,
    input.publishMode,
    input.scheduledFor,
  ])
  return createHash('sha256').update(canonical).digest('hex')
}
