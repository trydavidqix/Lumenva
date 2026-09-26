import { describe, expect, it } from 'vitest'
import { resolveTenantContext, type TenantIdentityRepositories } from './tenant-resolution'

const repos: TenantIdentityRepositories = {
  verifySession: async () => ({ firebaseUid: 'firebase-a', userId: 'user-a' }),
  findIdentityMapping: async () => ({ userId: 'user-a', active: true }),
  findActiveMembership: async () => ({ organizationId: 'org-a', role: 'manager', active: true }),
  isPlatformAdmin: async () => false,
}

describe('resolveTenantContext', () => {
  it('resolves Firebase session through mapping and active membership', async () => {
    await expect(resolveTenantContext('session-a', 'request-1', repos)).resolves.toEqual({
      userId: 'user-a',
      organizationId: 'org-a',
      role: 'manager',
      isPlatformAdmin: false,
      requestId: 'request-1',
      authSource: 'firebase-session',
    })
  })

  it('does not trust session user identity when mapping differs', async () => {
    const mismatch: TenantIdentityRepositories = {
      ...repos,
      findIdentityMapping: async () => ({ userId: 'user-b', active: true }),
    }
    await expect(resolveTenantContext('session-a', 'request-1', mismatch)).rejects.toThrow(
      'TenantContext: identity mapping not found',
    )
  })

  it('returns one not-found error for inactive or cross-tenant membership', async () => {
    const inactive: TenantIdentityRepositories = {
      ...repos,
      findActiveMembership: async () => null,
    }
    await expect(resolveTenantContext('session-a', 'request-1', inactive)).rejects.toThrow(
      'TenantContext: not found',
    )
  })

  it('does not grant platform-admin authority from ordinary Firebase resolution', async () => {
    const platformAdmin = { ...repos, isPlatformAdmin: async () => true }
    await expect(resolveTenantContext('session-a', 'request-1', platformAdmin)).resolves.toMatchObject({
      isPlatformAdmin: true,
      authSource: 'firebase-session',
    })
  })
})
