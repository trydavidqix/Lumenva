import { describe, expect, it } from 'vitest'

import { normalizeMetrics } from '../index'

const AS_OF = '2026-08-18T12:00:00.000Z'

function post(id: string, day: number, views: number, retention: number) {
  return {
    id,
    workspaceId: 'workspace-1',
    socialAccountId: 'ig-account',
    contentVariantId: `variant-${id}`,
    platform: 'instagram' as const,
    capturedAt: `2026-08-18T11:${String(day).padStart(2, '0')}:00.000Z`,
    publishedAt: `2026-08-${String(day).padStart(2, '0')}T19:00:00.000Z`,
    captureWindow: null,
    externalPostId: `external-${id}`,
    metrics: normalizeMetrics({ views, retentionRate: retention, likes: 10, comments: 2, shares: 1 }),
  }
}

describe('analytics insights service', () => {
  it('returns timezone-aware hourly detail, ranked slots and evidence-backed explanations', async () => {
    const mod = await import('./insights-service').catch(() => null)
    expect(mod, 'analytics insights service module must exist').not.toBeNull()
    if (!mod) return

    const evidence = [
      post('1', 4, 100, 40),
      post('2', 11, 120, 42),
      post('3', 18, 140, 44),
      post('4', 25, 160, 46),
      post('5', 32, 180, 48),
    ].map((row, index) => ({
      ...row,
      capturedAt: `2026-08-18T11:${String(index + 1).padStart(2, '0')}:00.000Z`,
      publishedAt: new Date(Date.UTC(2026, 7, 4 + index * 7, 19)).toISOString(),
    }))
    const repository = {
      listEvidence: async () => evidence,
      getWorkspaceTimezone: async () => 'Europe/Lisbon',
      insertStrategyNote: async () => ({ id: 'note-1' }),
    }

    const result = await mod.createAnalyticsInsightsService(repository).build('workspace-1', AS_OF)

    expect(result.timeZone).toBe('Europe/Lisbon')
    expect(result.hourly24h).toHaveLength(24)
    expect(result.hourly24hByPlatform.instagram).toHaveLength(24)
    expect(result.hourly24hByPlatform.youtube.every((bucket: { evidenceSnapshotIds: string[] }) => bucket.evidenceSnapshotIds.length === 0)).toBe(true)
    expect(result.timeSlots.all.reach).not.toBeNull()
    expect(result.timeSlots.byPlatform.instagram.reach).not.toBeNull()
    expect(result.explanations.reach?.facts.length).toBeGreaterThan(0)
    expect(result.explanations.reach?.evidenceSnapshotIds.length).toBeGreaterThan(0)
  })
})
