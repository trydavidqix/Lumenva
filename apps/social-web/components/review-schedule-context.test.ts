import { describe, expect, it } from 'vitest'

import type { TimeSlotRecommendation } from '@lumenva/core'

import { assessReviewSchedule } from './review-schedule-assessment'

const recommendation: TimeSlotRecommendation = {
  objective: 'overall',
  platform: 'all',
  localWeekday: 'tuesday',
  localHour: 20,
  score: 88,
  sampleSize: 12,
  confidence: 'high',
  evidenceSnapshotIds: ['snapshot-1'],
  outlierIds: [],
  comparisonMetrics: {
    reachMedian: 1000,
    retentionMedian: 52,
    engagementMedian: 140,
    objectiveMedian: 88,
    baselineMedian: 70,
    upliftPercent: 25.7,
  },
}

describe('assessReviewSchedule', () => {
  it('warns when the proposed schedule differs from the strongest observed slot without mutating it', () => {
    const result = assessReviewSchedule('2026-08-18T13:00:00.000Z', 'Europe/Lisbon', recommendation)

    expect(result).toMatchObject({
      scheduledLocalWeekday: 'tuesday',
      scheduledLocalHour: 14,
      alignedWithBestOverall: false,
    })
    expect(result.message).toContain('não coincide')
  })

  it('recognizes an aligned schedule in the workspace timezone', () => {
    const result = assessReviewSchedule('2026-08-18T19:00:00.000Z', 'Europe/Lisbon', recommendation)
    expect(result.alignedWithBestOverall).toBe(true)
  })

  it('returns an evidence limitation instead of a recommendation when the sample is insufficient', () => {
    const result = assessReviewSchedule('2026-08-18T13:00:00.000Z', 'Europe/Lisbon', null)
    expect(result.alignedWithBestOverall).toBeNull()
    expect(result.message).toContain('amostra histórica suficiente')
  })
})
