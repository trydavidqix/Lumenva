import { expect, it } from 'vitest'

import { normalizeMetrics } from './normalize'
import { buildTimeSlotHeatmap } from './time-slot-heatmap'

it('builds weekday-hour cells with sample size, observed medians and normalized strength', () => {
  const cells = buildTimeSlotHeatmap([
    {
      snapshotId: 'a',
      postId: 'a',
      platform: 'instagram',
      publishedAt: '2026-08-18T18:00:00.000Z',
      metrics: normalizeMetrics({ views: 100, retentionRate: 40, likes: 10, comments: 2, shares: 1 }),
    },
    {
      snapshotId: 'b',
      postId: 'b',
      platform: 'instagram',
      publishedAt: '2026-08-18T18:30:00.000Z',
      metrics: normalizeMetrics({ views: 200, retentionRate: 50, likes: 20, comments: 4, shares: 2 }),
    },
  ], 'Europe/Lisbon')

  expect(cells).toHaveLength(1)
  expect(cells[0]).toMatchObject({
    localWeekday: 'tuesday',
    localHour: 19,
    sampleSize: 2,
    reachMedian: 150,
    retentionMedian: 45,
    engagementMedian: 19.5,
    strength: 1,
  })
})
