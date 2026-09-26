import { describe, expect, it, vi } from 'vitest'

import type { ApprovalDecisionRecord } from '../approval/types'
import { createPublicationService } from './publication-service'
import type {
  EnsurePublishJobInput,
  PublicationJobRecord,
  PublicationRepository,
  PublicationTarget,
} from './publication-service'

const platforms = ['instagram', 'facebook', 'tiktok', 'youtube'] as const

function approval(overrides: Partial<ApprovalDecisionRecord> = {}): ApprovalDecisionRecord {
  return {
    id: 'approval-1',
    workspaceId: 'workspace-1',
    contentItemId: 'content-1',
    decision: 'approved',
    reason: null,
    snapshot: {
      contentId: 'content-1',
      script: 'Approved script',
      mediaAssetIds: ['media-1'],
      variants: platforms.map((platform) => ({
        platform,
        caption: `${platform} caption`,
        title: platform === 'youtube' ? 'Title' : null,
        hashtags: [],
      })),
      targetAccountIds: platforms.map((platform) => `account-${platform}`),
      scheduledFor: '2026-08-18T18:30:00.000Z',
      publishMode: 'schedule',
    },
    snapshotHash: 'snapshot-hash-1',
    publishMode: 'schedule',
    decidedBy: 'owner-1',
    decidedAt: '2026-08-17T18:30:00.000Z',
    ...overrides,
  }
}

function targets(): PublicationTarget[] {
  return platforms.map((platform) => ({
    contentVariantId: `variant-${platform}`,
    platform,
    socialAccountId: `account-${platform}`,
  }))
}

function repository() {
  const jobs = new Map<string, PublicationJobRecord>()
  let sequence = 0

  const repo: PublicationRepository = {
    listPublicationTargets: vi.fn(async () => targets()),
    ensurePublishJob: vi.fn(async (input: EnsurePublishJobInput) => {
      const existing = jobs.get(input.idempotencyKey)
      if (existing) return { job: existing, created: false }
      sequence += 1
      const job: PublicationJobRecord = {
        id: `job-${sequence}`,
        ...input,
        status: 'queued',
      }
      jobs.set(input.idempotencyKey, job)
      return { job, created: true }
    }),
    markContentPublicationState: vi.fn(async () => undefined),
    getPublishJob: vi.fn(async (id) => [...jobs.values()].find((job) => job.id === id) ?? null),
    markForRetry: vi.fn(async (id) => {
      const current = [...jobs.values()].find((job) => job.id === id)
      if (!current) throw new Error('missing')
      current.status = 'retrying'
      return current
    }),
  }

  return repo
}

describe('publication service', () => {
  it('refuses content without a current exact approval', async () => {
    const repo = repository()
    const assertCurrentApproval = vi.fn(async () => {
      throw Object.assign(new Error('approval required'), { code: 'approval_required' })
    })
    const service = createPublicationService({
      repository: repo,
      assertCurrentApproval,
      enqueuePublishJob: vi.fn(),
    })

    await expect(service.createPublishJobs('content-1', { mode: 'schedule' })).rejects.toMatchObject({
      code: 'approval_required',
    })
    expect(repo.ensurePublishJob).not.toHaveBeenCalled()
  })

  it('creates exactly one reusable logical job per platform and enqueues only newly created jobs', async () => {
    const repo = repository()
    const enqueuePublishJob = vi.fn(async () => undefined)
    const service = createPublicationService({
      repository: repo,
      assertCurrentApproval: vi.fn(async () => approval()),
      enqueuePublishJob,
    })

    const first = await service.createPublishJobs('content-1', { mode: 'schedule' })
    const second = await service.createPublishJobs('content-1', { mode: 'schedule' })

    expect(first).toHaveLength(4)
    expect(first.map((job) => job.platform).sort()).toEqual([...platforms].sort())
    expect(second.map((job) => job.id)).toEqual(first.map((job) => job.id))
    expect(new Set(first.map((job) => job.idempotencyKey)).size).toBe(4)
    expect(enqueuePublishJob).toHaveBeenCalledTimes(4)
    expect(repo.listPublicationTargets).toHaveBeenCalledWith(
      'content-1',
      approval().snapshot.targetAccountIds,
    )
    expect(repo.markContentPublicationState).toHaveBeenCalledTimes(2)
  })

  it('derives schedule and publish mode only from the approved snapshot', async () => {
    const repo = repository()
    const service = createPublicationService({
      repository: repo,
      assertCurrentApproval: vi.fn(async () => approval()),
      enqueuePublishJob: vi.fn(),
    })

    const jobs = await service.createPublishJobs('content-1', { mode: 'schedule' })

    expect(jobs.every((job) => job.publishMode === 'schedule')).toBe(true)
    expect(jobs.every((job) => job.scheduledFor === '2026-08-18T18:30:00.000Z')).toBe(true)
    expect(jobs.every((job) => job.approvalId === 'approval-1')).toBe(true)
  })

  it('uses the approval decision time as stable execution time for immediate publishing', async () => {
    const repo = repository()
    const current = approval({
      publishMode: 'now',
      snapshot: { ...approval().snapshot, publishMode: 'now', scheduledFor: null },
      decidedAt: '2026-08-17T18:45:00.000Z',
    })
    const service = createPublicationService({
      repository: repo,
      assertCurrentApproval: vi.fn(async () => current),
      enqueuePublishJob: vi.fn(),
    })

    const jobs = await service.createPublishJobs('content-1', { mode: 'now' })

    expect(jobs.every((job) => job.scheduledFor === '2026-08-17T18:45:00.000Z')).toBe(true)
    expect(repo.markContentPublicationState).toHaveBeenCalledWith('content-1', 'now')
  })

  it('rejects a publish mode that differs from the approved snapshot', async () => {
    const repo = repository()
    const service = createPublicationService({
      repository: repo,
      assertCurrentApproval: vi.fn(async () => approval()),
      enqueuePublishJob: vi.fn(),
    })

    await expect(service.createPublishJobs('content-1', { mode: 'now' })).rejects.toMatchObject({
      code: 'publish_mode_mismatch',
    })
    expect(repo.ensurePublishJob).not.toHaveBeenCalled()
  })

  it('retries only retry-eligible failed jobs after rechecking approval', async () => {
    const repo = repository()
    const enqueuePublishJob = vi.fn(async () => undefined)
    const assertCurrentApproval = vi.fn(async () => approval())
    const service = createPublicationService({ repository: repo, assertCurrentApproval, enqueuePublishJob })
    const [job] = await service.createPublishJobs('content-1', { mode: 'schedule' })
    if (!job) throw new Error('missing job')
    job.status = 'failed'

    const retried = await service.retryPublishJob(job.id)

    expect(retried.id).toBe(job.id)
    expect(retried.status).toBe('retrying')
    expect(repo.markForRetry).toHaveBeenCalledWith(job.id)
    expect(assertCurrentApproval).toHaveBeenCalledWith('content-1')
  })
})
