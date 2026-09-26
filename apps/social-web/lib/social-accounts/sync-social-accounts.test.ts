import { describe, expect, it, vi } from 'vitest'

import type { StoredSocialAccount } from '@lumenva/core'

import { syncSocialAccountsForOwner } from './sync-social-accounts'

const storedAccounts: StoredSocialAccount[] = [
  {
    id: 'local-1',
    workspaceId: '7a3e7d8e-45b7-4a89-9e92-0e9f8dcd9d01',
    provider: 'brightbean',
    providerAccountId: 'ig-1',
    externalAccountId: null,
    platform: 'instagram',
    displayName: '@lumenva',
    status: 'active',
  },
]

const ownerWorkspaceId = '7a3e7d8e-45b7-4a89-9e92-0e9f8dcd9d01'
const otherWorkspaceId = 'a5c2e0d4-7c86-4ff6-b4f7-90335fcbec12'
const bindingEnv = { SOCIAL_BRAIN_WORKSPACE_ID: ownerWorkspaceId }
const brightBeanEnv = {
  ...bindingEnv,
  BRIGHTBEAN_BASE_URL: 'https://brightbean.example.test',
  BRIGHTBEAN_API_KEY: 'server-secret',
  BRIGHTBEAN_WORKSPACE_ID: '831e88b5-087e-4fd3-a7d3-a17510fb5f12',
}

describe('syncSocialAccountsForOwner', () => {
  it('uses the authenticated workspace with the existing account service boundary', async () => {
    const syncSocialAccounts = vi.fn(async () => storedAccounts)

    const result = await syncSocialAccountsForOwner({
      workspaceId: ownerWorkspaceId,
      env: bindingEnv,
      service: { syncSocialAccounts },
    })

    expect(syncSocialAccounts).toHaveBeenCalledWith(ownerWorkspaceId)
    expect(result).toEqual({
      ok: true,
      syncedCount: 1,
      message: null,
      accounts: storedAccounts,
    })
  })

  it('returns only the safe account mapping shape and no provider OAuth token fields', async () => {
    const result = await syncSocialAccountsForOwner({
      workspaceId: ownerWorkspaceId,
      env: bindingEnv,
      service: { syncSocialAccounts: async () => storedAccounts },
    })

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('access_token')
    expect(serialized).not.toContain('refresh_token')
    expect(serialized).not.toContain('server-secret')
  })

  it('returns a retryable safe result when the provider synchronization fails', async () => {
    const result = await syncSocialAccountsForOwner({
      workspaceId: ownerWorkspaceId,
      env: bindingEnv,
      service: {
        syncSocialAccounts: async () => {
          throw new Error('upstream token=super-secret')
        },
      },
    })

    expect(result).toEqual({
      ok: false,
      syncedCount: 0,
      message: 'Não foi possível sincronizar as contas sociais agora. Tente novamente em alguns instantes.',
      accounts: [],
    })
    expect(JSON.stringify(result)).not.toContain('super-secret')
  })

  it('does not attempt a runtime sync when BrightBean server configuration is missing', async () => {
    const result = await syncSocialAccountsForOwner({
      workspaceId: ownerWorkspaceId,
      env: {
        ...bindingEnv,
        BRIGHTBEAN_BASE_URL: '',
        BRIGHTBEAN_API_KEY: '',
      },
    })

    expect(result.ok).toBe(false)
    expect(result.message).toBe('A sincronização das contas sociais ainda não está configurada neste ambiente.')
  })

  it('does not attempt a runtime sync when the BrightBean workspace identity is missing', async () => {
    const result = await syncSocialAccountsForOwner({
      workspaceId: ownerWorkspaceId,
      env: { ...brightBeanEnv, BRIGHTBEAN_WORKSPACE_ID: '' },
    })

    expect(result.ok).toBe(false)
    expect(result.message).toBe('A sincronização das contas sociais ainda não está configurada neste ambiente.')
  })

  it('rejects an empty workspace without touching the service', async () => {
    const syncSocialAccounts = vi.fn(async () => storedAccounts)
    const result = await syncSocialAccountsForOwner({
      workspaceId: '   ',
      env: bindingEnv,
      service: { syncSocialAccounts },
    })

    expect(result.ok).toBe(false)
    expect(syncSocialAccounts).not.toHaveBeenCalled()
  })

  it('does not sync or persist accounts for a workspace outside the configured binding', async () => {
    const syncSocialAccounts = vi.fn(async () => storedAccounts)

    const result = await syncSocialAccountsForOwner({
      workspaceId: otherWorkspaceId,
      env: bindingEnv,
      service: { syncSocialAccounts },
    })

    expect(result).toEqual({
      ok: false,
      syncedCount: 0,
      message: 'Este workspace não está autorizado para a integração de contas sociais.',
      accounts: [],
    })
    expect(syncSocialAccounts).not.toHaveBeenCalled()
  })

  it('fails closed when the Social Brain workspace binding is missing or malformed', async () => {
    const syncSocialAccounts = vi.fn(async () => storedAccounts)

    const missing = await syncSocialAccountsForOwner({
      workspaceId: ownerWorkspaceId,
      env: {},
      service: { syncSocialAccounts },
    })
    const malformed = await syncSocialAccountsForOwner({
      workspaceId: ownerWorkspaceId,
      env: { SOCIAL_BRAIN_WORKSPACE_ID: 'not-a-uuid' },
      service: { syncSocialAccounts },
    })

    expect(missing.message).toBe('A ligação entre este workspace e o BrightBean ainda não está configurada.')
    expect(malformed.message).toBe('A ligação entre este workspace e o BrightBean ainda não está configurada.')
    expect(syncSocialAccounts).not.toHaveBeenCalled()
  })
})
