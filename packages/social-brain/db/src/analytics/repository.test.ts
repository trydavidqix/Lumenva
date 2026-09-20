import { describe, expect, it } from 'vitest'

import { normalizeMetrics, type AnalyticsSnapshotInput, type AnalyticsWindow } from '@lumenva/core'
import type { AnalyticsSnapshotInsert, AnalyticsSnapshotRow, PublishJobRow, SocialAccountRow } from '../types'

type MemoryState = {
  accounts: SocialAccountRow[]
  publishJobs: PublishJobRow[]
  snapshots: AnalyticsSnapshotRow[]
}

function makeStore(state: MemoryState) {
  return {
    getSocialAccount: async (id: string) => state.accounts.find((row) => row.id === id) ?? null,
    getLatestPublishJobForVariant: async (contentVariantId: string) =>
      [...state.publishJobs].reverse().find((row) => row.content_variant_id === contentVariantId) ?? null,
    findAccountSnapshot: async (
      workspaceId: string,
      socialAccountId: string,
      captureWindow: AnalyticsWindow | null,
      capturedAt: string,
    ) =>
      state.snapshots.find(
        (row) =>
          row.workspace_id === workspaceId &&
          row.social_account_id === socialAccountId &&
          row.content_variant_id === null &&
          row.capture_window === captureWindow &&
          row.captured_at === capturedAt,
      ) ?? null,
    findPostSnapshot: async (workspaceId: string, contentVariantId: string, capturedAt: string) =>
      state.snapshots.find(
        (row) =>
          row.workspace_id === workspaceId &&
          row.content_variant_id === contentVariantId &&
          row.captured_at === capturedAt,
      ) ?? null,
    insertSnapshot: async (input: AnalyticsSnapshotInsert) => {
      const row = toRow(`snapshot-${state.snapshots.length + 1}`, input)
      state.snapshots.push(row)
      return row
    },
    updateSnapshot: async (id: string, input: AnalyticsSnapshotInsert) => {
      const index = state.snapshots.findIndex((row) => row.id === id)
      if (index < 0) throw new Error('missing snapshot')
      const row = toRow(id, input)
      state.snapshots[index] = row
      return row
    },
  }
}

function toRow(id: string, input: AnalyticsSnapshotInsert): AnalyticsSnapshotRow {
  return {
    id,
    workspace_id: input.workspace_id,
    social_account_id: input.social_account_id ?? null,
    content_variant_id: input.content_variant_id ?? null,
    publish_job_id: input.publish_job_id ?? null,
    external_post_id: input.external_post_id ?? null,
    metrics_json: input.metrics_json ?? {},
    source: input.source ?? 'brightbean',
    source_version: input.source_version ?? null,
    capture_window: input.capture_window ?? null,
    captured_at: input.captured_at,
    created_at: input.created_at ?? '2026-08-17T12:00:00.000Z',
  }
}

function input(
  views: number,
  externalPostId: string | null = null,
  captureWindow: AnalyticsWindow | null = null,
): AnalyticsSnapshotInput {
  return {
    source: 'brightbean',
    sourceVersion: 'fixture-v1',
    capturedAt: '2026-08-17T12:00:00.000Z',
    captureWindow,
    externalPostId,
    metrics: normalizeMetrics({ views, likes: 10, saves: 2 }),
  }
}

describe('analytics repository', () => {
  it('deduplicates account snapshots per V1.1 capture window', async () => {
    const mod = await import('./repository').catch(() => null)
    expect(mod, 'analytics repository module must exist').not.toBeNull()
    if (!mod) return

    const state: MemoryState = {
      accounts: [accountRow()],
      publishJobs: [],
      snapshots: [],
    }
    const repository = mod.createAnalyticsRepository(makeStore(state))
    const target = await repository.getAccountTarget('account-local-1')
    expect(target).not.toBeNull()
    if (!target) return

    await repository.upsertAccountSnapshot(target, input(100, null, '7d'))
    await repository.upsertAccountSnapshot(target, input(250, null, '7d'))
    await repository.upsertAccountSnapshot(target, input(300, null, '15d'))
    await repository.upsertAccountSnapshot(target, input(500, null, '30d'))
    await repository.upsertAccountSnapshot(target, input(900, null, '60d'))

    expect(state.snapshots).toHaveLength(4)
    expect(state.snapshots.find((row) => row.capture_window === '7d')?.metrics_json).toMatchObject({ views: 250, saves: 2 })
    expect(state.snapshots.map((row) => row.capture_window).sort()).toEqual(['15d', '30d', '60d', '7d'])
    expect(state.snapshots.map((row) => row.capture_window)).not.toContain('90d')
  })

  it('resolves BrightBean and network post ids separately and deduplicates post snapshots', async () => {
    const mod = await import('./repository').catch(() => null)
    expect(mod, 'analytics repository module must exist').not.toBeNull()
    if (!mod) return

    const state: MemoryState = {
      accounts: [accountRow()],
      publishJobs: [publishJobRow()],
      snapshots: [],
    }
    const repository = mod.createAnalyticsRepository(makeStore(state))
    const target = await repository.getPostTarget('variant-1')
    expect(target).toMatchObject({
      providerPostId: 'brightbean-post-1',
      externalPostId: 'instagram-media-1',
    })
    if (!target) return

    await repository.upsertPostSnapshot(target, input(100, 'instagram-media-1'))
    await repository.upsertPostSnapshot(target, input(300, 'instagram-media-1'))

    expect(state.snapshots).toHaveLength(1)
    expect(state.snapshots[0]).toMatchObject({
      content_variant_id: 'variant-1',
      publish_job_id: 'publish-1',
      external_post_id: 'instagram-media-1',
    })
    expect(state.snapshots[0]?.metrics_json).toMatchObject({ views: 300, saves: 2 })
  })
})

function accountRow(): SocialAccountRow {
  return {
    id: 'account-local-1',
    workspace_id: 'workspace-1',
    platform: 'youtube',
    external_account_id: null,
    brightbean_account_id: 'account-brightbean-1',
    display_name: 'Lumenva',
    status: 'active',
    metadata: { provider: 'brightbean' },
    created_at: '2026-08-17T10:00:00.000Z',
    updated_at: '2026-08-17T10:00:00.000Z',
  }
}

function publishJobRow(): PublishJobRow {
  return {
    id: 'publish-1',
    workspace_id: 'workspace-1',
    content_item_id: 'content-1',
    content_variant_id: 'variant-1',
    social_account_id: 'account-local-1',
    approval_id: 'approval-1',
    platform: 'youtube',
    publish_mode: 'schedule',
    scheduled_for: '2026-08-17T11:00:00.000Z',
    status: 'published',
    idempotency_key: 'publish-key-1',
    brightbean_publication_id: 'brightbean-post-1',
    external_post_id: 'instagram-media-1',
    external_url: null,
    attempt_count: 1,
    last_error_code: null,
    last_error_message: null,
    created_at: '2026-08-17T10:00:00.000Z',
    updated_at: '2026-08-17T12:00:00.000Z',
    published_at: '2026-08-17T11:05:00.000Z',
  }
}
