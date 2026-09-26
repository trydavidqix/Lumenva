import { describe, expect, it } from 'vitest'
import { OwnerAuthError, requireOwner } from './require-owner'

describe('requireOwner', () => {
  it('rejects when there is no authenticated session', async () => {
    await expect(
      requireOwner({
        getAuthenticatedUserId: async () => null,
        findWorkspaceByOwnerUserId: async () => null,
      }),
    ).rejects.toMatchObject({ code: 'unauthenticated' } satisfies Pick<OwnerAuthError, 'code'>)
  })

  it('rejects an authenticated user who does not own the workspace', async () => {
    await expect(
      requireOwner({
        getAuthenticatedUserId: async () => 'user-not-owner',
        findWorkspaceByOwnerUserId: async () => null,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' } satisfies Pick<OwnerAuthError, 'code'>)
  })

  it('returns owner context for the workspace owner', async () => {
    await expect(
      requireOwner({
        getAuthenticatedUserId: async () => 'owner-1',
        findWorkspaceByOwnerUserId: async () => ({ id: 'workspace-1', ownerUserId: 'owner-1' }),
      }),
    ).resolves.toEqual({ userId: 'owner-1', workspaceId: 'workspace-1' })
  })
})