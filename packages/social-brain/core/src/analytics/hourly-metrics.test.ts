import { describe, expect, it } from 'vitest'

import { normalizeMetrics } from './normalize'
import type { AnalyticsEvidenceSnapshot } from './context-service'
import { buildRolling24hBuckets } from './hourly-analysis'

const AS_OF = '2026-08-18T12:00:00.000Z'

it('computes hourly changes only when a previous snapshot exists and keeps retention as an observed median', () => {
  const evidence: AnalyticsEvidenceSnapshot[] = [
    snapshot('before', 'variant-1', '2026-08-18T10:00:00.000Z', { views: 100, likes: 10, comments: 2, shares: 1, saves: 3, retentionRate: 40 }),
    snapshot('inside', 'variant-1', '2026-08-18T11:30:00.000Z', { views: 160, likes: 16, comments: 3, shares: 2, saves: 5, retentionRate: 48 }),
    snapshot('new-post', 'variant-2', '2026-08-18T11:40:00.000Z', { views: 1000, likes: 100, comments: 20, shares: 10, saves: 50, retentionRate: 70 }),
  ]

  const last = buildRolling24hBuckets(evidence, AS_OF, 'Europe/Lisbon')[23]!

  expect(last.metrics).toEqual({
    viewsDelta: 60,
    interactionsDelta: 8,
    savesDelta: 2,
    retentionMedian: 59,
    comparablePostCount: 1,
    observedPostCount: 2,
  })
  expect(last.metrics.viewsDelta).not.toBe(1060)
})

it('computes the equivalent metrics for the previous-day comparison bucket', () => {
  const evidence: AnalyticsEvidenceSnapshot[] = [
    snapshot('baseline-before', 'variant-1', '2026-08-17T10:00:00.000Z', { views: 20, likes: 2, comments: 0, shares: 0, saves: 0, retentionRate: 30 }),
    snapshot('baseline-inside', 'variant-1', '2026-08-17T11:30:00.000Z', { views: 50, likes: 5, comments: 1, shares: 1, saves: 1, retentionRate: 35 }),
  ]

  const last = buildRolling24hBuckets(evidence, AS_OF, 'Europe/Lisbon')[23]!
  expect(last.baselineMetrics).toMatchObject({
    viewsDelta: 30,
    interactionsDelta: 5,
    savesDelta: 1,
    retentionMedian: 35,
    comparablePostCount: 1,
  })
})

function snapshot(
  id: string,
  contentVariantId: string,
  capturedAt: string,
  metrics: Parameters<typeof normalizeMetrics>[0],
): AnalyticsEvidenceSnapshot {
  return {
    id,
    workspaceId: 'workspace-1',
    socialAccountId: 'instagram-account',
    contentVariantId,
    platform: 'instagram',
    capturedAt,
    publishedAt: '2026-08-17T19:00:00.000Z',
    captureWindow: null,
    externalPostId: `external-${contentVariantId}`,
    metrics: normalizeMetrics(metrics),
  }
}
