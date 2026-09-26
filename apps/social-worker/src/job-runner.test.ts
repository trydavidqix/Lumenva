import { describe, expect, it, vi } from 'vitest'
import type { BackgroundJob, BackgroundJobRepository } from '@lumenva/db/jobs'
import { createJobRunner } from './job-runner'

function job(overrides: Partial<BackgroundJob> = {}): BackgroundJob {
  return {
    id: 'job-1',
    workspaceId: 'workspace-1',
    jobType: 'analytics.sync',
    payload: { accountId: 'account-1' },
    status: 'running',
    attemptCount: 1,
    maxAttempts: 3,
    runAfter: '2026-08-17T12:00:00.000Z',
    lockedBy: 'worker-a',
    lockedAt: '2026-08-17T12:00:00.000Z',
    lastErrorCode: null,
    lastErrorMessage: null,
    completedAt: null,
    ...overrides,
  }
}

function repositoryMock(): BackgroundJobRepository {
  return {
    enqueueJob: vi.fn(),
    claimNextJob: vi.fn(async () => null),
    completeJob: vi.fn(async () => job({ status: 'succeeded' })),
    failJob: vi.fn(async () => job({ status: 'failed' })),
  }
}

describe('job runner', () => {
  it('returns idle when there is no durable job to claim', async () => {
    const repository = repositoryMock()
    const runner = createJobRunner({
      workerId: 'worker-a',
      repository,
      handlers: {},
    })

    await expect(runner.runOnce()).resolves.toBe(false)
    expect(repository.claimNextJob).toHaveBeenCalledWith('worker-a')
  })

  it('dispatches the claimed job and completes it', async () => {
    const repository = repositoryMock()
    const claimed = job()
    vi.mocked(repository.claimNextJob).mockResolvedValue(claimed)
    const handler = vi.fn(async () => undefined)
    const runner = createJobRunner({
      workerId: 'worker-a',
      repository,
      handlers: { 'analytics.sync': handler },
    })

    await expect(runner.runOnce()).resolves.toBe(true)
    expect(handler).toHaveBeenCalledWith(claimed)
    expect(repository.completeJob).toHaveBeenCalledWith('job-1')
    expect(repository.failJob).not.toHaveBeenCalled()
  })

  it('requeues a transient handler failure while attempts remain', async () => {
    const repository = repositoryMock()
    vi.mocked(repository.claimNextJob).mockResolvedValue(job({ attemptCount: 1, maxAttempts: 3 }))
    const runner = createJobRunner({
      workerId: 'worker-a',
      repository,
      handlers: {
        'analytics.sync': vi.fn(async () => {
          throw new Error('temporary outage')
        }),
      },
      retryDelayMs: 60_000,
      now: () => new Date('2026-08-17T14:00:00.000Z'),
    })

    await expect(runner.runOnce()).resolves.toBe(true)
    expect(repository.failJob).toHaveBeenCalledWith(
      'job-1',
      { code: 'handler_failed', message: 'temporary outage' },
      '2026-08-17T14:01:00.000Z',
    )
  })

  it('does not requeue an explicitly terminal handler failure', async () => {
    const repository = repositoryMock()
    vi.mocked(repository.claimNextJob).mockResolvedValue(job({ attemptCount: 1, maxAttempts: 3 }))
    const terminal = Object.assign(new Error('video request was rejected'), {
      code: 'validation_failed',
      retryable: false,
    })
    const runner = createJobRunner({
      workerId: 'worker-a',
      repository,
      handlers: {
        'analytics.sync': vi.fn(async () => {
          throw terminal
        }),
      },
      retryDelayMs: 60_000,
      now: () => new Date('2026-08-17T14:00:00.000Z'),
    })

    await expect(runner.runOnce()).resolves.toBe(true)
    expect(repository.failJob).toHaveBeenCalledWith('job-1', {
      code: 'validation_failed',
      message: 'video request was rejected',
    })
    expect(repository.failJob).not.toHaveBeenCalledWith(
      'job-1',
      expect.anything(),
      '2026-08-17T14:01:00.000Z',
    )
  })

  it('marks the job terminal when the max attempt has been reached', async () => {
    const repository = repositoryMock()
    vi.mocked(repository.claimNextJob).mockResolvedValue(job({ attemptCount: 3, maxAttempts: 3 }))
    const runner = createJobRunner({
      workerId: 'worker-a',
      repository,
      handlers: {
        'analytics.sync': vi.fn(async () => {
          throw new Error('still down')
        }),
      },
    })

    await runner.runOnce()
    expect(repository.failJob).toHaveBeenCalledWith(
      'job-1',
      { code: 'handler_failed', message: 'still down' },
    )
  })

  it('does not retry an unknown job type', async () => {
    const repository = repositoryMock()
    vi.mocked(repository.claimNextJob).mockResolvedValue(job({ jobType: 'unknown.job' }))
    const runner = createJobRunner({
      workerId: 'worker-a',
      repository,
      handlers: {},
    })

    await runner.runOnce()
    expect(repository.failJob).toHaveBeenCalledWith(
      'job-1',
      { code: 'unknown_job_type', message: 'No handler registered for unknown.job' },
    )
  })

  it('keeps polling bounded by maxIterations', async () => {
    const repository = repositoryMock()
    const sleep = vi.fn(async () => undefined)
    const runner = createJobRunner({
      workerId: 'worker-a',
      repository,
      handlers: {},
      sleep,
    })

    await expect(runner.run({ maxIterations: 3, idleDelayMs: 5 })).resolves.toBe(0)
    expect(repository.claimNextJob).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })
})
