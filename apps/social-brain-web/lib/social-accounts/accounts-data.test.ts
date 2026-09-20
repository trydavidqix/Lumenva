import { describe, expect, it, vi } from 'vitest'

import type { SocialAccount } from '@lumenva/core'

import { getSocialAccountsPageModel } from './accounts-data'

const baseEnv = {
  BRIGHTBEAN_BASE_URL: 'https://social.example.com',
  BRIGHTBEAN_API_KEY: 'server-secret',
  BRIGHTBEAN_WORKSPACE_ID: '831e88b5-087e-4fd3-a7d3-a17510fb5f12',
  SOCIAL_BRAIN_WORKSPACE_ID: '7a3e7d8e-45b7-4a89-9e92-0e9f8dcd9d01',
}
const ownerWorkspaceId = '7a3e7d8e-45b7-4a89-9e92-0e9f8dcd9d01'
const otherWorkspaceId = 'a5c2e0d4-7c86-4ff6-b4f7-90335fcbec12'

describe('getSocialAccountsPageModel', () => {
  it('groups connected accounts under exactly the four V1 platforms and derives states', async () => {
    const accounts: SocialAccount[] = [
      {
        provider: 'brightbean',
        providerAccountId: 'ig-1',
        externalAccountId: null,
        platform: 'instagram',
        displayName: '@lumenva',
        status: 'active',
      },
      {
        provider: 'brightbean',
        providerAccountId: 'tt-1',
        externalAccountId: null,
        platform: 'tiktok',
        displayName: '@lumenva-video',
        status: 'disabled',
      },
      {
        provider: 'brightbean',
        providerAccountId: 'yt-1',
        externalAccountId: null,
        platform: 'youtube',
        displayName: 'Lumenva',
        status: 'active',
      },
    ]

    const model = await getSocialAccountsPageModel({
      env: baseEnv,
      ownerWorkspaceId,
      listAccountsOverride: async () => accounts,
    })

    expect(model.configured).toBe(true)
    expect(model.connectionUrl).toBe(
      'https://social.example.com/social-accounts/831e88b5-087e-4fd3-a7d3-a17510fb5f12/connect/',
    )
    expect(model.platforms.map((item) => item.platform)).toEqual([
      'instagram',
      'facebook',
      'tiktok',
      'youtube',
    ])
    expect(model.platforms.find((item) => item.platform === 'instagram')?.state).toBe('connected')
    expect(model.platforms.find((item) => item.platform === 'facebook')?.state).toBe('disconnected')
    expect(model.platforms.find((item) => item.platform === 'tiktok')?.state).toBe('reconnect')
    expect(model.platforms.find((item) => item.platform === 'youtube')?.state).toBe('connected')
  })

  it('supports multiple accounts on the same platform', async () => {
    const accounts: SocialAccount[] = [
      {
        provider: 'brightbean',
        providerAccountId: 'ig-1',
        externalAccountId: null,
        platform: 'instagram',
        displayName: '@lumenva',
        status: 'active',
      },
      {
        provider: 'brightbean',
        providerAccountId: 'ig-2',
        externalAccountId: null,
        platform: 'instagram',
        displayName: '@lumenva.pt',
        status: 'active',
      },
    ]

    const model = await getSocialAccountsPageModel({
      env: baseEnv,
      ownerWorkspaceId,
      listAccountsOverride: async () => accounts,
    })
    const instagram = model.platforms.find((item) => item.platform === 'instagram')

    expect(instagram?.state).toBe('connected')
    expect(instagram?.accounts).toHaveLength(2)
  })

  it('keeps the BrightBean connection handoff available before the API key is configured', async () => {
    const listAccounts = vi.fn(async () => [] as SocialAccount[])

    const model = await getSocialAccountsPageModel({
      env: { ...baseEnv, BRIGHTBEAN_API_KEY: '' },
      ownerWorkspaceId,
      listAccountsOverride: listAccounts,
    })

    expect(model.configured).toBe(true)
    expect(model.connectionUrl).toBe(
      'https://social.example.com/social-accounts/831e88b5-087e-4fd3-a7d3-a17510fb5f12/connect/',
    )
    expect(model.platforms.every((item) => item.state === 'unavailable')).toBe(true)
    expect(model.error).toBe(
      'Você já pode gerir as conexões no BrightBean. A sincronização automática ficará disponível quando a integração do servidor estiver concluída.',
    )
    expect(model.error).not.toContain('BRIGHTBEAN_API_KEY')
    expect(listAccounts).not.toHaveBeenCalled()
  })

  it('keeps the page usable when BrightBean is temporarily unavailable', async () => {
    const model = await getSocialAccountsPageModel({
      env: baseEnv,
      ownerWorkspaceId,
      listAccountsOverride: async () => {
        throw new Error('network down')
      },
    })

    expect(model.configured).toBe(true)
    expect(model.platforms.every((item) => item.state === 'unavailable')).toBe(true)
    expect(model.platforms.every((item) => item.accounts.length === 0)).toBe(true)
    expect(model.error).toBe('Não foi possível consultar as contas sociais agora. Tente novamente em alguns instantes.')
  })

  it('fails safely when BrightBean connection configuration is malformed', async () => {
    const listAccounts = vi.fn(async () => [] as SocialAccount[])
    const model = await getSocialAccountsPageModel({
      env: { ...baseEnv, BRIGHTBEAN_BASE_URL: 'javascript:alert(1)' },
      ownerWorkspaceId,
      listAccountsOverride: listAccounts,
    })

    expect(model.configured).toBe(false)
    expect(model.connectionUrl).toBeNull()
    expect(model.platforms.every((item) => item.state === 'unavailable')).toBe(true)
    expect(model.error).toBe('A configuração da ligação às redes sociais precisa de atenção.')
    expect(listAccounts).not.toHaveBeenCalled()
  })

  it('requires the BrightBean base URL and workspace before exposing a connection handoff', async () => {
    const listAccounts = vi.fn(async () => [] as SocialAccount[])
    const model = await getSocialAccountsPageModel({
      env: { ...baseEnv, BRIGHTBEAN_WORKSPACE_ID: '' },
      ownerWorkspaceId,
      listAccountsOverride: listAccounts,
    })

    expect(model.configured).toBe(false)
    expect(model.connectionUrl).toBeNull()
    expect(model.error).toBe('A ligação às redes sociais ainda não está configurada neste ambiente.')
    expect(listAccounts).not.toHaveBeenCalled()
  })

  it('does not expose a handoff or list accounts for a workspace outside the configured binding', async () => {
    const listAccounts = vi.fn(async () => [] as SocialAccount[])

    const model = await getSocialAccountsPageModel({
      env: baseEnv,
      ownerWorkspaceId: otherWorkspaceId,
      listAccountsOverride: listAccounts,
    })

    expect(model.configured).toBe(false)
    expect(model.connectionUrl).toBeNull()
    expect(model.error).toBe('Este workspace não está autorizado para a integração de contas sociais.')
    expect(listAccounts).not.toHaveBeenCalled()
  })

  it('preserves a sync failure without making a second provider request', async () => {
    const listAccounts = vi.fn(async () => [] as SocialAccount[])

    const model = await getSocialAccountsPageModel({
      env: baseEnv,
      ownerWorkspaceId,
      listAccountsOverride: listAccounts,
      syncError: 'Não foi possível sincronizar as contas sociais agora. Tente novamente em alguns instantes.',
    })

    expect(model.platforms.every((item) => item.state === 'unavailable')).toBe(true)
    expect(model.error).toBe('Não foi possível sincronizar as contas sociais agora. Tente novamente em alguns instantes.')
    expect(listAccounts).not.toHaveBeenCalled()
  })
})
