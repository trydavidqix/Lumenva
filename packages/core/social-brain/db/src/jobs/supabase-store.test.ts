import { describe, expect, it, vi } from 'vitest'

import { createSupabaseBackgroundJobStore } from './repository'

function storedRow() {
  return {
    id: 'job-1',
    workspace_id: 'workspace-1',
    job_type: 'publish.execute',
    payload: { publishJobId: 'publish-1' },
    status: 'queued',
    attempt_count: 0,
    max_attempts: 3,
    run_after: '2026-08-17T18:30:00.000Z',
    locked_by: null,
    locked_at: null,
    last_error_code: null,
    last_error_message: null,
    completed_at: null,
    created_at: '2026-08-17T18:30:00.000Z',
    updated_at: '2026-08-17T18:30:00.000Z',
  }
}

describe('Supabase background job store', () => {
  it('maps enqueue input to the durable background_jobs row', async () => {
    const single = vi.fn(async () => ({ data: storedRow(), error: null }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    const client = { from, rpc: vi.fn() }
    const store = createSupabaseBackgroundJobStore(client as never)

    const result = await store.insert({
      workspaceId: 'workspace-1',
      jobType: 'publish.execute',
      payload: { publishJobId: 'publish-1' },
      maxAttempts: 3,
    })

    expect(from).toHaveBeenCalledWith('background_jobs')
    expect(insert).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      job_type: 'publish.execute',
      payload: { publishJobId: 'publish-1' },
      max_attempts: 3,
    })
    expect(result).toMatchObject({
      id: 'job-1',
      workspaceId: 'workspace-1',
      jobType: 'publish.execute',
      status: 'queued',
      attemptCount: 0,
    })
  })

  it('claims through the atomic claim_next_background_job RPC', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { ...storedRow(), status: 'running', attempt_count: 1, locked_by: 'worker-1' },
      error: null,
    }))
    const rpc = vi.fn(() => ({ maybeSingle }))
    const store = createSupabaseBackgroundJobStore({ rpc } as never)

    const claimed = await store.claim('worker-1')

    expect(rpc).toHaveBeenCalledWith('claim_next_background_job', { p_worker_id: 'worker-1' })
    expect(claimed).toMatchObject({ status: 'running', attemptCount: 1, lockedBy: 'worker-1' })
  })

  it('maps repository patches back to snake_case updates', async () => {
    const single = vi.fn(async () => ({ data: { ...storedRow(), status: 'failed' }, error: null }))
    const select = vi.fn(() => ({ single }))
    const eq = vi.fn(() => ({ select }))
    const update = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ update }))
    const store = createSupabaseBackgroundJobStore({ from } as never)

    await store.update('job-1', {
      status: 'failed',
      lockedBy: null,
      lastErrorCode: 'approval_stale',
      lastErrorMessage: 'Approval changed',
      completedAt: '2026-08-17T18:35:00.000Z',
    })

    expect(update).toHaveBeenCalledWith({
      status: 'failed',
      locked_by: null,
      last_error_code: 'approval_stale',
      last_error_message: 'Approval changed',
      completed_at: '2026-08-17T18:35:00.000Z',
    })
    expect(eq).toHaveBeenCalledWith('id', 'job-1')
  })
})
