import type { AnalyticsSyncService } from '@lumenva/core'
import type { BackgroundJob, BackgroundJobRepository } from '@lumenva/db/jobs'

const CHECKPOINTS_MS = [60 * 60_000, 24 * 60 * 60_000, 7 * 24 * 60 * 60_000] as const

export type PostPublicationAnalyticsScheduler = {
  schedule(input: { workspaceId: string; contentVariantId: string }): Promise<void>
}

export function createPostPublicationAnalyticsScheduler(
  backgroundJobs: Pick<BackgroundJobRepository, 'enqueueJob'>,
  now: () => Date = () => new Date(),
): PostPublicationAnalyticsScheduler {
  return {
    async schedule(input) {
      const base = now().getTime()
      for (const offset of CHECKPOINTS_MS) {
        await backgroundJobs.enqueueJob({
          workspaceId: input.workspaceId,
          jobType: 'analytics.post.sync',
          payload: { contentVariantId: input.contentVariantId },
          maxAttempts: 3,
          runAfter: new Date(base + offset).toISOString(),
        })
      }
    },
  }
}

export function createSyncPostAnalyticsHandler(
  analytics: Pick<AnalyticsSyncService, 'syncPostAnalytics'>,
  now: () => Date = () => new Date(),
) {
  return async function syncPostAnalytics(job: BackgroundJob): Promise<void> {
    if (job.jobType !== 'analytics.post.sync') throw new Error('Expected analytics.post.sync job')
    const contentVariantId = job.payload.contentVariantId
    if (typeof contentVariantId !== 'string' || !contentVariantId.trim()) {
      throw new Error('analytics.post.sync requires contentVariantId')
    }
    await analytics.syncPostAnalytics(contentVariantId, now().toISOString())
  }
}
