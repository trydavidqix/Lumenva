import { describe, expect, it } from 'vitest'
import { createSupabaseOwnerClient } from './supabase-owner-client'

describe('createSupabaseOwnerClient', () => {
  it('queries the workspace by authenticated owner user id', async () => {
    let filteredOwnerId: string | null = null

    const supabase = {
      auth: {
        signInWithPassword: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({
          eq: (_column: string, value: string) => {
            filteredOwnerId = value
            return {
              limit: () => ({
              maybeSingle: async () => ({
                data: {
                  organization_id: 'workspace-1',
                },
                error: null,
              }),
              }),
            }
          },
        }),
      }),
    }

    const client = createSupabaseOwnerClient(supabase)
    const workspace = await client.findOwnedWorkspace('owner-123')

    expect(filteredOwnerId).toBe('owner-123')
    expect(workspace).toEqual({
      id: 'workspace-1',
      name: 'Lumenva Social Brain',
      owner_user_id: 'owner-123',
    })
  })

  it('fails closed when the workspace query fails', async () => {
    const supabase = {
      auth: {
        signInWithPassword: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: () => ({
            maybeSingle: async () => ({ data: null, error: new Error('database failure') }),
            }),
          }),
        }),
      }),
    }

    const client = createSupabaseOwnerClient(supabase)

    await expect(client.findOwnedWorkspace('owner-123')).rejects.toThrow('database failure')
  })
})
