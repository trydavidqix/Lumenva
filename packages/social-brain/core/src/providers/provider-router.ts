import type { SocialProviderPort, SocialPublishingPort, ProviderHealth } from './ports'
import type { AccountAnalyticsRequest, AnalyticsSnapshotInput, PostAnalyticsRequest } from '../analytics/types'
import type { SocialAccount } from '../social/types'
import { MetaProvider } from '@lumenva/provider-meta'
import { BrightBeanProvider } from '@lumenva/provider-brightbean'

export type SocialProvider = SocialProviderPort & SocialPublishingPort

export function resolveProvider(providerName: string): SocialProvider {
  switch (providerName) {
    case 'meta':
      return new MetaProvider({ userToken: process.env.META_USER_TOKEN || process.env.META_ACCESS_TOKEN || '' })
    case 'brightbean':
      return new BrightBeanProvider({
        baseUrl: process.env.BRIGHTBEAN_BASE_URL || 'https://api.brightbean.io',
        apiKey: process.env.BRIGHTBEAN_API_KEY || ''
      })
    default:
      throw new Error(`Unknown social provider: ${providerName}`)
  }
}

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
