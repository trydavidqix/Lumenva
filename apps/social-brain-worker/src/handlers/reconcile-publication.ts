import type { BackgroundJob } from '@lumenva/db/jobs'

import type { CurrentApprovalGuard, PublicationFinalizedHook, PublicationProvider, PublicationWorkerRepository } from './publication-types'
import { PublicationWorkerError } from './publication-types'
import { readPublishJobId } from './publish-post'

export type ReconcilePublicationDependencies = {
  repository: Pick<PublicationWorkerRepository, 'loadContext' | 'loadApprovedMedia' | 'markResult' | 'markReconcileRequired' | 'markFailed'>
  provider: Pick<PublicationProvider, 'getPublicationStatus' | 'schedulePost' | 'publishNow'>
  assertCurrentApproval: CurrentApprovalGuard
  onPublished?: PublicationFinalizedHook
}

export function createReconcilePublicationHandler(deps: ReconcilePublicationDependencies) {
  return async function reconcilePublication(job: BackgroundJob): Promise<void> {
    const publishJobId = readPublishJobId(job, 'publish.reconcile')
    const context = await deps.repository.loadContext(publishJobId)
    if (!context) throw new PublicationWorkerError('publish_job_not_found', 'Publish job was not found', false)
    if (context.workspaceId !== job.workspaceId) throw new PublicationWorkerError('publish_workspace_mismatch', 'Publish job does not belong to the reconciliation workspace', false)
    if (context.status === 'published') return

    const approval = await deps.assertCurrentApproval(context.contentItemId)
    if (approval.id !== context.approvalId) {
      const error = new PublicationWorkerError('approval_stale', 'Publish reconciliation belongs to a stale approval', false)
      await deps.repository.markFailed(context.id, error.code, error.message)
      throw error
    }
    const media = await deps.repository.loadApprovedMedia(approval.snapshot.mediaAssetIds)
    const providerMediaAssetIds = media.flatMap((asset) => asset.providerMediaAssetId ? [asset.providerMediaAssetId] : [])
    if (providerMediaAssetIds.length === 0 || providerMediaAssetIds.length !== media.length) {
      const error = new PublicationWorkerError('prepared_media_missing', 'Reconciliation requires the exact prepared provider media', false)
      await deps.repository.markFailed(context.id, error.code, error.message)
      throw error
    }

    let published = false
    try {
      const result = context.providerPublicationId
        ? await deps.provider.getPublicationStatus({ providerPublicationId: context.providerPublicationId, providerAccountId: context.providerAccountId })
        : await deps.provider.schedulePost({
            providerAccountId: context.providerAccountId,
            caption: context.caption,
            title: context.title,
            providerMediaAssetIds,
            idempotencyKey: context.idempotencyKey,
            scheduledFor: context.scheduledFor,
          })
      if (result.state === 'unknown') {
        const error = new PublicationWorkerError('publication_still_unknown', 'BrightBean publication state is still unknown', true)
        await deps.repository.markReconcileRequired(context.id, error.code, error.message)
        throw error
      }
      if (result.state === 'failed') {
        const error = new PublicationWorkerError('publication_failed', result.errorMessage ?? 'BrightBean reported a failed publication', false)
        await deps.repository.markFailed(context.id, error.code, error.message)
        throw error
      }
      await deps.repository.markResult(context.id, result)
      published = result.state === 'published'
      if (result.state === 'queued' || result.state === 'scheduled' || result.state === 'publishing') {
        throw new PublicationWorkerError('publication_not_final', 'BrightBean publication is not final yet', true)
      }
    } catch (error) {
      if (error instanceof PublicationWorkerError) throw error
      const code = readCode(error)
      const retryable = ['timeout', 'network_error', 'rate_limited', 'upstream_error'].includes(code)
      const normalized = new PublicationWorkerError(code, error instanceof Error ? error.message : 'Publication reconciliation failed', retryable)
      if (retryable) await deps.repository.markReconcileRequired(context.id, normalized.code, normalized.message)
      else await deps.repository.markFailed(context.id, normalized.code, normalized.message)
      throw normalized
    }

    if (published && deps.onPublished) {
      try {
        await deps.onPublished({
          workspaceId: context.workspaceId,
          contentVariantId: context.contentVariantId,
          publishJobId: context.id,
        })
      } catch (error) {
        console.error('Post-reconciliation follow-up failed', error instanceof Error ? error.message : 'unknown error')
      }
    }
  }
}

function readCode(error: unknown): string {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code
    if (typeof code === 'string' && code.length > 0) return code
  }
  return 'reconciliation_failed'
}
