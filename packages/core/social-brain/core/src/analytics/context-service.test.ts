import { describe, expect, it } from 'vitest'

import { normalizeMetrics, type AnalyticsWindow } from '../index'

const AS_OF = '2026-08-17T12:00:00.000Z'

const evidence = [
  account('ig-now', 'instagram', '2026-08-16T12:00:00.000Z', { views: 100, retentionRate: null }),
  account('ig-six-days', 'instagram', '2026-08-11T12:00:00.000Z', { views: 70, retentionRate: null }),
  account('ig-30d-noise', 'instagram', '2026-08-16T11:00:00.000Z', { views: 9999 }, '30d'),
  account('boundary-seven-days', 'instagram', '2026-08-10T12:00:00.000Z', { views: 60, retentionRate: 0 }),
  account('baseline', 'instagram', '2026-08-09T12:00:00.000Z', { views: 50, retentionRate: null }),
  account('yt-now', 'youtube', '2026-08-16T13:00:00.000Z', {
    views: 200,
    retentionRate: 45,
    watchTimeMs: 60_000,
  }),
  post('post-old-snapshot', 'variant-1', 'instagram', '2026-08-15T10:00:00.000Z', 800, 15, 3, 2),
  post('post-latest-snapshot', 'variant-1', 'instagram', '2026-08-16T10:00:00.000Z', 1000, 20, 5, 4),
  post('post-second', 'variant-2', 'youtube', '2026-08-16T11:00:00.000Z', 900, 30, 4, 3),
  post('post-too-old', 'variant-3', 'youtube', '2026-08-08T11:00:00.000Z', 5000, 100, 20, 10),
]

describe('analytics context service', () => {
  it('uses the matching capture window and latest account snapshot per account', async () => {
    const mod = await import('./context-service').catch(() => null)
    expect(mod, 'analytics context service module must exist').not.toBeNull()
    if (!mod) return

    const repository = {
      listEvidence: async () => evidence,
      getWorkspaceTimezone: async () => 'Europe/Lisbon',
      insertStrategyNote: async () => ({ id: 'note-1' }),
    }
    const service = mod.createAnalyticsContextService(repository)
    const context = await service.buildAnalyticsContext('workspace-1', AS_OF)
    const window = context.windows['7d']

    expect(window.startAt).toBe('2026-08-10T12:00:00.000Z')
    expect(window.baselineStartAt).toBe('2026-08-03T12:00:00.000Z')
    expect(window.evidenceSnapshotIds).not.toContain('boundary-seven-days')
    expect(window.evidenceSnapshotIds).not.toContain('post-too-old')
    expect(window.evidenceSnapshotIds).not.toContain('ig-30d-noise')
    expect(window.evidenceSnapshotIds).not.toContain('ig-six-days')
    expect(window.baselineEvidenceSnapshotIds).toEqual(['boundary-seven-days'])
    expect(window.accountSampleSize).toBe(2)
    expect(window.metrics.views).toMatchObject({ sampleSize: 2, mean: 150, median: 150 })
    expect(window.metrics.retentionRate).toMatchObject({ sampleSize: 1, mean: 45, median: 45 })

    const instagram = window.perPlatform.find((item: { platform: string }) => item.platform === 'instagram')
    expect(instagram?.metrics.retentionRate).toMatchObject({ sampleSize: 0, mean: null, median: null })
    expect(instagram?.baseline.currentSampleSize).toBe(1)
    expect(instagram?.baseline.previousSampleSize).toBe(1)
    expect(instagram?.baseline.viewsMeanDeltaPercent).toBeCloseTo(66.6667, 3)

    const youtube = window.perPlatform.find((item: { platform: string }) => item.platform === 'youtube')
    expect(youtube?.baseline.previousSampleSize).toBe(0)
    expect(youtube?.baseline.viewsMeanDeltaPercent).toBeNull()

    expect(window.topPosts[0]).toMatchObject({
      contentVariantId: 'variant-1',
      snapshotId: 'post-latest-snapshot',
      views: 1000,
    })
    expect(window.topPosts.map((item: { contentVariantId: string }) => item.contentVariantId)).not.toContain('variant-3')
    expect(window.baseline.previousSampleSize).toBe(1)
  })

  it('records a strategy note with current and baseline evidence plus exact date bounds', async () => {
    const mod = await import('./context-service').catch(() => null)
    expect(mod, 'analytics context service module must exist').not.toBeNull()
    if (!mod) return

    const recorded: unknown[] = []
    const repository = {
      listEvidence: async () => evidence,
      getWorkspaceTimezone: async () => 'Europe/Lisbon',
      insertStrategyNote: async (input: unknown) => {
        recorded.push(input)
        return { id: 'note-1' }
      },
    }
    const service = mod.createAnalyticsContextService(repository)
    const context = await service.buildAnalyticsContext('workspace-1', AS_OF)
    const result = await service.recordStrategyNote(
      'workspace-1',
      'Instagram improved while YouTube retention stayed strongest.',
      context,
      '7d',
    )

    expect(result).toEqual({ id: 'note-1' })
    expect(recorded[0]).toMatchObject({
      workspaceId: 'workspace-1',
      summary: 'Instagram improved while YouTube retention stayed strongest.',
      baselineStart: '2026-08-03T12:00:00.000Z',
      windowStart: '2026-08-10T12:00:00.000Z',
      windowEnd: AS_OF,
    })
    expect((recorded[0] as { evidenceSnapshotIds: string[] }).evidenceSnapshotIds).toContain('ig-now')
    expect((recorded[0] as { evidenceSnapshotIds: string[] }).evidenceSnapshotIds).toContain('post-latest-snapshot')
    expect((recorded[0] as { evidenceSnapshotIds: string[] }).evidenceSnapshotIds).toContain('boundary-seven-days')
    expect((recorded[0] as { evidenceSnapshotIds: string[] }).evidenceSnapshotIds).not.toContain('ig-30d-noise')
  })
})

function account(
  id: string,
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube',
  capturedAt: string,
  metrics: Parameters<typeof normalizeMetrics>[0],
  captureWindow: AnalyticsWindow = '7d',
) {
  return {
    id,
    workspaceId: 'workspace-1',
    socialAccountId: `${platform}-account`,
    contentVariantId: null,
    platform,
    capturedAt,
    publishedAt: null,
    captureWindow,
    externalPostId: null,
    metrics: normalizeMetrics(metrics),
  }
}

function post(
  id: string,
  contentVariantId: string,
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube',
  capturedAt: string,
  views: number,
  likes: number,
  comments: number,
  shares: number,
) {
  return {
    id,
    workspaceId: 'workspace-1',
    socialAccountId: `${platform}-account`,
    contentVariantId,
    platform,
    capturedAt,
    publishedAt: '2026-08-15T19:00:00.000Z',
    captureWindow: null,
    externalPostId: `external-${contentVariantId}`,
    metrics: normalizeMetrics({ views, likes, comments, shares }),
  }
}
