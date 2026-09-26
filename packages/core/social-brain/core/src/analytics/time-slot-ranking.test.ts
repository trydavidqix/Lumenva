import { describe, expect, it } from 'vitest'

import { normalizeMetrics } from './normalize'
import { rankPostingTimes, type TimeSlotPostEvidence } from './time-slot-ranking'

const TZ = 'Europe/Lisbon'

describe('rankPostingTimes', () => {
  it('does not let one viral post win below the minimum sample size', () => {
    const posts = [
      post('viral', 'instagram', '2026-08-17T22:00:00Z', { views: 1_000_000, reach: 900_000 }),
      post('steady-1', 'instagram', '2026-08-18T18:00:00Z', { views: 10_000, reach: 8_000 }),
      post('steady-2', 'instagram', '2026-08-11T18:00:00Z', { views: 11_000, reach: 8_500 }),
      post('steady-3', 'instagram', '2026-08-04T18:00:00Z', { views: 9_000, reach: 7_500 }),
    ]

    const ranked = rankPostingTimes(posts, TZ, 'instagram')

    expect(ranked.reach).toMatchObject({ localHour: 19, sampleSize: 3 })
    expect(ranked.reach?.evidenceSnapshotIds).toEqual(expect.arrayContaining(['steady-1', 'steady-2', 'steady-3']))
    expect(ranked.reach?.evidenceSnapshotIds).not.toContain('viral')
  })

  it('can choose different winners for reach, retention and engagement', () => {
    const posts = [
      ...slot('reach', 'instagram', 17, [
        { reach: 10_000, retentionRate: 35, likes: 200, comments: 20, shares: 10 },
        { reach: 11_000, retentionRate: 34, likes: 210, comments: 18, shares: 12 },
        { reach: 9_500, retentionRate: 36, likes: 190, comments: 21, shares: 11 },
      ]),
      ...slot('retention', 'instagram', 19, [
        { reach: 7_000, retentionRate: 72, likes: 150, comments: 15, shares: 8 },
        { reach: 7_200, retentionRate: 70, likes: 160, comments: 16, shares: 9 },
        { reach: 6_900, retentionRate: 74, likes: 155, comments: 14, shares: 10 },
      ]),
      ...slot('engagement', 'instagram', 21, [
        { reach: 6_000, retentionRate: 50, likes: 500, comments: 80, shares: 40, saves: 60 },
        { reach: 6_100, retentionRate: 49, likes: 520, comments: 75, shares: 42, saves: 65 },
        { reach: 5_900, retentionRate: 51, likes: 510, comments: 82, shares: 38, saves: 62 },
      ]),
    ]

    const ranked = rankPostingTimes(posts, 'UTC', 'instagram')

    expect(ranked.reach?.localHour).toBe(17)
    expect(ranked.retention?.localHour).toBe(19)
    expect(ranked.engagement?.localHour).toBe(21)
  })

  it('raises confidence with sample size and consistency', () => {
    const low = rankPostingTimes(slot('low', 'instagram', 18, [
      { reach: 100 }, { reach: 102 }, { reach: 101 },
    ]), 'UTC', 'instagram')
    const medium = rankPostingTimes(slot('medium', 'instagram', 18, [
      { reach: 100 }, { reach: 101 }, { reach: 102 }, { reach: 100 }, { reach: 101 },
    ]), 'UTC', 'instagram')
    const high = rankPostingTimes(slot('high', 'instagram', 18, Array.from({ length: 10 }, (_, index) => ({ reach: 100 + (index % 2) }))), 'UTC', 'instagram')

    expect(low.reach?.confidence).toBe('low')
    expect(medium.reach?.confidence).toBe('medium')
    expect(high.reach?.confidence).toBe('high')
  })

  it('does not mix metric scales when calculating overall confidence', () => {
    const consistent = slot('overall-high', 'instagram', 18, Array.from({ length: 10 }, (_, index) => ({
      reach: 10_000 + (index % 2) * 100,
      retentionRate: 60 + (index % 2),
      likes: 500 + (index % 2) * 5,
      comments: 40,
      shares: 20,
      saves: 30,
    })))

    const ranked = rankPostingTimes(consistent, 'UTC', 'instagram')
    expect(ranked.reach?.confidence).toBe('high')
    expect(ranked.retention?.confidence).toBe('high')
    expect(ranked.engagement?.confidence).toBe('high')
    expect(ranked.overall?.confidence).toBe('high')
  })

  it('builds overall score from only the objectives actually available', () => {
    const posts = [
      ...slot('tiktok-a', 'tiktok', 18, [
        { views: 1000, likes: 100, comments: 10, shares: 10 },
        { views: 1100, likes: 105, comments: 11, shares: 9 },
        { views: 900, likes: 95, comments: 9, shares: 11 },
      ]),
      ...slot('tiktok-b', 'tiktok', 20, [
        { views: 700, likes: 300, comments: 50, shares: 30 },
        { views: 720, likes: 310, comments: 45, shares: 35 },
        { views: 680, likes: 290, comments: 55, shares: 28 },
      ]),
    ]

    const ranked = rankPostingTimes(posts, 'UTC', 'tiktok')

    expect(ranked.overall).not.toBeNull()
    expect(ranked.overall?.comparisonMetrics.retentionMedian).toBeNull()
    expect(Number.isFinite(ranked.overall?.score ?? Number.NaN)).toBe(true)
  })

  it('supports all-platform and per-platform ranking independently', () => {
    const posts = [
      ...slot('ig', 'instagram', 18, [{ reach: 100 }, { reach: 110 }, { reach: 105 }]),
      ...slot('yt', 'youtube', 20, [{ reach: 500 }, { reach: 520 }, { reach: 510 }]),
    ]

    expect(rankPostingTimes(posts, 'UTC', 'instagram').reach?.localHour).toBe(18)
    expect(rankPostingTimes(posts, 'UTC', 'youtube').reach?.localHour).toBe(20)
    expect(rankPostingTimes(posts, 'UTC', 'all').reach?.localHour).toBe(20)
  })
})

function slot(
  prefix: string,
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube',
  utcHour: number,
  metrics: Array<Parameters<typeof normalizeMetrics>[0]>,
): TimeSlotPostEvidence[] {
  return metrics.map((metric, index) => post(
    `${prefix}-${index + 1}`,
    platform,
    new Date(Date.UTC(2026, 7, 18 - index * 7, utcHour)).toISOString(),
    metric,
  ))
}

function post(
  id: string,
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube',
  publishedAt: string,
  metrics: Parameters<typeof normalizeMetrics>[0],
): TimeSlotPostEvidence {
  return {
    snapshotId: id,
    postId: id,
    platform,
    publishedAt,
    metrics: normalizeMetrics(metrics),
  }
}
