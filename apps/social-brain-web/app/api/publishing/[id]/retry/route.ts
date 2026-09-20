import { createPublishingActionHandlers } from '../../../../../lib/publishing/actions'
import { createSupabasePublishingRuntime } from '../../../../../lib/publishing/runtime'
import { requireSupabaseOwner } from '../../../../../lib/auth/supabase-runtime'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params
  const runtime = await createSupabasePublishingRuntime()
  const handlers = createPublishingActionHandlers({
    requireOwner: requireSupabaseOwner,
    getPublishJob: runtime.publicationRepository.getPublishJob,
    retryPublishJob: runtime.publicationService.retryPublishJob,
    recordRetry: runtime.recordRetry,
  })

  return handlers.retry(id)
}
