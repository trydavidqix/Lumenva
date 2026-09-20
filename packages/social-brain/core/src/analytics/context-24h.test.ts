import { describe, expect, it } from 'vitest'

import { createAnalyticsContextService } from './context-service'
import { normalizeMetrics } from './normalize'

const AS_OF = '2026-08-18T12:00:00.000Z'

it('builds 24h metrics and baseline from post snapshots when no native account 24h aggregate exists', async () => {
  const evidence = [
    post('now-1', 'variant-1', '2026-08-18T10:00:00.000Z', 200, 50),
    post('now-2', 'variant-2', '2026-08-18T09:00:00.000Z', 100, 40),
    post('prev-1', 'variant-3', '2026-08-17T10:00:00.000Z', 100, 30),
  ]
  const service = createAnalyticsContextService({
    listEvidence: async () => evidence,
    getWorkspaceTimezone: async () => 'Europe/Lisbon',
    insertStrategyNote: async () => ({ id: 'note-1' }),
  })

  const result = await service.buildAnalyticsContext('workspace-1', AS_OF)
  const window = result.windows['24h']

  expect(window.metrics.views).toMatchObject({ sampleSize: 2, mean: 150, median: 150 })
  expect(window.metrics.retentionRate).toMatchObject({ sampleSize: 2, mean: 45, median: 45 })
  expect(window.baseline.viewsMeanDeltaPercent).toBe(50)
  expect(window.baseline.previousSampleSize).toBe(1)
  expect(window.baselineEvidenceSnapshotIds).toEqual(['prev-1'])
})

function post(id: string, variant: string, capturedAt: string, views: number, retentionRate: number) {
  return {
    id,
    workspaceId: 'workspace-1',
    socialAccountId: 'ig-account',
    contentVariantId: variant,
    platform: 'instagram' as const,
    capturedAt,
    publishedAt: '2026-08-17T19:00:00.000Z',
    captureWindow: null,
    externalPostId: `external-${id}`,
    metrics: normalizeMetrics({ views, retentionRate, likes: 10, comments: 2, shares: 1 }),
  }
}
