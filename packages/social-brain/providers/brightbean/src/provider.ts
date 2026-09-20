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
  type SocialPlatform,
  type SocialProviderPort,
  type SocialPublishingPort,
} from '@lumenva/core'

import { BrightBeanClient, BrightBeanError, type BrightBeanClientOptions } from './client'
import {
  AccountAnalyticsSchema,
  AccountsListSchema,
  MediaAssetResponseSchema,
  PostAnalyticsSchema,
  PostResponseSchema,
  type BrightBeanAccountSummary,
  type BrightBeanDerivedMetric,
  type BrightBeanPostMetricTile,
} from './schemas'

const PLATFORM_MAP: Record<string, SocialPlatform | undefined> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  youtube: 'youtube',
}

export type BrightBeanProviderOptions = BrightBeanClientOptions

export type BrightBeanMediaUploadInput = {
  filename: string
  mimeType: string
  bytes: Uint8Array
  idempotencyKey: string
}

export type BrightBeanMediaAssetRef = {
  providerMediaAssetId: string
  processingStatus: string
}

export class BrightBeanProvider implements SocialProviderPort, SocialPublishingPort {
  readonly provider = 'brightbean'
  private readonly client: BrightBeanClient

  constructor(options: BrightBeanProviderOptions) {
    this.client = new BrightBeanClient(options)
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
      const safe = error instanceof BrightBeanError ? error : null
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        code: safe?.code ?? 'unknown_error',
        message: safe?.message ?? 'BrightBean health check failed',
      }
    }
  }

  async listAccounts(): Promise<SocialAccount[]> {
    const payload = await this.client.get('/api/v1/accounts/')
    const parsed = AccountsListSchema.safeParse(payload)
    if (!parsed.success) throw invalidResponse()

    return parsed.data.accounts.flatMap((account) => {
      const platform = PLATFORM_MAP[account.platform]
      if (!platform) return []
      return [mapAccount(account, platform)]
    })
  }

  async getAccountAnalytics(input: AccountAnalyticsRequest): Promise<AnalyticsSnapshotInput> {
    const days = daysForWindow(input.captureWindow)
    const payload = await this.client.get(
      `/api/v1/analytics/accounts/${encodeURIComponent(input.providerAccountId)}`,
      new URLSearchParams({ days: String(days) }),
    )
    const parsed = AccountAnalyticsSchema.safeParse(payload)
    if (!parsed.success || parsed.data.account_id !== input.providerAccountId) throw invalidResponse()

    const metrics = parsed.data.analytics_available
      ? normalizeBrightBeanMetrics([
          ...parsed.data.hero_metrics,
          ...(parsed.data.engagement?.parts ?? []),
          ...(parsed.data.follower_growth ? [parsed.data.follower_growth] : []),
        ])
      : normalizeMetrics({})

    return {
      source: this.provider,
      sourceVersion: null,
      capturedAt: parsed.data.captured_at ?? input.capturedAt,
      captureWindow: input.captureWindow,
      externalPostId: null,
      metrics,
    }
  }

  async getPostAnalytics(input: PostAnalyticsRequest): Promise<AnalyticsSnapshotInput> {
    const payload = await this.client.get(
      `/api/v1/analytics/posts/${encodeURIComponent(input.providerPostId)}`,
    )
    const parsed = PostAnalyticsSchema.safeParse(payload)
    if (!parsed.success || parsed.data.post_id !== input.providerPostId) throw invalidResponse()

    const child = parsed.data.platform_posts.find(
      (candidate) => candidate.social_account_id === input.providerAccountId,
    )
    if (!child) throw invalidResponse()

    return {
      source: this.provider,
      sourceVersion: null,
      capturedAt: child.captured_at ?? input.capturedAt,
      captureWindow: null,
      externalPostId: input.externalPostId,
      metrics: child.analytics_available ? normalizeBrightBeanMetrics(child.metric_tiles) : normalizeMetrics({}),
    }
  }

  schedulePost(input: SchedulePostInput): Promise<PublicationRef> {
    return this.createScheduledPublication(input, normalizeScheduleTime(input.scheduledFor))
  }

  publishNow(input: PublishNowInput): Promise<PublicationRef> {
    return this.createScheduledPublication(input, normalizeScheduleTime(input.executionTime))
  }

  async getPublicationStatus(input: PublicationStatusRequest): Promise<PublicationRef> {
    const payload = await this.client.get(
      `/api/v1/posts/${encodeURIComponent(input.providerPublicationId)}`,
    )
    return mapPublication(payload, input.providerAccountId)
  }

  async uploadMedia(input: BrightBeanMediaUploadInput): Promise<BrightBeanMediaAssetRef> {
    if (!input.filename.trim() || !input.mimeType.trim() || input.bytes.byteLength === 0) {
      throw new BrightBeanError('request_rejected', 'Valid media bytes, filename, and MIME type are required')
    }
    if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 128) {
      throw new BrightBeanError('request_rejected', 'A valid media idempotency key is required')
    }

    const form = new FormData()
    const blob = new Blob([input.bytes as unknown as BlobPart], { type: input.mimeType })
    form.append('file', blob, input.filename)
    form.append('idempotency_key', input.idempotencyKey)

    const payload = await this.client.postForm('/api/v1/media/', form)
    return mapMediaAsset(payload)
  }

  async getMediaStatus(providerMediaAssetId: string): Promise<BrightBeanMediaAssetRef> {
    const payload = await this.client.get(
      `/api/v1/media/${encodeURIComponent(providerMediaAssetId)}`,
    )
    return mapMediaAsset(payload)
  }

  private async createScheduledPublication(
    input: SchedulePostInput | PublishNowInput,
    scheduledFor: string,
  ): Promise<PublicationRef> {
    validatePublishInput(input)

    const payload = await this.client.post('/api/v1/posts/', {
      social_account_id: input.providerAccountId,
      caption: input.caption,
      title: input.title ?? '',
      first_comment: '',
      internal_notes: '',
      media_asset_ids: input.providerMediaAssetIds,
      platform_overrides: [],
      action: 'schedule',
      scheduled_at: scheduledFor,
      proposed_publish_at: null,
      idempotency_key: input.idempotencyKey,
    })

    return mapPublication(payload, input.providerAccountId)
  }
}

function validatePublishInput(input: SchedulePostInput | PublishNowInput): void {
  if (!input.providerAccountId.trim()) {
    throw new BrightBeanError('request_rejected', 'BrightBean account id is required')
  }
  if (input.providerMediaAssetIds.length === 0) {
    throw new BrightBeanError('request_rejected', 'Prepared BrightBean media is required')
  }
  if (!input.idempotencyKey.trim() || input.idempotencyKey.length > 128) {
    throw new BrightBeanError('request_rejected', 'A valid idempotency key is required')
  }
}

function normalizeScheduleTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new BrightBeanError('request_rejected', 'A valid schedule timestamp is required')
  }
  return parsed.toISOString()
}

function mapPublication(payload: unknown, providerAccountId: string): PublicationRef {
  const parsed = PostResponseSchema.safeParse(payload)
  if (!parsed.success) throw invalidResponse()

  const child = parsed.data.platform_posts.find(
    (candidate) => candidate.social_account_id === providerAccountId,
  )
  if (!child) throw invalidResponse()

  return {
    providerPublicationId: parsed.data.id,
    providerPlatformPublicationId: child.id,
    providerAccountId,
    state: mapPublishState(child.status),
    externalPostId: child.platform_post_id || null,
    externalUrl: null,
    scheduledFor: child.scheduled_at ?? parsed.data.scheduled_at,
    publishedAt: child.published_at ?? parsed.data.published_at,
    errorMessage: child.publish_error || null,
  }
}

function mapMediaAsset(payload: unknown): BrightBeanMediaAssetRef {
  const parsed = MediaAssetResponseSchema.safeParse(payload)
  if (!parsed.success) throw invalidResponse()
  return {
    providerMediaAssetId: parsed.data.id,
    processingStatus: parsed.data.processing_status,
  }
}

function mapPublishState(status: string): PublishState {
  switch (status) {
    case 'draft':
    case 'queued':
      return 'queued'
    case 'scheduled':
      return 'scheduled'
    case 'publishing':
      return 'publishing'
    case 'published':
      return 'published'
    case 'failed':
      return 'failed'
    default:
      return 'unknown'
  }
}

function mapAccount(account: BrightBeanAccountSummary, platform: SocialPlatform): SocialAccount {
  return {
    provider: 'brightbean',
    providerAccountId: account.id,
    externalAccountId: null,
    platform,
    displayName: account.account_name || account.account_handle || null,
    status: account.connection_status === 'connected' ? 'active' : 'disabled',
  }
}

function daysForWindow(captureWindow: string | null): 7 | 15 | 30 | 60 {
  if (captureWindow === '7d') return 7
  if (captureWindow === '15d') return 15
  if (captureWindow === '30d' || captureWindow === null) return 30
  if (captureWindow === '60d') return 60
  if (captureWindow === '24h') {
    throw new BrightBeanError(
      'request_rejected',
      'BrightBean account analytics does not expose a native 24h window; use timestamped post analytics for V1.1 hourly analysis',
    )
  }
  throw new BrightBeanError('request_rejected', 'Analytics window must be 7d, 15d, 30d, or 60d')
}

type MetricSource = Pick<BrightBeanDerivedMetric, 'key' | 'kind' | 'value'> | Pick<BrightBeanPostMetricTile, 'key' | 'kind' | 'value'>

function normalizeBrightBeanMetrics(metrics: MetricSource[]): NormalizedMetrics {
  const values: Partial<Record<keyof NormalizedMetrics, number>> = {}

  for (const metric of metrics) {
    switch (metric.key) {
      case 'views':
      case 'plays':
        values.views = metric.value
        break
      case 'reach':
        values.reach = metric.value
        break
      case 'impressions':
        values.impressions = metric.value
        break
      case 'likes':
      case 'reactions':
        values.likes = metric.value
        break
      case 'comments':
      case 'replies':
        values.comments = metric.value
        break
      case 'shares':
      case 'reposts':
        values.shares = metric.value
        break
      case 'saves':
        values.saves = metric.value
        break
      case 'watch_time':
        values.watchTimeMs = metric.kind === 'minutes' ? metric.value * 60_000 : metric.value
        break
      case 'avg_view_pct':
        values.retentionRate = metric.value
        break
      case 'followers':
      case 'follows':
      case 'subscribers':
        values.followerDelta = metric.value
        break
      default:
        break
    }
  }

  return normalizeMetrics(values)
}

function invalidResponse(): BrightBeanError {
  return new BrightBeanError('invalid_response', 'BrightBean returned an unexpected response')
}
