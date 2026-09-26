import { createApprovalActionHandlers } from '../../../../../lib/approvals/actions'
import { createSupabaseApprovalActionDependencies } from '../../../../../lib/approvals/runtime'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const reason = await readReason(request)
  if (reason === null) {
    return new Response(JSON.stringify({ ok: false, code: 'invalid_request' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const handlers = createApprovalActionHandlers(
    await createSupabaseApprovalActionDependencies(),
  )
  return handlers.reject(id, reason)
}

async function readReason(request: Request): Promise<string | null> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as { reason?: unknown }
      return typeof body.reason === 'string' ? body.reason : null
    } catch {
      return null
    }
  }

  try {
    const form = await request.formData()
    const reason = form.get('reason')
    return typeof reason === 'string' ? reason : null
  } catch {
    return null
  }
}
