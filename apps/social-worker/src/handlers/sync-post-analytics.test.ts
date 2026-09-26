import { describe, expect, it } from 'vitest'

import { createPostPublicationAnalyticsScheduler } from './sync-post-analytics'

describe('post-publication analytics scheduling', () => {
  it('enqueues bounded follow-up checkpoints using the existing durable queue', async () => {
    const jobs: Array<{ jobType: string; runAfter?: string; payload: Record<string, unknown> }> = []
    const scheduler = createPostPublicationAnalyticsScheduler({
      enqueueJob: async (input) => {
        const job = { jobType: input.jobType, payload: input.payload } as {
          jobType: string
          runAfter?: string
          payload: Record<string, unknown>
        }
        if (input.runAfter !== undefined) job.runAfter = input.runAfter
        jobs.push(job)
        return {} as never
      },
    }, () => new Date('2026-08-17T20:00:00.000Z'))

    await scheduler.schedule({ workspaceId: 'w1', contentVariantId: 'v1' })

    expect(jobs).toHaveLength(3)
    expect(jobs.every((job) => job.jobType === 'analytics.post.sync')).toBe(true)
    expect(jobs.map((job) => job.payload.contentVariantId)).toEqual(['v1', 'v1', 'v1'])
  })
})