import type { ApprovalDecisionRecord, AnalyticsSyncService, PublicationJobRecord } from '@lumenva/core'
import type { AuditRepository } from '@lumenva/db/audit'
import type { BackgroundJobRepository } from '@lumenva/db/jobs'

import { createPublishPostHandler } from './handlers/publish-post'
import { createReconcilePublicationHandler } from './handlers/reconcile-publication'
import { createPostPublicationAnalyticsScheduler, createSyncPostAnalyticsHandler } from './handlers/sync-post-analytics'
import type { CurrentApprovalGuard, PublicationMediaSource, PublicationProvider, PublicationWorkerRepository } from './handlers/publication-types'
import type { JobHandler } from './job-runner'

export type PublicationRuntimeDependencies = {
  backgroundJobs: BackgroundJobRepository
  publicationRepository: PublicationWorkerRepository
  mediaSource: PublicationMediaSource
  provider: PublicationProvider
  assertCurrentApproval: CurrentApprovalGuard
  audit: AuditRepository
}

export function createPublicationJobEnqueuer(backgroundJobs: BackgroundJobRepository) {
  return async (job: PublicationJobRecord): Promise<void> => {
    await backgroundJobs.enqueueJob({ workspaceId: job.workspaceId, jobType: 'publish.execute', payload: { publishJobId: job.id }, maxAttempts: 3 })
  }
}

export function createReconciliationEnqueuer(backgroundJobs: BackgroundJobRepository) {
  return async (workspaceId: string, publishJobId: string, runAfter?: string): Promise<void> => {
    await backgroundJobs.enqueueJob({ workspaceId, jobType: 'publish.reconcile', payload: { publishJobId }, maxAttempts: 20, ...(runAfter ? { runAfter } : {}) })
  }
}

export function createPublicationHandlers(deps: PublicationRuntimeDependencies): Record<'publish.execute' | 'publish.reconcile', JobHandler> {
  const enqueueReconciliation = createReconciliationEnqueuer(deps.backgroundJobs)
  const analyticsScheduler = createPostPublicationAnalyticsScheduler(deps.backgroundJobs)
  const onPublished = async (input: { workspaceId: string; contentVariantId: string; publishJobId: string }) => {
    try {
      await analyticsScheduler.schedule(input)
    } catch (error) {
      console.error('Post-publication analytics scheduling failed', error instanceof Error ? error.message : 'unknown error')
      try {
        await deps.audit.appendEvent({
          workspaceId: input.workspaceId,
          actorUserId: null,
          eventType: 'publication.analytics_schedule_failed',
          entityType: 'publish_job',
          entityId: input.publishJobId,
          correlationId: crypto.randomUUID(),
          metadata: { contentVariantId: input.contentVariantId },
        })
      } catch (auditError) {
        console.error('Publication analytics failure audit failed', auditError instanceof Error ? auditError.message : 'unknown error')
      }
    }

    try {
      await deps.audit.appendEvent({
        workspaceId: input.workspaceId,
        actorUserId: null,
        eventType: 'publication.published',
        entityType: 'publish_job',
        entityId: input.publishJobId,
        correlationId: crypto.randomUUID(),
        metadata: { contentVariantId: input.contentVariantId },
      })
    } catch (error) {
      console.error('Publication audit persistence failed', error instanceof Error ? error.message : 'unknown error')
    }
  }
  return {
    'publish.execute': createPublishPostHandler({ repository: deps.publicationRepository, mediaSource: deps.mediaSource, provider: deps.provider, assertCurrentApproval: deps.assertCurrentApproval, enqueueReconciliation, onPublished }),
    'publish.reconcile': createReconcilePublicationHandler({ repository: deps.publicationRepository, provider: deps.provider, assertCurrentApproval: deps.assertCurrentApproval, onPublished }),
  }
}

export function createAnalyticsHandlers(analytics: Pick<AnalyticsSyncService, 'syncPostAnalytics'>): Record<'analytics.post.sync', JobHandler> {
  return { 'analytics.post.sync': createSyncPostAnalyticsHandler(analytics) }
}

export type ApprovalGuardSource = { assertCurrentApproval(contentItemId: string): Promise<ApprovalDecisionRecord> }
export function approvalGuardFromService(service: ApprovalGuardSource): CurrentApprovalGuard { return (contentItemId) => service.assertCurrentApproval(contentItemId) }
