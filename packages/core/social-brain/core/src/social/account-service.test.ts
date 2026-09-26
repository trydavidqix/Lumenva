import { describe, expect, it, vi } from 'vitest'

import type { SocialProviderPort } from '../providers/ports'
import type { SocialAccount } from './types'

const supportedAccounts: SocialAccount[] = [
  {
    provider: 'brightbean',
    providerAccountId: 'ig-1',
    externalAccountId: null,
    platform: 'instagram',
    displayName: 'Instagram',
    status: 'active',
  },
  {
    provider: 'brightbean',
    providerAccountId: 'yt-1',
    externalAccountId: null,
    platform: 'youtube',
    displayName: 'YouTube',
    status: 'active',
  },
]

const unsupportedAccount = {
  provider: 'brightbean',
  providerAccountId: 'blue-1',
  externalAccountId: null,
  platform: 'bluesky',
  displayName: 'Bluesky',
  status: 'active',
} as unknown as SocialAccount

function provider(accounts: SocialAccount[]): SocialProviderPort {
  return {
    provider: 'brightbean',
    health: async () => ({
      ok: true,
      checkedAt: '2026-08-17T12:00:00Z',
      latencyMs: 1,
      code: null,
      message: null,
    }),
    listAccounts: async () => accounts,
    getAccountAnalytics: async () => {
      throw new Error('not used')
    },
    getPostAnalytics: async () => {
      throw new Error('not used')
    },
  }
}

describe('social account service', () => {
  it('syncs only the four V1 platforms and delegates persistence by workspace', async () => {
    const mod = await import('./account-service').catch(() => null)
    expect(mod, 'social account service module must exist').not.toBeNull()
    if (!mod) return

    const syncAccounts = vi.fn(async (_workspaceId: string, accounts: SocialAccount[]) =>
      accounts.map((account, index) => ({
        ...account,
        id: `local-${index}`,
        workspaceId: 'workspace-1',
      })),
    )
    const listAccounts = vi.fn(async () => [])
    const service = mod.createSocialAccountService(
      provider([...supportedAccounts, unsupportedAccount]),
      { syncAccounts, listAccounts },
    )

    const result = await service.syncSocialAccounts('workspace-1')

    expect(syncAccounts).toHaveBeenCalledTimes(1)
    expect(syncAccounts.mock.calls[0]?.[0]).toBe('workspace-1')
    expect(syncAccounts.mock.calls[0]?.[1].map((account) => account.platform)).toEqual([
      'instagram',
      'youtube',
    ])
    expect(result).toHaveLength(2)
  })

  it('lists local account mappings without calling the provider', async () => {
    const mod = await import('./account-service').catch(() => null)
    expect(mod, 'social account service module must exist').not.toBeNull()
    if (!mod) return

    const listAccounts = vi.fn(async () => [
      {
        ...supportedAccounts[0]!,
        id: 'local-ig',
        workspaceId: 'workspace-1',
      },
    ])
    const socialProvider = provider(supportedAccounts)
    const providerListSpy = vi.spyOn(socialProvider, 'listAccounts')
    const service = mod.createSocialAccountService(socialProvider, {
      syncAccounts: vi.fn(),
      listAccounts,
    })

    const result = await service.listSocialAccounts('workspace-1')

    expect(listAccounts).toHaveBeenCalledWith('workspace-1')
    expect(providerListSpy).not.toHaveBeenCalled()
    expect(result[0]?.id).toBe('local-ig')
  })
})
