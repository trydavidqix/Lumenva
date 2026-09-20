import { OwnerAuthError, type OwnerContext } from '../auth/require-owner'

type PublishJobIdentity = { id: string; workspaceId: string }

type PublishingActionDependencies = {
  requireOwner: () => Promise<OwnerContext>
  getPublishJob: (id: string) => Promise<PublishJobIdentity | null>
  retryPublishJob: (id: string) => Promise<{ id: string }>
  recordRetry?: (owner: OwnerContext, publishJobId: string) => Promise<void>
}

export function createPublishingActionHandlers(deps: PublishingActionDependencies) {
  return {
    async retry(publishJobId: string): Promise<Response> {
      try {
        const owner = await deps.requireOwner()
        const job = await deps.getPublishJob(publishJobId)
        if (!job || job.workspaceId !== owner.workspaceId) {
          return json({ ok: false, code: 'publish_job_not_found' }, 404)
        }

        const retried = await deps.retryPublishJob(publishJobId)
        await recordRetryBestEffort(deps, owner, retried.id)
        return json({ ok: true, publishJobId: retried.id }, 200)
      } catch (error) {
        if (error instanceof OwnerAuthError) {
          return json({ ok: false, code: error.code }, error.code === 'unauthenticated' ? 401 : 403)
        }
        const code = readCode(error)
        switch (code) {
          case 'publish_job_not_found': return json({ ok: false, code }, 404)
          case 'publish_retry_not_allowed':
          case 'approval_stale':
          case 'approval_required': return json({ ok: false, code }, 409)
          default: return json({ ok: false, code: 'publish_retry_failed' }, 500)
        }
      }
    },
  }
}

async function recordRetryBestEffort(
  deps: PublishingActionDependencies,
  owner: OwnerContext,
  publishJobId: string,
): Promise<void> {
  if (!deps.recordRetry) return
  try {
    await deps.recordRetry(owner, publishJobId)
  } catch (error) {
    console.error('Publication retry audit persistence failed', error instanceof Error ? error.message : 'unknown error')
  }
}

function readCode(error: unknown): string | null {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : null
  }
  return null
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
