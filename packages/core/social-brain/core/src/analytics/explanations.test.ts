import { describe, expect, it } from 'vitest'

import { buildTimeSlotExplanation } from './explanations'
import type { TimeSlotRecommendation } from './time-slot-ranking'

describe('buildTimeSlotExplanation', () => {
  it('keeps computed facts separate from hypotheses and carries evidence', () => {
    const result = buildTimeSlotExplanation(recommendation({
      objective: 'retention',
      localHour: 19,
      confidence: 'high',
      sampleSize: 12,
      objectiveMedian: 68,
      baselineMedian: 52,
      upliftPercent: 30.7692307692,
      evidenceSnapshotIds: ['a', 'b', 'c'],
    }), {
      recurringTraits: ['short-form videos', 'strong first-second hooks'],
    })

    expect(result.facts.join(' ')).toContain('19:00')
    expect(result.facts.join(' ')).toContain('68')
    expect(result.facts.join(' ')).not.toMatch(/caus/i)
    expect(result.hypotheses).toEqual([
      expect.stringContaining('may be associated with short-form videos'),
      expect.stringContaining('may be associated with strong first-second hooks'),
    ])
    expect(result.confidence).toBe('high')
    expect(result.evidenceSnapshotIds).toEqual(['a', 'b', 'c'])
  })

  it('adds caveats instead of a causal explanation when evidence is weak', () => {
    const result = buildTimeSlotExplanation(recommendation({
      confidence: 'low',
      sampleSize: 3,
      evidenceSnapshotIds: ['a', 'b', 'c'],
    }))

    expect(result.hypotheses).toEqual([])
    expect(result.caveats.join(' ')).toMatch(/limited|small|insufficient/i)
    expect([...result.facts, ...result.hypotheses, ...result.caveats].join(' ')).not.toMatch(/caused|causa|causou/i)
  })

  it('states missing baseline as a caveat instead of inventing an uplift', () => {
    const result = buildTimeSlotExplanation(recommendation({
      baselineMedian: null,
      upliftPercent: null,
      confidence: 'medium',
      sampleSize: 6,
    }))

    expect(result.facts.join(' ')).not.toContain('%')
    expect(result.caveats.join(' ')).toMatch(/baseline|comparison/i)
  })
})

function recommendation(overrides: Partial<{
  objective: TimeSlotRecommendation['objective']
  localHour: number
  confidence: TimeSlotRecommendation['confidence']
  sampleSize: number
  objectiveMedian: number
  baselineMedian: number | null
  upliftPercent: number | null
  evidenceSnapshotIds: string[]
}> = {}): TimeSlotRecommendation {
  return {
    objective: overrides.objective ?? 'reach',
    platform: 'instagram',
    localWeekday: 'tuesday',
    localHour: overrides.localHour ?? 18,
    score: overrides.objectiveMedian ?? 100,
    sampleSize: overrides.sampleSize ?? 5,
    confidence: overrides.confidence ?? 'medium',
    evidenceSnapshotIds: overrides.evidenceSnapshotIds ?? ['a', 'b', 'c', 'd', 'e'],
    outlierIds: [],
    comparisonMetrics: {
      reachMedian: 100,
      retentionMedian: 55,
      engagementMedian: 20,
      objectiveMedian: overrides.objectiveMedian ?? 100,
      baselineMedian: overrides.baselineMedian === undefined ? 80 : overrides.baselineMedian,
      upliftPercent: overrides.upliftPercent === undefined ? 25 : overrides.upliftPercent,
    },
  }
}
