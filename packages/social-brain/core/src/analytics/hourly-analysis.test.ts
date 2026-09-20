import { describe, expect, it } from 'vitest'

import { normalizeMetrics } from './normalize'
import type { AnalyticsEvidenceSnapshot } from './context-service'
import { buildRolling24hBuckets, groupPostsByLocalSlot } from './hourly-analysis'

const AS_OF = '2026-08-18T12:00:00.000Z'

describe('buildRolling24hBuckets', () => {
  it('returns exactly 24 chronological buckets including empty hours', () => {
    const buckets = buildRolling24hBuckets([], AS_OF, 'Europe/Lisbon')

    expect(buckets).toHaveLength(24)
    expect(buckets[0]).toMatchObject({
      startAt: '2026-08-17T12:00:00.000Z',
      endAt: '2026-08-17T13:00:00.000Z',
      localHour: 13,
    })
    expect(buckets[23]).toMatchObject({
      startAt: '2026-08-18T11:00:00.000Z',
      endAt: AS_OF,
      localHour: 12,
    })
  })

  it('uses exclusive-start/inclusive-end boundaries and pairs prior-day evidence', () => {
    const evidence = [
      snapshot('outside-current-start', '2026-08-17T12:00:00.000Z'),
      snapshot('current-first', '2026-08-17T12:30:00.000Z'),
      snapshot('current-first-end', '2026-08-17T13:00:00.000Z'),
      snapshot('current-second', '2026-08-17T13:30:00.000Z'),
      snapshot('baseline-first', '2026-08-16T12:30:00.000Z'),
      snapshot('baseline-first-end', '2026-08-16T13:00:00.000Z'),
    ]

    const buckets = buildRolling24hBuckets(evidence, AS_OF, 'Europe/Lisbon')

    expect(buckets[0]?.evidenceSnapshotIds).toEqual(['current-first', 'current-first-end'])
    expect(buckets[0]?.baselineEvidenceSnapshotIds).toEqual(['baseline-first', 'baseline-first-end'])
    expect(buckets[1]?.evidenceSnapshotIds).toEqual(['current-second'])
    expect(buckets.flatMap((bucket) => bucket.evidenceSnapshotIds)).not.toContain('outside-current-start')
  })

  it('keeps 24 UTC buckets across DST while allowing repeated/skipped local hours', () => {
    const fall = buildRolling24hBuckets([], '2026-10-25T03:00:00.000Z', 'Europe/Lisbon')
    const spring = buildRolling24hBuckets([], '2026-03-29T03:00:00.000Z', 'Europe/Lisbon')

    expect(fall).toHaveLength(24)
    expect(spring).toHaveLength(24)
    expect(fall.filter((bucket) => bucket.localWeekday === 'sunday' && bucket.localHour === 1)).toHaveLength(2)
    expect(spring.filter((bucket) => bucket.localWeekday === 'sunday' && bucket.localHour === 1)).toHaveLength(0)
  })
})

describe('groupPostsByLocalSlot', () => {
  it('groups publication timestamps by workspace-local weekday and hour', () => {
    const groups = groupPostsByLocalSlot([
      { id: 'summer', publishedAt: '2026-08-18T12:15:00.000Z' },
      { id: 'winter', publishedAt: '2026-01-20T13:15:00.000Z' },
    ], 'Europe/Lisbon')

    const summer = groups.find((slot) => slot.postIds.includes('summer'))
    const winter = groups.find((slot) => slot.postIds.includes('winter'))
    expect(summer).toMatchObject({ localWeekday: 'tuesday', localHour: 13 })
    expect(winter).toMatchObject({ localWeekday: 'tuesday', localHour: 13 })
  })
})

function snapshot(id: string, capturedAt: string): AnalyticsEvidenceSnapshot {
  return {
    id,
    workspaceId: 'workspace-1',
    socialAccountId: 'instagram-account',
    contentVariantId: 'variant-1',
    platform: 'instagram',
    capturedAt,
    publishedAt: null,
    captureWindow: null,
    externalPostId: 'post-1',
    metrics: normalizeMetrics({ views: 100 }),
  }
}
