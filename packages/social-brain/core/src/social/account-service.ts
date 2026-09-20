import type { SocialProviderPort } from '../providers/ports'
import type { SocialAccount, SocialPlatform, StoredSocialAccount } from './types'

const V1_PLATFORMS: ReadonlySet<string> = new Set([
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
])

export type SocialAccountRepositoryPort = {
  syncAccounts(workspaceId: string, accounts: SocialAccount[]): Promise<StoredSocialAccount[]>
  listAccounts(workspaceId: string): Promise<StoredSocialAccount[]>
}

export type SocialAccountService = {
  syncSocialAccounts(workspaceId: string): Promise<StoredSocialAccount[]>
  listSocialAccounts(workspaceId: string): Promise<StoredSocialAccount[]>
}

export function createSocialAccountService(
  provider: SocialProviderPort,
  repository: SocialAccountRepositoryPort,
): SocialAccountService {
  return {
    async syncSocialAccounts(workspaceId) {
      const remote = await provider.listAccounts()
      const supported = remote.filter(isV1Account)
      return repository.syncAccounts(workspaceId, supported)
    },

    listSocialAccounts(workspaceId) {
      return repository.listAccounts(workspaceId)
    },
  }
}

function isV1Account(account: SocialAccount): account is SocialAccount & { platform: SocialPlatform } {
  return V1_PLATFORMS.has(account.platform)
}
