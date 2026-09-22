import { describe, expect, it, vi } from 'vitest'
import { createTenantIdentityRepositories } from './identity-repository'

describe('tenant identity repositories', () => {
  it('resolves Firebase UID through mapping, active membership and platform-admin lookup', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ user_id: 'user-a' }])
      .mockResolvedValueOnce([{ organization_id: 'org-a', role: 'manager', active: true }])
      .mockResolvedValueOnce([])
    const repositories = createTenantIdentityRepositories(
      { query },
      async (token) => ({ firebaseUid: token }),
    )

    await expect(repositories.verifySession('firebase-a')).resolves.toEqual({ firebaseUid: 'firebase-a' })
    await expect(repositories.findIdentityMapping('firebase-a')).resolves.toEqual({ userId: 'user-a', active: true })
    await expect(repositories.findActiveMembership('user-a', 'org-a')).resolves.toEqual({
      organizationId: 'org-a', role: 'manager', active: true,
    })
    await expect(repositories.isPlatformAdmin('user-a')).resolves.toBe(false)
    expect(query).toHaveBeenNthCalledWith(1, {
      text: 'select public.resolve_firebase_identity($1) as user_id',
      values: ['firebase-a'],
    })
  })
})
