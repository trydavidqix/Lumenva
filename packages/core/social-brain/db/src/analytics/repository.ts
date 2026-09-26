import {
  normalizeMetrics,
  type AccountAnalyticsTarget,
  type AnalyticsSnapshotInput,
  type AnalyticsWindow,
  type NormalizedMetrics,
  type PostAnalyticsTarget,
  type StoredAnalyticsSnapshot,
} from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  AnalyticsSnapshotInsert,
  AnalyticsSnapshotRow,
  Database,
  Json,
  PublishJobRow,
  SocialAccountRow,
} from '../types'

export type AnalyticsSnapshotStore = {
  getSocialAccount(id: string): Promise<SocialAccountRow | null>
  getLatestPublishJobForVariant(contentVariantId: string): Promise<PublishJobRow | null>
  findAccountSnapshot(
    workspaceId: string,
    socialAccountId: string,
    captureWindow: AnalyticsWindow | null,
    capturedAt: string,
  ): Promise<AnalyticsSnapshotRow | null>
  findPostSnapshot(
    workspaceId: string,
    contentVariantId: string,
    capturedAt: string,
  ): Promise<AnalyticsSnapshotRow | null>
  insertSnapshot(input: AnalyticsSnapshotInsert): Promise<AnalyticsSnapshotRow>
  updateSnapshot(id: string, input: AnalyticsSnapshotInsert): Promise<AnalyticsSnapshotRow>
}

export type AnalyticsRepository = {
  getAccountTarget(socialAccountId: string): Promise<AccountAnalyticsTarget | null>
  getPostTarget(contentVariantId: string): Promise<PostAnalyticsTarget | null>
  upsertAccountSnapshot(
    target: AccountAnalyticsTarget,
    snapshot: AnalyticsSnapshotInput,
  ): Promise<StoredAnalyticsSnapshot>
  upsertPostSnapshot(
    target: PostAnalyticsTarget,
    snapshot: AnalyticsSnapshotInput,
  ): Promise<StoredAnalyticsSnapshot>
}

export function createAnalyticsRepository(store: AnalyticsSnapshotStore): AnalyticsRepository {
  return {
    async getAccountTarget(socialAccountId) {
      const account = await store.getSocialAccount(socialAccountId)
      if (!account) return null
      return {
        workspaceId: account.workspace_id,
        socialAccountId: account.id,
        providerAccountId: account.brightbean_account_id,
      }
    },

    async getPostTarget(contentVariantId) {
      const publishJob = await store.getLatestPublishJobForVariant(contentVariantId)
      if (!publishJob?.brightbean_publication_id) return null
      const account = await store.getSocialAccount(publishJob.social_account_id)
      if (!account) return null
      return {
        workspaceId: publishJob.workspace_id,
        socialAccountId: account.id,
        providerAccountId: account.brightbean_account_id,
        contentVariantId: publishJob.content_variant_id,
        publishJobId: publishJob.id,
        providerPostId: publishJob.brightbean_publication_id,
        externalPostId: publishJob.external_post_id,
      }
    },

    async upsertAccountSnapshot(target, snapshot) {
      const input = accountInsert(target, snapshot)
      const existing = await store.findAccountSnapshot(
        target.workspaceId,
        target.socialAccountId,
        snapshot.captureWindow,
        snapshot.capturedAt,
      )
      const row = existing
        ? await store.updateSnapshot(existing.id, input)
        : await store.insertSnapshot(input)
      return mapSnapshot(row)
    },

    async upsertPostSnapshot(target, snapshot) {
      const input = postInsert(target, snapshot)
      const existing = await store.findPostSnapshot(
        target.workspaceId,
        target.contentVariantId,
        snapshot.capturedAt,
      )
      const row = existing
        ? await store.updateSnapshot(existing.id, input)
        : await store.insertSnapshot(input)
      return mapSnapshot(row)
    },
  }
}

export function createSupabaseAnalyticsSnapshotStore(
  client: SupabaseClient<Database>,
): AnalyticsSnapshotStore {
  return {
    async getSocialAccount(id) {
      const { data, error } = await client.from('social_accounts').select('*').eq('id', id).maybeSingle()
      if (error) throw new Error('Failed to resolve social account for analytics')
      return data
    },

    async getLatestPublishJobForVariant(contentVariantId) {
      const { data, error } = await client
        .from('publish_jobs')
        .select('*')
        .eq('content_variant_id', contentVariantId)
        .eq('status', 'published')
        .not('brightbean_publication_id', 'is', null)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (error) throw new Error('Failed to resolve published post for analytics')
      return data
    },

    async findAccountSnapshot(workspaceId, socialAccountId, captureWindow, capturedAt) {
      const query = client
        .from('analytics_snapshots')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('social_account_id', socialAccountId)
        .is('content_variant_id', null)
        .eq('captured_at', capturedAt)
      const scoped = captureWindow === null
        ? query.is('capture_window', null)
        : query.eq('capture_window', captureWindow)
      const { data, error } = await scoped.maybeSingle()
      if (error) throw new Error('Failed to look up account analytics snapshot')
      return data
    },

    async findPostSnapshot(workspaceId, contentVariantId, capturedAt) {
      const { data, error } = await client
        .from('analytics_snapshots')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('content_variant_id', contentVariantId)
        .eq('captured_at', capturedAt)
        .maybeSingle()
      if (error) throw new Error('Failed to look up post analytics snapshot')
      return data
    },

    async insertSnapshot(input) {
      const { data, error } = await client.from('analytics_snapshots').insert(input).select('*').single()
      if (error) throw new Error('Failed to persist analytics snapshot')
      return data
    },

    async updateSnapshot(id, input) {
      const { data, error } = await client
        .from('analytics_snapshots')
        .update(input)
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw new Error('Failed to update analytics snapshot')
      return data
    },
  }
}

function accountInsert(
  target: AccountAnalyticsTarget,
  snapshot: AnalyticsSnapshotInput,
): AnalyticsSnapshotInsert {
  return baseInsert(target.workspaceId, snapshot, {
    social_account_id: target.socialAccountId,
    content_variant_id: null,
    publish_job_id: null,
  })
}

function postInsert(
  target: PostAnalyticsTarget,
  snapshot: AnalyticsSnapshotInput,
): AnalyticsSnapshotInsert {
  return baseInsert(target.workspaceId, snapshot, {
    social_account_id: target.socialAccountId,
    content_variant_id: target.contentVariantId,
    publish_job_id: target.publishJobId,
  })
}

function baseInsert(
  workspaceId: string,
  snapshot: AnalyticsSnapshotInput,
  target: Pick<AnalyticsSnapshotInsert, 'social_account_id' | 'content_variant_id' | 'publish_job_id'>,
): AnalyticsSnapshotInsert {
  return {
    workspace_id: workspaceId,
    ...target,
    external_post_id: snapshot.externalPostId,
    metrics_json: metricsToJson(snapshot.metrics),
    source: snapshot.source,
    source_version: snapshot.sourceVersion,
    capture_window: snapshot.captureWindow,
    captured_at: snapshot.capturedAt,
  }
}

function metricsToJson(metrics: NormalizedMetrics): Json {
  return { ...metrics }
}

function mapSnapshot(row: AnalyticsSnapshotRow): StoredAnalyticsSnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    socialAccountId: row.social_account_id,
    contentVariantId: row.content_variant_id,
    publishJobId: row.publish_job_id,
    source: row.source,
    sourceVersion: row.source_version,
    capturedAt: row.captured_at,
    captureWindow: isAnalyticsWindow(row.capture_window) ? row.capture_window : null,
    externalPostId: row.external_post_id,
    metrics: metricsFromJson(row.metrics_json),
  }
}

function isAnalyticsWindow(value: string | null): value is AnalyticsWindow {
  return value === '24h' || value === '7d' || value === '15d' || value === '30d' || value === '60d'
}

function metricsFromJson(value: Json): NormalizedMetrics {
  if (!value || Array.isArray(value) || typeof value !== 'object') return normalizeMetrics({})
  const input: Partial<Record<keyof NormalizedMetrics, number>> = {}
  for (const key of [
    'views',
    'reach',
    'impressions',
    'likes',
    'comments',
    'shares',
    'saves',
    'watchTimeMs',
    'retentionRate',
    'followerDelta',
  ] as const) {
    const metric = value[key]
    if (typeof metric === 'number') input[key] = metric
  }
  return normalizeMetrics(input)
}