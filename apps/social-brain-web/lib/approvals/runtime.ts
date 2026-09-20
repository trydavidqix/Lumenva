import { createApprovalService } from '@lumenva/core'
import {
  createApprovalRepository,
  createSupabaseApprovalStore,
} from '@lumenva/db/approval'
import { createAuditRepository } from '@lumenva/db/audit'

import { requireSupabaseOwner } from '../auth/supabase-runtime'
import { createSupabaseServerClient } from '../supabase/server'
import { createSupabaseServiceRoleClient } from '../supabase/service-role'
import type { ApprovalActionDependencies } from './actions'

export async function createSupabaseApprovalActionDependencies(): Promise<ApprovalActionDependencies> {
  const supabase = await createSupabaseServerClient()
  const store = createSupabaseApprovalStore(supabase as never)
  const service = createApprovalService(createApprovalRepository(store))
  const audit = createAuditRepository(createSupabaseServiceRoleClient())

  return {
    requireOwner: requireSupabaseOwner,
    approveContent: service.approveContent,
    rejectContent: service.rejectContent,
    async recordDecision(owner, contentItemId, decision, approvalId) {
      await audit.appendEvent({
        workspaceId: owner.workspaceId,
        actorUserId: owner.userId,
        eventType: `approval.${decision}`,
        entityType: 'content_item',
        entityId: contentItemId,
        correlationId: crypto.randomUUID(),
        metadata: { approvalId },
      })
    },
  }
}
