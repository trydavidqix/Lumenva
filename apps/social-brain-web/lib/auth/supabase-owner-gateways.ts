import type { OwnerWorkspace } from './owner-session'

type SupabaseAuthResult = {
  data: { user: { id: string } | null }
  error: unknown | null
}

type SupabaseSignOutResult = {
  error: unknown | null
}

type SupabaseWorkspaceRow = {
  id: string
  name: string
  owner_user_id: string
}

export type SupabaseOwnerClient = {
  auth: {
    signInWithPassword(credentials: {
      email: string
      password: string
    }): Promise<SupabaseAuthResult>
    signOut(): Promise<SupabaseSignOutResult>
  }
  findOwnedWorkspace(userId: string): Promise<SupabaseWorkspaceRow | null>
}

export function createSupabaseOwnerGateways(client: SupabaseOwnerClient) {
  return {
    auth: {
      async signInWithPassword(email: string, password: string): Promise<string | null> {
        const { data, error } = await client.auth.signInWithPassword({ email, password })

        if (error || !data.user) {
          return null
        }

        return data.user.id
      },
      async signOut(): Promise<void> {
        const { error } = await client.auth.signOut()
        if (error) {
          throw error
        }
      },
    },
    workspaces: {
      async findOwnedWorkspace(userId: string): Promise<OwnerWorkspace | null> {
        const row = await client.findOwnedWorkspace(userId)

        if (!row) {
          return null
        }

        return {
          id: row.id,
          name: row.name,
          ownerUserId: row.owner_user_id,
        }
      },
    },
  }
}
