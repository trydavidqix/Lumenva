import {
  normalizeMetrics,
  type AccountAnalyticsRequest,
  type AnalyticsSnapshotInput,
  type NormalizedMetrics,
  type PostAnalyticsRequest,
  type PublicationRef,
  type PublicationStatusRequest,
  type ProviderHealth,
  type PublishNowInput,
  type PublishState,
  type SchedulePostInput,
  type SocialAccount,
  type SocialProviderPort,
  type SocialPublishingPort,
  type SocialMediaPort,
  type MediaUploadInput,
  type MediaAssetRef,
} from '@lumenva/core'

import {
  accounts as metaAccounts,
  igRead,
  publishFb,
  publishIg,
  errors as metaErrors,
} from '@lumenva/integration-meta'

export type MetaProviderOptions = {
  userToken: string
}

export class MetaProvider implements SocialProviderPort, SocialPublishingPort, SocialMediaPort {
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
    } catch (error: any) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        code: error.code ?? 'unknown_error',
        message: error.message ?? 'Meta health check failed',
      }
    }
  }

  async listAccounts(): Promise<SocialAccount[]> {
    const discovered = await metaAccounts.discoverAccounts(this.userToken)
    return discovered.map((acc) => ({
      provider: this.provider,
      providerAccountId: acc.externalId,
      externalAccountId: acc.externalId,
      platform: acc.platform,
      displayName: acc.name,
      status: 'active',
    }))
  }

  private async getAccountOrThrow(providerAccountId: string) {
    const discovered = await metaAccounts.discoverAccounts(this.userToken)
    const account = discovered.find(a => a.externalId === providerAccountId)
    if (!account) {
      throw new Error(`Account ${providerAccountId} not found or not accessible.`)
    }
    return account
  }

  async getAccountAnalytics(input: AccountAnalyticsRequest): Promise<AnalyticsSnapshotInput> {
    const account = await this.getAccountOrThrow(input.providerAccountId)
    
    let period = 'day'
    if (input.captureWindow === '7d') period = 'week'
    if (input.captureWindow === '30d') period = 'days_28'
    // 1h doesn't have a direct period in meta insights, we'll fallback to day or omit period. But we pass period.

    const values: Partial<Record<keyof NormalizedMetrics, number>> = {}

    if (account.platform === 'instagram') {
      const insights = await igRead.getInstagramInsights({
        userId: account.externalId,
        accessToken: account.pageAccessToken,
        metrics: ['impressions', 'reach', 'profile_views'],
        period,
      })
      
      for (const insight of insights) {
        const val = insight.values[0]?.value
        const num = typeof val === 'number' ? val : Number(val) || 0
        if (insight.name === 'impressions') values.impressions = num
        if (insight.name === 'reach') values.reach = num
        if (insight.name === 'profile_views') values.views = num
      }
    } else if (account.platform === 'facebook') {
      const insights = await igRead.getFacebookInsights({
        pageId: account.externalId,
        accessToken: account.pageAccessToken,
        metrics: ['page_impressions', 'page_post_engagements', 'page_views_total'],
        period,
      })
      
      for (const insight of insights) {
        const val = insight.values[0]?.value
        const num = typeof val === 'number' ? val : Number(val) || 0
        if (insight.name === 'page_impressions') values.impressions = num
        if (insight.name === 'page_post_engagements') values.likes = num
        if (insight.name === 'page_views_total') values.views = num
      }
    }

    return {
      source: this.provider,
      sourceVersion: null,
      capturedAt: input.capturedAt,
      captureWindow: input.captureWindow,
      externalPostId: null,
      metrics: normalizeMetrics(values),
    }
  }

  async getPostAnalytics(input: PostAnalyticsRequest): Promise<AnalyticsSnapshotInput> {
    const account = await this.getAccountOrThrow(input.providerAccountId)
    const values: Partial<Record<keyof NormalizedMetrics, number>> = {}

    if (!input.externalPostId) {
      throw new Error("externalPostId is required for Meta post analytics")
    }

    if (account.platform === 'instagram') {
      const insights = await igRead.getInstagramMediaInsights({
        mediaId: input.externalPostId,
        accessToken: account.pageAccessToken,
        metrics: ['impressions', 'reach', 'engagement', 'saved'],
      })
      
      for (const insight of insights) {
        const val = insight.values[0]?.value
        const num = typeof val === 'number' ? val : Number(val) || 0
        if (insight.name === 'impressions') values.impressions = num
        if (insight.name === 'reach') values.reach = num
        if (insight.name === 'engagement') values.likes = num 
        if (insight.name === 'saved') values.saves = num
      }
    } else if (account.platform === 'facebook') {
      const insights = await igRead.getFacebookPostInsights({
        postId: input.externalPostId,
        accessToken: account.pageAccessToken,
        metrics: ['post_impressions', 'post_engagements'],
      })
      
      for (const insight of insights) {
        const val = insight.values[0]?.value
        const num = typeof val === 'number' ? val : Number(val) || 0
        if (insight.name === 'post_impressions') values.impressions = num
        if (insight.name === 'post_engagements') values.likes = num
      }
    }

    return {
      source: this.provider,
      sourceVersion: null,
      capturedAt: input.capturedAt,
      captureWindow: null,
      externalPostId: input.externalPostId,
      metrics: normalizeMetrics(values),
    }
  }

  async schedulePost(input: SchedulePostInput): Promise<PublicationRef> {
    // Meta Graph API doesn't support native scheduling via these endpoints natively (except published=false which we don't fully track yet).
    // We will just throw to let Lumenva Core use its own worker scheduling.
    throw new Error('MetaProvider does not support native scheduling. Use Lumenva core worker scheduling instead.')
  }

  async publishNow(input: PublishNowInput): Promise<PublicationRef> {
    const account = await this.getAccountOrThrow(input.providerAccountId)
    const mediaUrls = input.providerMediaAssetIds
    let externalPostId = null
    let state: PublishState = 'published'

    try {
      const isVideo = mediaUrls.length > 0 && (mediaUrls[0].includes('.mp4') || mediaUrls[0].includes('.mov'))

      if (account.platform === 'facebook') {
        if (mediaUrls.length === 0) {
          const res = await publishFb.publishFacebookText({
            pageId: account.externalId,
            pageAccessToken: account.pageAccessToken,
            caption: input.caption,
          })
          externalPostId = res.id
        } else if (isVideo) {
          const res = await publishFb.publishFacebookVideo({
            pageId: account.externalId,
            pageAccessToken: account.pageAccessToken,
            videoUrl: mediaUrls[0],
            caption: input.caption,
          })
          externalPostId = res.id
        } else if (mediaUrls.length === 1) {
          const res = await publishFb.publishFacebookPhoto({
            pageId: account.externalId,
            pageAccessToken: account.pageAccessToken,
            imageUrl: mediaUrls[0],
            caption: input.caption,
          })
          externalPostId = res.id
        } else {
          const res = await publishFb.publishFacebookCarousel({
            pageId: account.externalId,
            pageAccessToken: account.pageAccessToken,
            imageUrls: mediaUrls,
            caption: input.caption,
          })
          externalPostId = res.id
        }
      } else if (account.platform === 'instagram') {
        if (mediaUrls.length === 0) {
          throw new Error('Instagram requires at least one media asset.')
        } else if (isVideo) {
          const res = await publishIg.uploadReelContainer({
            igUserId: account.externalId,
            accessToken: account.pageAccessToken,
            videoUrl: mediaUrls[0],
            caption: input.caption,
          })
          externalPostId = res.containerId
          state = 'reconcile_required'
        } else if (mediaUrls.length === 1) {
          const res = await publishIg.publishPhoto({
            igUserId: account.externalId,
            accessToken: account.pageAccessToken,
            imageUrl: mediaUrls[0],
            caption: input.caption,
          })
          externalPostId = res.id
        } else {
          const res = await publishIg.publishCarousel({
            igUserId: account.externalId,
            accessToken: account.pageAccessToken,
            imageUrls: mediaUrls,
            caption: input.caption,
          })
          externalPostId = res.id
        }
      }

      return {
        providerPublicationId: `meta-${input.idempotencyKey}`,
        providerPlatformPublicationId: externalPostId,
        providerAccountId: input.providerAccountId,
        state,
        externalPostId: state === 'published' ? externalPostId : null,
        externalUrl: null,
        scheduledFor: null,
        publishedAt: state === 'published' ? new Date().toISOString() : null,
        errorMessage: null,
      }
    } catch (error: any) {
      return {
        providerPublicationId: `meta-${input.idempotencyKey}`,
        providerPlatformPublicationId: null,
        providerAccountId: input.providerAccountId,
        state: 'failed',
        externalPostId: null,
        externalUrl: null,
        scheduledFor: null,
        publishedAt: null,
        errorMessage: error.message ?? 'Unknown error publishing to Meta',
      }
    }
  }

  async getPublicationStatus(input: PublicationStatusRequest): Promise<PublicationRef> {
    // If we support tracking published status later, we'd do it here. 
    // Since publishNow is synchronous and waits for completion in integration-meta,
    // we just return a generic 'published' or 'failed' if we had a database. 
    // Here we just return unknown as we don't have local DB in the provider.
    return {
      providerPublicationId: input.providerPublicationId,
      providerPlatformPublicationId: null,
      providerAccountId: input.providerAccountId,
      state: 'unknown',
      externalPostId: null,
      externalUrl: null,
      scheduledFor: null,
      publishedAt: null,
      errorMessage: null,
    }
  }

  async uploadMedia(input: MediaUploadInput): Promise<MediaAssetRef> {
    if (input.source.type !== 'url') {
      throw new Error('MetaProvider requires a URL media source. Direct byte uploads are not supported yet.')
    }
    return { providerMediaAssetId: input.source.url, processingStatus: 'ready' }
  }

  async getMediaStatus(providerMediaAssetId: string): Promise<MediaAssetRef> {
    return { providerMediaAssetId, processingStatus: 'ready' }
  }
}
