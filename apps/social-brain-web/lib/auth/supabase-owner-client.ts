import type { SupabaseOwnerClient } from './supabase-owner-gateways'

type WorkspaceRow = {
  id: string
  name: string
  owner_user_id: string
}

type SupabaseLike = {
  auth: SupabaseOwnerClient['auth']
  from(table: 'workspaces'): {
    select(columns: 'id,name,owner_user_id'): {
      eq(column: 'owner_user_id', value: string): {
        maybeSingle(): Promise<{ data: WorkspaceRow | null; error: unknown | null }>
      }
    }
  }
}

export function createSupabaseOwnerClient(supabase: SupabaseLike): SupabaseOwnerClient {
  return {
    auth: supabase.auth,
    async findOwnedWorkspace(userId: string) {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id,name,owner_user_id')
        .eq('owner_user_id', userId)
        .maybeSingle()

      if (error) {
        throw error
      }

      return data
    },
  }
}
