import type { SocialAccount, SocialPlatform } from '@lumenva/core'
import { BrightBeanProvider } from '@lumenva/provider-brightbean'

import { buildBrightBeanConnectionUrl } from './brightbean-connection'
import {
  validateSocialBrainWorkspaceBinding,
  type SocialBrainWorkspaceBindingEnv,
} from './workspace-binding'

const PLATFORM_DEFINITIONS = [
  { platform: 'instagram', label: 'Instagram' },
  { platform: 'facebook', label: 'Facebook' },
  { platform: 'tiktok', label: 'TikTok' },
  { platform: 'youtube', label: 'YouTube' },
] as const satisfies ReadonlyArray<{ platform: SocialPlatform; label: string }>

type BrightBeanEnv = SocialBrainWorkspaceBindingEnv

export type SocialAccountConnectionState =
  | 'disconnected'
  | 'connected'
  | 'reconnect'
  | 'unavailable'

export type SocialAccountsPlatformModel = {
  platform: (typeof PLATFORM_DEFINITIONS)[number]['platform']
  label: string
  state: SocialAccountConnectionState
  accounts: SocialAccount[]
}

export type SocialAccountsPageModel = {
  configured: boolean
  connectionUrl: string | null
  platforms: SocialAccountsPlatformModel[]
  error: string | null
}

export type SocialAccountsPageModelOptions = {
  ownerWorkspaceId: string
  env?: BrightBeanEnv
  accountsOverride?: SocialAccount[] | undefined
  listAccountsOverride?: (() => Promise<SocialAccount[]>) | undefined
  syncError?: string | null | undefined
}

export async function getSocialAccountsPageModel({
  ownerWorkspaceId,
  env = process.env,
  accountsOverride,
  listAccountsOverride,
  syncError,
}: SocialAccountsPageModelOptions): Promise<SocialAccountsPageModel> {
  const binding = validateSocialBrainWorkspaceBinding(ownerWorkspaceId, env)
  if (!binding.ok) {
    return {
      configured: false,
      connectionUrl: null,
      platforms: emptyPlatforms('unavailable'),
      error: binding.message,
    }
  }

  const baseUrl = env.BRIGHTBEAN_BASE_URL?.trim() ?? ''
  const apiKey = env.BRIGHTBEAN_API_KEY?.trim() ?? ''
  const workspaceId = env.BRIGHTBEAN_WORKSPACE_ID?.trim() ?? ''

  if (!baseUrl || !workspaceId) {
    return {
      configured: false,
      connectionUrl: null,
      platforms: emptyPlatforms('unavailable'),
      error: 'A ligação às redes sociais ainda não está configurada neste ambiente.',
    }
  }

  let connectionUrl: string
  try {
    connectionUrl = buildBrightBeanConnectionUrl({ baseUrl, workspaceId })
  } catch {
    return {
      configured: false,
      connectionUrl: null,
      platforms: emptyPlatforms('unavailable'),
      error: 'A configuração da ligação às redes sociais precisa de atenção.',
    }
  }

  if (!apiKey) {
    return {
      configured: true,
      connectionUrl,
      platforms: emptyPlatforms('unavailable'),
      error:
        'Você já pode gerir as conexões no BrightBean. A sincronização automática ficará disponível quando a integração do servidor estiver concluída.',
    }
  }

  if (syncError) {
    return {
      configured: true,
      connectionUrl,
      platforms: emptyPlatforms('unavailable'),
      error: syncError,
    }
  }

  const listAccounts = accountsOverride
    ? async () => accountsOverride
    : listAccountsOverride ?? (() => {
    const provider = new BrightBeanProvider({ baseUrl, apiKey })
    return provider.listAccounts()
  })

  try {
    const accounts = await listAccounts()
    return {
      configured: true,
      connectionUrl,
      platforms: PLATFORM_DEFINITIONS.map(({ platform, label }) => {
        const platformAccounts = accounts.filter((account) => account.platform === platform)
        return {
          platform,
          label,
          state: stateForAccounts(platformAccounts),
          accounts: platformAccounts,
        }
      }),
      error: null,
    }
  } catch {
    return {
      configured: true,
      connectionUrl,
      platforms: emptyPlatforms('unavailable'),
      error: 'Não foi possível consultar as contas sociais agora. Tente novamente em alguns instantes.',
    }
  }
}

function stateForAccounts(accounts: SocialAccount[]): SocialAccountConnectionState {
  if (accounts.some((account) => account.status === 'active')) return 'connected'
  if (accounts.length > 0) return 'reconnect'
  return 'disconnected'
}

function emptyPlatforms(state: SocialAccountConnectionState): SocialAccountsPlatformModel[] {
  return PLATFORM_DEFINITIONS.map(({ platform, label }) => ({ platform, label, state, accounts: [] }))
}
