import { OwnerAuthError, type OwnerContext } from '../auth/require-owner'

type ApprovalDecisionLike = { id: string }
type ApprovalErrorLike = Error & { code?: string }

export type ApprovalActionDependencies = {
  requireOwner: () => Promise<OwnerContext>
  approveContent: (contentItemId: string, userId: string) => Promise<ApprovalDecisionLike>
  rejectContent: (contentItemId: string, userId: string, reason: string) => Promise<ApprovalDecisionLike>
  recordDecision?: (
    owner: OwnerContext,
    contentItemId: string,
    decision: 'approved' | 'rejected',
    approvalId: string,
  ) => Promise<void>
}

export function createApprovalActionHandlers(dependencies: ApprovalActionDependencies) {
  return {
    async approve(contentItemId: string): Promise<Response> {
      try {
        const owner = await dependencies.requireOwner()
        const approval = await dependencies.approveContent(contentItemId, owner.userId)
        await recordDecisionBestEffort(dependencies, owner, contentItemId, 'approved', approval.id)
        return json({ ok: true, approvalId: approval.id }, 200)
      } catch (error) {
        return mapActionError(error)
      }
    },

    async reject(contentItemId: string, reason: string): Promise<Response> {
      const normalizedReason = reason.trim()
      if (!normalizedReason) return json({ ok: false, code: 'rejection_reason_required' }, 400)

      try {
        const owner = await dependencies.requireOwner()
        const approval = await dependencies.rejectContent(contentItemId, owner.userId, normalizedReason)
        await recordDecisionBestEffort(dependencies, owner, contentItemId, 'rejected', approval.id)
        return json({ ok: true, approvalId: approval.id }, 200)
      } catch (error) {
        return mapActionError(error)
      }
    },
  }
}

async function recordDecisionBestEffort(
  dependencies: ApprovalActionDependencies,
  owner: OwnerContext,
  contentItemId: string,
  decision: 'approved' | 'rejected',
  approvalId: string,
): Promise<void> {
  if (!dependencies.recordDecision) return
  try {
    await dependencies.recordDecision(owner, contentItemId, decision, approvalId)
  } catch (error) {
    console.error('Approval audit persistence failed', error instanceof Error ? error.message : 'unknown error')
  }
}

function mapActionError(error: unknown): Response {
  if (error instanceof OwnerAuthError) {
    return json({ ok: false, code: error.code }, error.code === 'unauthenticated' ? 401 : 403)
  }
  const code = error instanceof Error && 'code' in error ? (error as ApprovalErrorLike).code : undefined
  switch (code) {
    case 'owner_required': return json({ ok: false, code }, 403)
    case 'content_not_found': return json({ ok: false, code }, 404)
    case 'approval_stale':
    case 'approval_required':
    case 'approval_not_requested':
    case 'content_not_ready':
    case 'approval_snapshot_invalid': return json({ ok: false, code }, 409)
    default: return json({ ok: false, code: 'approval_action_failed' }, 500)
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
