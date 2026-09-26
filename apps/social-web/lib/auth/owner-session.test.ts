import { describe, expect, it } from 'vitest'
import { OwnerSessionError, loginOwner } from './owner-session'

describe('loginOwner', () => {
  it('rejects invalid credentials without exposing provider details', async () => {
    const auth = {
      signInWithPassword: async () => null,
      signOut: async () => undefined,
    }

    const workspaces = {
      findOwnedWorkspace: async () => null,
    }

    await expect(
      loginOwner({ auth, workspaces }, { email: 'owner@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' } satisfies Partial<OwnerSessionError>)
  })

  it('signs out an authenticated user that does not own the workspace', async () => {
    let signedOut = false
    const auth = {
      signInWithPassword: async () => 'user-not-owner',
      signOut: async () => {
        signedOut = true
      },
    }

    const workspaces = {
      findOwnedWorkspace: async () => null,
    }

    await expect(
      loginOwner({ auth, workspaces }, { email: 'user@example.com', password: 'valid' }),
    ).rejects.toMatchObject({ code: 'NOT_OWNER' } satisfies Partial<OwnerSessionError>)
    expect(signedOut).toBe(true)
  })

  it('returns the owner workspace for valid owner credentials', async () => {
    const auth = {
      signInWithPassword: async () => 'owner-user-id',
      signOut: async () => undefined,
    }

    const workspaces = {
      findOwnedWorkspace: async (userId: string) =>
        userId === 'owner-user-id'
          ? { id: 'workspace-1', name: 'Lumenva Social Brain', ownerUserId: userId }
          : null,
    }

    await expect(
      loginOwner({ auth, workspaces }, { email: 'owner@example.com', password: 'valid' }),
    ).resolves.toEqual({
      id: 'workspace-1',
      name: 'Lumenva Social Brain',
      ownerUserId: 'owner-user-id',
    })
  })
})