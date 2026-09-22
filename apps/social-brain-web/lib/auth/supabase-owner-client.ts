import type { SupabaseOwnerClient } from './supabase-owner-gateways'

type WorkspaceRow = {
  id: string
  name: string
  owner_user_id: string
}

type SupabaseLike = {
  auth: SupabaseOwnerClient['auth']
  from(table: 'user_organizations'): {
    select(columns: 'organization_id'): {
      eq(column: 'user_id', value: string): {
        limit(count: number): {
          maybeSingle(): Promise<{ data: { organization_id: string } | null; error: unknown | null }>
        }
      }
    }
  }
}

export function createSupabaseOwnerClient(supabase: SupabaseLike): SupabaseOwnerClient {
  return {
    auth: supabase.auth,
    async findOwnedWorkspace(userId: string) {
      const { data, error } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle() as any

      if (error) {
        throw error
      }

      if (!data) return null

      return {
        id: data.organization_id,
        name: 'Workspace',
        owner_user_id: userId
      }
    },
  }
}
