import { describe, expect, it } from 'vitest'

import type {
  AnalyticsSnapshotRow,
  PublishJobRow,
  SocialAccountRow,
  StrategyNoteInsert,
  WorkspaceRow,
} from '../types'

describe('analytics query repository', () => {
  it('maps stored snapshots to provider-neutral evidence with publication time and workspace timezone', async () => {
    const mod = await import('./queries').catch(() => null)
    expect(mod, 'analytics queries module must exist').not.toBeNull()
    if (!mod) return

    const snapshots: AnalyticsSnapshotRow[] = [
      snapshotRow('snapshot-1', 'account-1', null, { views: 100, retentionRate: null }, '7d'),
      snapshotRow('snapshot-2', 'account-2', 'variant-2', { views: 250, retentionRate: 52, saves: 8 }, null),
    ]
    const accounts: SocialAccountRow[] = [accountRow('account-1', 'instagram'), accountRow('account-2', 'youtube')]
    const publishJobs: PublishJobRow[] = [publishJobRow('publish-variant-2', 'variant-2')]
    const workspace: WorkspaceRow = {
      id: 'workspace-1',
      owner_user_id: 'owner-1',
      name: 'Lumenva Social Brain',
      timezone: 'Europe/Lisbon',
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-01T00:00:00.000Z',
    }
    const inserted: StrategyNoteInsert[] = []

    const repository = mod.createAnalyticsQueryRepository({
      listSnapshots: async () => snapshots,
      listSocialAccounts: async () => accounts,
      listPublishJobs: async () => publishJobs,
      getWorkspace: async () => workspace,
      insertStrategyNote: async (input: StrategyNoteInsert) => {
        inserted.push(input)
        return { id: 'note-1' }
      },
    })

    const evidence = await repository.listEvidence(
      'workspace-1',
      '2026-08-01T00:00:00.000Z',
      '2026-08-17T12:00:00.000Z',
    )

    expect(evidence).toHaveLength(2)
    expect(evidence[0]).toMatchObject({
      id: 'snapshot-1',
      platform: 'instagram',
      contentVariantId: null,
      publishedAt: null,
      captureWindow: '7d',
      metrics: { views: 100, retentionRate: null },
    })
    expect(evidence[1]).toMatchObject({
      platform: 'youtube',
      contentVariantId: 'variant-2',
      publishedAt: '2026-08-16T19:00:00.000Z',
      captureWindow: null,
      metrics: { saves: 8 },
    })
    expect(await repository.getWorkspaceTimezone('workspace-1')).toBe('Europe/Lisbon')

    await repository.insertStrategyNote({
      workspaceId: 'workspace-1',
      summary: 'Evidence-backed note',
      evidenceSnapshotIds: ['snapshot-1', 'snapshot-2'],
      baselineStart: '2026-08-03T12:00:00.000Z',
      windowStart: '2026-08-10T12:00:00.000Z',
      windowEnd: '2026-08-17T12:00:00.000Z',
      windowLabel: '7d',
    })

    expect(inserted[0]).toMatchObject({
      workspace_id: 'workspace-1',
      summary: 'Evidence-backed note',
      window_start: '2026-08-10T12:00:00.000Z',
      window_end: '2026-08-17T12:00:00.000Z',
      evidence: {
        snapshotIds: ['snapshot-1', 'snapshot-2'],
        windowLabel: '7d',
        baselineStart: '2026-08-03T12:00:00.000Z',
      },
    })
  })
})

function snapshotRow(
  id: string,
  socialAccountId: string,
  contentVariantId: string | null,
  metricsJson: Record<string, number | null>,
  captureWindow: string | null,
): AnalyticsSnapshotRow {
  return {
    id,
    workspace_id: 'workspace-1',
    social_account_id: socialAccountId,
    content_variant_id: contentVariantId,
    publish_job_id: contentVariantId ? `publish-${contentVariantId}` : null,
    external_post_id: contentVariantId ? `external-${contentVariantId}` : null,
    metrics_json: metricsJson,
    source: 'brightbean',
    source_version: null,
    capture_window: captureWindow,
    captured_at: '2026-08-16T12:00:00.000Z',
    created_at: '2026-08-16T12:00:01.000Z',
  }
}

function accountRow(id: string, platform: 'instagram' | 'youtube'): SocialAccountRow {
  return {
    id,
    workspace_id: 'workspace-1',
    platform,
    external_account_id: null,
    brightbean_account_id: `bb-${id}`,
    display_name: platform,
    status: 'active',
    metadata: { provider: 'brightbean' },
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  }
}

function publishJobRow(id: string, contentVariantId: string): PublishJobRow {
  return {
    id,
    workspace_id: 'workspace-1',
    content_item_id: 'content-1',
    content_variant_id: contentVariantId,
    social_account_id: 'account-2',
    approval_id: 'approval-1',
    platform: 'youtube',
    publish_mode: 'schedule',
    scheduled_for: '2026-08-16T19:00:00.000Z',
    status: 'published',
    idempotency_key: `key-${id}`,
    brightbean_publication_id: 'bb-pub-1',
    external_post_id: 'external-variant-2',
    external_url: null,
    attempt_count: 1,
    last_error_code: null,
    last_error_message: null,
    created_at: '2026-08-16T18:00:00.000Z',
    updated_at: '2026-08-16T19:05:00.000Z',
    published_at: '2026-08-16T19:00:00.000Z',
  }
}
