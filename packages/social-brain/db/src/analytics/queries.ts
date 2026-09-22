import {
  normalizeMetrics,
  type AnalyticsContextRepository,
  type AnalyticsEvidenceSnapshot,
  type AnalyticsWindow,
  type NormalizedMetrics,
  type SocialPlatform,
  type StrategyNoteRequest,
} from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  AnalyticsSnapshotRow,
  Database,
  Json,
  PublishJobRow,
  SocialAccountRow,
  StrategyNoteInsert,
  WorkspaceRow,
} from '../types'

export type AnalyticsQueryStore = {
  listSnapshots(workspaceId: string, from: string, to: string): Promise<AnalyticsSnapshotRow[]>
  listSocialAccounts(ids: string[]): Promise<SocialAccountRow[]>
  listPublishJobs(ids: string[]): Promise<PublishJobRow[]>
  getWorkspace(workspaceId: string): Promise<(WorkspaceRow & { timezone?: string }) | null>
  insertStrategyNote(input: StrategyNoteInsert): Promise<{ id: string }>
}

export function createAnalyticsQueryRepository(
  store: AnalyticsQueryStore,
): AnalyticsContextRepository {
  return {
    async listEvidence(workspaceId, from, to) {
      const snapshots = await store.listSnapshots(workspaceId, from, to)
      const accountIds = [...new Set(
        snapshots
          .map((row) => row.social_account_id)
          .filter((id): id is string => typeof id === 'string'),
      )]
      const publishJobIds = [...new Set(
        snapshots
          .map((row) => row.publish_job_id)
          .filter((id): id is string => typeof id === 'string'),
      )]
      const [accounts, publishJobs] = await Promise.all([
        store.listSocialAccounts(accountIds),
        store.listPublishJobs(publishJobIds),
      ])
      const platformByAccount = new Map(accounts.map((row) => [row.id, row.platform as SocialPlatform]))
      const publishedAtByJob = new Map(publishJobs.map((row) => [row.id, row.published_at]))

      return snapshots.flatMap((row): AnalyticsEvidenceSnapshot[] => {
        if (!row.social_account_id) return []
        const platform = platformByAccount.get(row.social_account_id)
        if (!platform) return []
        return [{
          id: row.id,
          workspaceId: row.workspace_id,
          socialAccountId: row.social_account_id,
          contentVariantId: row.content_variant_id,
          platform,
          capturedAt: row.captured_at,
          publishedAt: row.publish_job_id ? (publishedAtByJob.get(row.publish_job_id) ?? null) : null,
          captureWindow: parseCaptureWindow(row.capture_window),
          externalPostId: row.external_post_id,
          metrics: metricsFromJson(row.metrics_json),
        }]
      })
    },

    async getWorkspaceTimezone(workspaceId) {
      const workspace = await store.getWorkspace(workspaceId)
      const timezone = workspace?.timezone?.trim()
      return timezone || 'UTC'
    },

    async insertStrategyNote(input) {
      return store.insertStrategyNote(strategyNoteInsert(input))
    },
  }
}

export function createSupabaseAnalyticsQueryStore(
  client: SupabaseClient<Database>,
): AnalyticsQueryStore {
  return {
    async listSnapshots(workspaceId, from, to) {
      const { data, error } = await client
        .from('analytics_snapshots')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gt('captured_at', from)
        .lte('captured_at', to)
        .order('captured_at', { ascending: true })
      if (error) throw new Error('Failed to list analytics evidence')
      return data ?? []
    },

    async listSocialAccounts(ids) {
      if (ids.length === 0) return []
      const { data, error } = await client
        .from('social_accounts')
        .select('*')
        .in('id', ids)
      if (error) throw new Error('Failed to resolve analytics evidence platforms')
      return data ?? []
    },

    async listPublishJobs(ids) {
      if (ids.length === 0) return []
      const { data, error } = await client
        .from('publish_jobs')
        .select('*')
        .in('id', ids)
      if (error) throw new Error('Failed to resolve analytics publication timestamps')
      return data ?? []
    },

    async getWorkspace(workspaceId) {
      const { data, error } = await client
        .from('organizations')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle()
      if (error) throw new Error('Failed to resolve workspace analytics timezone')
      return data as (WorkspaceRow & { timezone?: string }) | null
    },

    async insertStrategyNote(input) {
      const { data, error } = await client
        .from('strategy_notes')
        .insert(input)
        .select('id')
        .single()
      if (error) throw new Error('Failed to persist strategy note')
      return data
    },
  }
}

function strategyNoteInsert(input: StrategyNoteRequest): StrategyNoteInsert {
  return {
    workspace_id: input.workspaceId,
    summary: input.summary,
    evidence: {
      snapshotIds: input.evidenceSnapshotIds,
      windowLabel: input.windowLabel,
      baselineStart: input.baselineStart,
    },
    window_start: input.windowStart,
    window_end: input.windowEnd,
  }
}

function parseCaptureWindow(value: string | null): AnalyticsWindow | null {
  return value === '24h' || value === '7d' || value === '15d' || value === '30d' || value === '60d'
    ? value
    : null
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
