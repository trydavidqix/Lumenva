import { createApprovalActionHandlers } from '../../../../../lib/approvals/actions'
import { createSupabaseApprovalActionDependencies } from '../../../../../lib/approvals/runtime'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const handlers = createApprovalActionHandlers(
    await createSupabaseApprovalActionDependencies(),
  )
  return handlers.approve(id)
}
