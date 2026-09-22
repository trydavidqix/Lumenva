import { MetaClient } from '@lumenva/integration-meta'
import type {
  AccountAnalyticsRequest,
  AnalyticsSnapshotInput,
  PostAnalyticsRequest,
  PublicationRef,
  PublicationStatusRequest,
  ProviderHealth,
  PublishNowInput,
  SchedulePostInput,
  SocialAccount,
  SocialProviderPort,
  SocialPublishingPort,
} from '@lumenva/core'

export type MetaProviderOptions = {
  userToken: string
}

export class MetaProviderError extends Error {
  constructor(
    public readonly code: 'request_rejected' | 'not_implemented',
    message: string,
  ) {
    super(message)
    this.name = 'MetaProviderError'
  }
}

export class MetaProvider implements SocialProviderPort, SocialPublishingPort {
  readonly provider = 'meta'
  private readonly userToken: string

  constructor(options: MetaProviderOptions) {
    this.userToken = options.userToken
  }

  async health(): Promise<ProviderHealth> {
    const startedAt = Date.now()
    try {
      await this.listAccounts()
      return {
        ok: true,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        code: null,
        message: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Meta health check failed'
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        code: error instanceof MetaProviderError ? error.code : 'provider_error',
        message,
      }
    }
  }

  async listAccounts(): Promise<SocialAccount[]> {
    this.requireUserToken()
    const accounts = await MetaClient.accounts.discover(this.userToken)
    return accounts.map((account) => ({
      provider: this.provider,
      providerAccountId: account.externalId,
      externalAccountId: account.externalId,
      platform: account.platform,
      displayName: account.name,
      status: 'active',
    }))
  }

  getAccountAnalytics(_input: AccountAnalyticsRequest): Promise<AnalyticsSnapshotInput> {
    return Promise.reject(this.notImplemented('account analytics'))
  }

  getPostAnalytics(_input: PostAnalyticsRequest): Promise<AnalyticsSnapshotInput> {
    return Promise.reject(this.notImplemented('post analytics'))
  }

  schedulePost(_input: SchedulePostInput): Promise<PublicationRef> {
    return Promise.reject(this.notImplemented('scheduled publishing'))
  }

  publishNow(_input: PublishNowInput): Promise<PublicationRef> {
    return Promise.reject(this.notImplemented('immediate publishing'))
  }

  getPublicationStatus(_input: PublicationStatusRequest): Promise<PublicationRef> {
    return Promise.reject(this.notImplemented('publication status'))
  }

  private requireUserToken(): void {
    if (!this.userToken.trim()) {
      throw new MetaProviderError('request_rejected', 'Meta user token is required')
    }
  }

  private notImplemented(capability: string): MetaProviderError {
    return new MetaProviderError('not_implemented', `Meta ${capability} is not implemented`) 
  }
}
