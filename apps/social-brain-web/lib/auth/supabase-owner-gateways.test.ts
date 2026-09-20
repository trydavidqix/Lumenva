import { describe, expect, it } from 'vitest'
import { createSupabaseOwnerGateways } from './supabase-owner-gateways'

describe('createSupabaseOwnerGateways', () => {
  it('maps a Supabase auth user to the owner-session user id', async () => {
    const client = {
      auth: {
        signInWithPassword: async () => ({ data: { user: { id: 'owner-123' } }, error: null }),
        signOut: async () => ({ error: null }),
      },
      findOwnedWorkspace: async () => null,
    }

    const gateways = createSupabaseOwnerGateways(client)

    await expect(gateways.auth.signInWithPassword('owner@example.com', 'secret')).resolves.toBe(
      'owner-123',
    )
  })

  it('returns null when Supabase rejects the credentials', async () => {
    const client = {
      auth: {
        signInWithPassword: async () => ({ data: { user: null }, error: new Error('provider detail') }),
        signOut: async () => ({ error: null }),
      },
      findOwnedWorkspace: async () => null,
    }

    const gateways = createSupabaseOwnerGateways(client)

    await expect(gateways.auth.signInWithPassword('owner@example.com', 'wrong')).resolves.toBeNull()
  })

  it('maps the database owner row to the provider-neutral workspace type', async () => {
    const client = {
      auth: {
        signInWithPassword: async () => ({ data: { user: { id: 'owner-123' } }, error: null }),
        signOut: async () => ({ error: null }),
      },
      findOwnedWorkspace: async () => ({
        id: 'workspace-1',
        name: 'Lumenva Social Brain',
        owner_user_id: 'owner-123',
      }),
    }

    const gateways = createSupabaseOwnerGateways(client)

    await expect(gateways.workspaces.findOwnedWorkspace('owner-123')).resolves.toEqual({
      id: 'workspace-1',
      name: 'Lumenva Social Brain',
      ownerUserId: 'owner-123',
    })
  })
})
