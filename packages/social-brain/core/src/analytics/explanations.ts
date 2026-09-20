import type { AnalyticsConfidence, TimeSlotRecommendation } from './time-slot-ranking'

export type AnalyticsExplanation = {
  facts: string[]
  hypotheses: string[]
  confidence: AnalyticsConfidence
  evidenceSnapshotIds: string[]
  caveats: string[]
}

export type TimeSlotExplanationContext = {
  recurringTraits?: string[]
}

const OBJECTIVE_LABEL: Record<TimeSlotRecommendation['objective'], string> = {
  reach: 'reach',
  retention: 'retention',
  engagement: 'engagement',
  overall: 'overall performance',
}

export function buildTimeSlotExplanation(
  recommendation: TimeSlotRecommendation,
  context: TimeSlotExplanationContext = {},
): AnalyticsExplanation {
  const facts: string[] = []
  const hypotheses: string[] = []
  const caveats: string[] = []
  const metric = OBJECTIVE_LABEL[recommendation.objective]
  const weekday = recommendation.localWeekday
  const hour = String(recommendation.localHour).padStart(2, '0')

  facts.push(
    `${weekday} at ${hour}:00 is the strongest observed slot for ${metric} in this comparison, with median ${formatNumber(recommendation.comparisonMetrics.objectiveMedian)} across ${recommendation.sampleSize} posts.`,
  )

  if (
    recommendation.comparisonMetrics.baselineMedian !== null
    && recommendation.comparisonMetrics.upliftPercent !== null
  ) {
    facts.push(
      `The observed median is ${formatPercent(recommendation.comparisonMetrics.upliftPercent)} versus the comparison baseline median of ${formatNumber(recommendation.comparisonMetrics.baselineMedian)}.`,
    )
  } else {
    caveats.push('A reliable comparison baseline is unavailable, so no uplift percentage is claimed.')
  }

  if (recommendation.outlierIds.length > 0) {
    caveats.push(
      `${recommendation.outlierIds.length} outlier ${recommendation.outlierIds.length === 1 ? 'observation was' : 'observations were'} flagged and should be inspected separately.`,
    )
  }

  if (recommendation.confidence === 'low' || recommendation.sampleSize < 5) {
    caveats.push('Evidence is limited by a small or inconsistent sample; treat this time slot as a test candidate, not a proven cause of performance.')
  } else {
    for (const trait of uniqueNonEmpty(context.recurringTraits ?? [])) {
      hypotheses.push(
        `The stronger result may be associated with ${trait}; this is a correlation hypothesis, not a causal conclusion.`,
      )
    }
  }

  if (hypotheses.length === 0 && recommendation.confidence !== 'low') {
    caveats.push('No recurring content trait has enough evidence to explain why this slot performed better.')
  }

  return {
    facts,
    hypotheses,
    confidence: recommendation.confidence,
    evidenceSnapshotIds: [...new Set(recommendation.evidenceSnapshotIds)],
    caveats,
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '')
}

function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
