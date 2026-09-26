import { describe, expect, it, vi } from 'vitest'

import { OwnerAuthError } from '../../../../../lib/auth/require-owner'
import { createApprovalActionHandlers } from '../../../../../lib/approvals/actions'

describe('approval action handlers', () => {
  it('rejects unauthenticated approval attempts', async () => {
    const approveContent = vi.fn()
    const handlers = createApprovalActionHandlers({
      requireOwner: vi.fn(async () => {
        throw new OwnerAuthError('unauthenticated')
      }),
      approveContent,
      rejectContent: vi.fn(),
    })

    const response = await handlers.approve('content-1')

    expect(response.status).toBe(401)
    expect(approveContent).not.toHaveBeenCalled()
  })

  it('approves with the authenticated owner identity only', async () => {
    const approveContent = vi.fn(async () => ({ id: 'approval-1' }))
    const handlers = createApprovalActionHandlers({
      requireOwner: vi.fn(async () => ({ userId: 'owner-1', workspaceId: 'workspace-1' })),
      approveContent,
      rejectContent: vi.fn(),
    })

    const response = await handlers.approve('content-1')

    expect(response.status).toBe(200)
    expect(approveContent).toHaveBeenCalledWith('content-1', 'owner-1')
    await expect(response.json()).resolves.toEqual({ ok: true, approvalId: 'approval-1' })
  })

  it('does not report an already-committed approval as failed when audit persistence fails', async () => {
    const approveContent = vi.fn(async () => ({ id: 'approval-1' }))
    const handlers = createApprovalActionHandlers({
      requireOwner: vi.fn(async () => ({ userId: 'owner-1', workspaceId: 'workspace-1' })),
      approveContent,
      rejectContent: vi.fn(),
      recordDecision: vi.fn(async () => {
        throw new Error('audit unavailable')
      }),
    })

    const response = await handlers.approve('content-1')

    expect(approveContent).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, approvalId: 'approval-1' })
  })

  it('returns conflict for stale approval state without approving', async () => {
    const error = Object.assign(new Error('stale'), { code: 'approval_stale' })
    const approveContent = vi.fn(async () => {
      throw error
    })
    const handlers = createApprovalActionHandlers({
      requireOwner: vi.fn(async () => ({ userId: 'owner-1', workspaceId: 'workspace-1' })),
      approveContent,
      rejectContent: vi.fn(),
    })

    const response = await handlers.approve('content-1')

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ ok: false, code: 'approval_stale' })
  })

  it('requires a non-empty rejection reason', async () => {
    const rejectContent = vi.fn()
    const handlers = createApprovalActionHandlers({
      requireOwner: vi.fn(async () => ({ userId: 'owner-1', workspaceId: 'workspace-1' })),
      approveContent: vi.fn(),
      rejectContent,
    })

    const response = await handlers.reject('content-1', '   ')

    expect(response.status).toBe(400)
    expect(rejectContent).not.toHaveBeenCalled()
  })
})
