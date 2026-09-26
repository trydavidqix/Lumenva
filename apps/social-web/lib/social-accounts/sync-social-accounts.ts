import {
  createSocialAccountService,
  type SocialAccountService,
  type StoredSocialAccount,
} from '@lumenva/core'
import {
  createSocialAccountRepository,
  createSupabaseSocialAccountStore,
} from '@lumenva/db/social'
import type { Database } from '@lumenva/db/types'
import { BrightBeanProvider } from '@lumenva/provider-brightbean'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createSupabaseServerClient } from '../supabase/server'
import {
  validateSocialBrainWorkspaceBinding,
  type SocialBrainWorkspaceBindingEnv,
} from './workspace-binding'

type BrightBeanSyncEnv = SocialBrainWorkspaceBindingEnv

export type SyncSocialAccountsResult = {
  ok: boolean
  syncedCount: number
  message: string | null
  accounts: StoredSocialAccount[]
}

export type SyncSocialAccountsOptions = {
  workspaceId: string
  env?: BrightBeanSyncEnv
  service?: Pick<SocialAccountService, 'syncSocialAccounts'>
}

export async function syncSocialAccountsForOwner(
  options: SyncSocialAccountsOptions,
): Promise<SyncSocialAccountsResult> {
  const workspaceId = options.workspaceId.trim()
  if (!workspaceId) {
    return failure('Não foi possível identificar o workspace para sincronizar as contas sociais.')
  }

  const env = options.env ?? process.env
  const binding = validateSocialBrainWorkspaceBinding(workspaceId, env)
  if (!binding.ok) return failure(binding.message)

  const baseUrl = env.BRIGHTBEAN_BASE_URL?.trim() ?? ''
  const apiKey = env.BRIGHTBEAN_API_KEY?.trim() ?? ''
  const brightBeanWorkspaceId = env.BRIGHTBEAN_WORKSPACE_ID?.trim() ?? ''

  if (!options.service && (!baseUrl || !apiKey || !isUuid(brightBeanWorkspaceId))) {
    return failure('A sincronização das contas sociais ainda não está configurada neste ambiente.')
  }

  try {
    const service = options.service ?? await createRuntimeSocialAccountService({ baseUrl, apiKey })
    const accounts = await service.syncSocialAccounts(workspaceId)
    return {
      ok: true,
      syncedCount: accounts.length,
      message: null,
      accounts,
    }
  } catch {
    return failure('Não foi possível sincronizar as contas sociais agora. Tente novamente em alguns instantes.')
  }
}

async function createRuntimeSocialAccountService(
  config: { baseUrl: string; apiKey: string },
): Promise<SocialAccountService> {
  const client = await createSupabaseServerClient()
  const typedClient = client as unknown as SupabaseClient<Database>
  const repository = createSocialAccountRepository(createSupabaseSocialAccountStore(typedClient))
  const provider = new BrightBeanProvider(config)
  return createSocialAccountService(provider, repository)
}

function failure(message: string): SyncSocialAccountsResult {
  return {
    ok: false,
    syncedCount: 0,
    message,
    accounts: [],
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
