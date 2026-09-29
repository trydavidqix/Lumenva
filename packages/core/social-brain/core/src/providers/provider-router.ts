import type { SocialProviderPort, SocialPublishingPort, ProviderHealth } from './ports'
import type { AccountAnalyticsRequest, AnalyticsSnapshotInput, PostAnalyticsRequest } from '../analytics/types'
import type { SocialAccount } from '../social/types'

export type SocialProvider = SocialProviderPort & SocialPublishingPort

export class ProviderRouter implements SocialProviderPort {
  readonly provider = 'router'

  constructor(private readonly providers: SocialProviderPort[]) {}

  async health(): Promise<ProviderHealth> {
    return { ok: true, checkedAt: new Date().toISOString(), latencyMs: null, code: null, message: null }
  }

  async listAccounts(): Promise<SocialAccount[]> {
    const results = await Promise.allSettled(this.providers.map(p => p.listAccounts()))
    const accounts: SocialAccount[] = []
    for (const res of results) {
      if (res.status === 'fulfilled') {
        accounts.push(...res.value)
      } else {
        console.error('Provider router failed to list accounts for one provider:', res.reason)
      }
    }
    return accounts
  }
  
  async getAccountAnalytics(input: AccountAnalyticsRequest): Promise<AnalyticsSnapshotInput> {
    throw new Error('Not implemented on router')
  }
  
  async getPostAnalytics(input: PostAnalyticsRequest): Promise<AnalyticsSnapshotInput> {
    throw new Error('Not implemented on router')
  }
}
