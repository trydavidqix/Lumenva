import { describe, expect, it, vi } from 'vitest'
import {
  createBackgroundJobRepository,
  type BackgroundJob,
  type BackgroundJobStore,
} from './repository'

function job(overrides: Partial<BackgroundJob> = {}): BackgroundJob {
  return {
    id: 'job-1',
    workspaceId: 'workspace-1',
    jobType: 'analytics.sync',
    payload: { accountId: 'account-1' },
    status: 'queued',
    attemptCount: 0,
    maxAttempts: 3,
    runAfter: '2026-08-17T12:00:00.000Z',
    lockedBy: null,
    lockedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    completedAt: null,
    ...overrides,
  }
}

function storeMock(): BackgroundJobStore {
  return {
    insert: vi.fn(async () => job()),
    claim: vi.fn(async () => null),
    update: vi.fn(async (_id, patch) => job(patch)),
  }
}

describe('background job repository', () => {
  it('enqueues a durable job through the store', async () => {
    const store = storeMock()
    const repository = createBackgroundJobRepository(store)

    await repository.enqueueJob({
      workspaceId: 'workspace-1',
      jobType: 'video.generate',
      payload: { contentItemId: 'content-1' },
      maxAttempts: 4,
      runAfter: '2026-08-17T13:00:00.000Z',
    })

    expect(store.insert).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      jobType: 'video.generate',
      payload: { contentItemId: 'content-1' },
      maxAttempts: 4,
      runAfter: '2026-08-17T13:00:00.000Z',
    })
  })

  it('delegates atomic claiming to the durable store', async () => {
    const claimed = job({ status: 'running', attemptCount: 1, lockedBy: 'worker-a' })
    const store = storeMock()
    vi.mocked(store.claim).mockResolvedValue(claimed)
    const repository = createBackgroundJobRepository(store)

    await expect(repository.claimNextJob('worker-a')).resolves.toEqual(claimed)
    expect(store.claim).toHaveBeenCalledWith('worker-a')
  })

  it('marks a completed job succeeded and clears its lock', async () => {
    const store = storeMock()
    const repository = createBackgroundJobRepository(store, () => new Date('2026-08-17T14:00:00.000Z'))

    await repository.completeJob('job-1')

    expect(store.update).toHaveBeenCalledWith('job-1', {
      status: 'succeeded',
      lockedBy: null,
      lockedAt: null,
      completedAt: '2026-08-17T14:00:00.000Z',
      lastErrorCode: null,
      lastErrorMessage: null,
    })
  })

  it('requeues a failed job when a next run is supplied', async () => {
    const store = storeMock()
    const repository = createBackgroundJobRepository(store)

    await repository.failJob(
      'job-1',
      { code: 'provider_timeout', message: 'Provider timed out' },
      '2026-08-17T14:05:00.000Z',
    )

    expect(store.update).toHaveBeenCalledWith('job-1', {
      status: 'queued',
      runAfter: '2026-08-17T14:05:00.000Z',
      lockedBy: null,
      lockedAt: null,
      completedAt: null,
      lastErrorCode: 'provider_timeout',
      lastErrorMessage: 'Provider timed out',
    })
  })

  it('marks a failure terminal when no retry is supplied', async () => {
    const store = storeMock()
    const repository = createBackgroundJobRepository(store, () => new Date('2026-08-17T14:00:00.000Z'))

    await repository.failJob('job-1', { code: 'invalid_payload', message: 'Invalid payload' })

    expect(store.update).toHaveBeenCalledWith('job-1', {
      status: 'failed',
      lockedBy: null,
      lockedAt: null,
      completedAt: '2026-08-17T14:00:00.000Z',
      lastErrorCode: 'invalid_payload',
      lastErrorMessage: 'Invalid payload',
    })
  })
})
