import { createSupabaseServerClient } from '../supabase/server'
import { loginOwner } from './owner-session'
import { requireOwner } from './require-owner'
import { createSupabaseOwnerClient } from './supabase-owner-client'
import { createSupabaseOwnerGateways } from './supabase-owner-gateways'

type OwnerSupabaseBoundary = Parameters<typeof createSupabaseOwnerClient>[0]

function toOwnerBoundary(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  return supabase as unknown as OwnerSupabaseBoundary
}

export async function loginSupabaseOwner(email: string, password: string) {
  const supabase = await createSupabaseServerClient()
  const ownerClient = createSupabaseOwnerClient(toOwnerBoundary(supabase))
  const gateways = createSupabaseOwnerGateways(ownerClient)

  return loginOwner(gateways, { email, password })
}

export async function requireSupabaseOwner() {
  const supabase = await createSupabaseServerClient()
  const ownerClient = createSupabaseOwnerClient(toOwnerBoundary(supabase))

  return requireOwner({
    async getAuthenticatedUserId() {
      const { data, error } = await supabase.auth.getClaims()
      const subject = data?.claims?.sub

      if (error || typeof subject !== 'string' || subject.length === 0) {
        return null
      }

      return subject
    },
    async findWorkspaceByOwnerUserId(userId) {
      const workspace = await ownerClient.findOwnedWorkspace(userId)

      if (!workspace) {
        return null
      }

      return {
        id: workspace.id,
        ownerUserId: workspace.owner_user_id,
      }
    },
  })
}
