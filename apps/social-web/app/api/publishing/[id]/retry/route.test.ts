import { describe, expect, it, vi } from 'vitest'

import { OwnerAuthError } from '../../../../../lib/auth/require-owner'
import { createPublishingActionHandlers } from '../../../../../lib/publishing/actions'

describe('publishing retry action', () => {
  it('rejects unauthenticated retries', async () => {
    const retryPublishJob = vi.fn()
    const handlers = createPublishingActionHandlers({
      requireOwner: vi.fn(async () => { throw new OwnerAuthError('unauthenticated') }),
      getPublishJob: vi.fn(),
      retryPublishJob,
    })

    const response = await handlers.retry('job-1')

    expect(response.status).toBe(401)
    expect(retryPublishJob).not.toHaveBeenCalled()
  })

  it('rejects a job outside the authenticated workspace', async () => {
    const retryPublishJob = vi.fn()
    const handlers = createPublishingActionHandlers({
      requireOwner: vi.fn(async () => ({ userId: 'owner-1', workspaceId: 'workspace-1' })),
      getPublishJob: vi.fn(async () => ({ id: 'job-1', workspaceId: 'workspace-other' })),
      retryPublishJob,
    })

    const response = await handlers.retry('job-1')

    expect(response.status).toBe(404)
    expect(retryPublishJob).not.toHaveBeenCalled()
  })

  it('enqueues retry only through the publication service', async () => {
    const retryPublishJob = vi.fn(async () => ({ id: 'job-1', status: 'retrying' }))
    const handlers = createPublishingActionHandlers({
      requireOwner: vi.fn(async () => ({ userId: 'owner-1', workspaceId: 'workspace-1' })),
      getPublishJob: vi.fn(async () => ({ id: 'job-1', workspaceId: 'workspace-1' })),
      retryPublishJob,
    })

    const response = await handlers.retry('job-1')

    expect(response.status).toBe(200)
    expect(retryPublishJob).toHaveBeenCalledWith('job-1')
    await expect(response.json()).resolves.toEqual({ ok: true, publishJobId: 'job-1' })
  })

  it('returns conflict when the job is not retry-eligible', async () => {
    const retryPublishJob = vi.fn(async () => {
      throw Object.assign(new Error('not retryable'), { code: 'publish_retry_not_allowed' })
    })
    const handlers = createPublishingActionHandlers({
      requireOwner: vi.fn(async () => ({ userId: 'owner-1', workspaceId: 'workspace-1' })),
      getPublishJob: vi.fn(async () => ({ id: 'job-1', workspaceId: 'workspace-1' })),
      retryPublishJob,
    })

    const response = await handlers.retry('job-1')

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ ok: false, code: 'publish_retry_not_allowed' })
  })
})
