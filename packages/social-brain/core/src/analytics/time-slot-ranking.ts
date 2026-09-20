import type { NormalizedMetrics } from './types'
import { engagementActions, percentDelta, summarizeNumbers } from './statistics'
import { groupPostsByLocalSlot, type LocalWeekday } from './hourly-analysis'
import type { SocialPlatform } from '../social/types'

export const MIN_SLOT_SAMPLE_SIZE = 3

export type TimeSlotObjective = 'reach' | 'retention' | 'engagement' | 'overall'
export type AnalyticsConfidence = 'low' | 'medium' | 'high'
export type TimeSlotPlatform = SocialPlatform | 'all'

export type TimeSlotPostEvidence = {
  snapshotId: string
  postId: string
  platform: SocialPlatform
  publishedAt: string
  metrics: NormalizedMetrics
}

export type TimeSlotComparisonMetrics = {
  reachMedian: number | null
  retentionMedian: number | null
  engagementMedian: number | null
  objectiveMedian: number
  baselineMedian: number | null
  upliftPercent: number | null
}

export type TimeSlotRecommendation = {
  objective: TimeSlotObjective
  platform: TimeSlotPlatform
  localWeekday: LocalWeekday
  localHour: number
  score: number
  sampleSize: number
  confidence: AnalyticsConfidence
  evidenceSnapshotIds: string[]
  outlierIds: string[]
  comparisonMetrics: TimeSlotComparisonMetrics
}

export type TimeSlotRecommendations = Record<TimeSlotObjective, TimeSlotRecommendation | null>

type ObjectiveSignal = Exclude<TimeSlotObjective, 'overall'>

type SignalPoint = {
  snapshotId: string
  value: number
}

type SlotSummary = {
  localWeekday: LocalWeekday
  localHour: number
  posts: TimeSlotPostEvidence[]
  signals: Record<ObjectiveSignal, SignalPoint[]>
  medians: Record<ObjectiveSignal, number | null>
  outliers: Record<ObjectiveSignal, string[]>
}

export function rankPostingTimes(
  posts: TimeSlotPostEvidence[],
  timeZone: string,
  platform: TimeSlotPlatform = 'all',
): TimeSlotRecommendations {
  const scoped = platform === 'all' ? posts : posts.filter((post) => post.platform === platform)
  const summaries = buildSlotSummaries(scoped, timeZone)

  return {
    reach: winnerForObjective(summaries, 'reach', platform),
    retention: winnerForObjective(summaries, 'retention', platform),
    engagement: winnerForObjective(summaries, 'engagement', platform),
    overall: winnerForOverall(summaries, platform),
  }
}

function buildSlotSummaries(posts: TimeSlotPostEvidence[], timeZone: string): SlotSummary[] {
  const bySnapshotId = new Map(posts.map((post) => [post.snapshotId, post]))
  const groups = groupPostsByLocalSlot(
    posts.map((post) => ({ id: post.snapshotId, publishedAt: post.publishedAt })),
    timeZone,
  )

  return groups.map((group) => {
    const slotPosts = group.postIds
      .map((id) => bySnapshotId.get(id))
      .filter((post): post is TimeSlotPostEvidence => post !== undefined)
    const signals = {
      reach: points(slotPosts, reachSignal),
      retention: points(slotPosts, (post) => post.metrics.retentionRate),
      engagement: points(slotPosts, (post) => engagementActions(post.metrics)),
    } satisfies Record<ObjectiveSignal, SignalPoint[]>

    return {
      localWeekday: group.localWeekday,
      localHour: group.localHour,
      posts: slotPosts,
      signals,
      medians: {
        reach: medianOfPoints(signals.reach),
        retention: medianOfPoints(signals.retention),
        engagement: medianOfPoints(signals.engagement),
      },
      outliers: {
        reach: outlierIds(signals.reach),
        retention: outlierIds(signals.retention),
        engagement: outlierIds(signals.engagement),
      },
    }
  })
}

function winnerForObjective(
  summaries: SlotSummary[],
  objective: ObjectiveSignal,
  platform: TimeSlotPlatform,
): TimeSlotRecommendation | null {
  const eligible = summaries.filter((slot) => slot.signals[objective].length >= MIN_SLOT_SAMPLE_SIZE && slot.medians[objective] !== null)
  if (eligible.length === 0) return null

  const winner = [...eligible].sort((a, b) => (b.medians[objective] ?? -Infinity) - (a.medians[objective] ?? -Infinity))[0]
  if (!winner) return null

  const objectiveMedian = winner.medians[objective]
  if (objectiveMedian === null) return null
  const baselineMedian = summarizeNumbers(eligible.map((slot) => slot.medians[objective])).median

  return {
    objective,
    platform,
    localWeekday: winner.localWeekday,
    localHour: winner.localHour,
    score: objectiveMedian,
    sampleSize: winner.signals[objective].length,
    confidence: confidenceFor(winner.signals[objective].map((point) => point.value)),
    evidenceSnapshotIds: winner.signals[objective].map((point) => point.snapshotId),
    outlierIds: winner.outliers[objective],
    comparisonMetrics: {
      reachMedian: winner.medians.reach,
      retentionMedian: winner.medians.retention,
      engagementMedian: winner.medians.engagement,
      objectiveMedian,
      baselineMedian,
      upliftPercent: percentDelta(objectiveMedian, baselineMedian),
    },
  }
}

function winnerForOverall(
  summaries: SlotSummary[],
  platform: TimeSlotPlatform,
): TimeSlotRecommendation | null {
  const objectives: ObjectiveSignal[] = ['reach', 'retention', 'engagement']
  const normalizedByObjective = new Map<ObjectiveSignal, Map<SlotSummary, number>>()

  for (const objective of objectives) {
    const eligible = summaries.filter((slot) => slot.signals[objective].length >= MIN_SLOT_SAMPLE_SIZE && slot.medians[objective] !== null)
    const values = eligible.map((slot) => slot.medians[objective] as number)
    if (values.length === 0) continue
    const min = Math.min(...values)
    const max = Math.max(...values)
    normalizedByObjective.set(objective, new Map(
      eligible.map((slot) => [slot, max === min ? 1 : ((slot.medians[objective] as number) - min) / (max - min)]),
    ))
  }

  const candidates = summaries.flatMap((slot) => {
    if (slot.posts.length < MIN_SLOT_SAMPLE_SIZE) return []
    const values = objectives.flatMap((objective) => {
      const value = normalizedByObjective.get(objective)?.get(slot)
      return value === undefined ? [] : [value]
    })
    if (values.length === 0) return []
    return [{ slot, composite: values.reduce((sum, value) => sum + value, 0) / values.length }]
  })
  if (candidates.length === 0) return null

  const winner = [...candidates].sort((a, b) => b.composite - a.composite)[0]
  if (!winner) return null
  const score = winner.composite * 100
  const baselineMedian = summarizeNumbers(candidates.map((candidate) => candidate.composite * 100)).median
  const outliers = [...new Set(objectives.flatMap((objective) => winner.slot.outliers[objective]))]

  return {
    objective: 'overall',
    platform,
    localWeekday: winner.slot.localWeekday,
    localHour: winner.slot.localHour,
    score,
    sampleSize: winner.slot.posts.length,
    confidence: overallConfidenceFor(winner.slot, objectives),
    evidenceSnapshotIds: winner.slot.posts.map((post) => post.snapshotId),
    outlierIds: outliers,
    comparisonMetrics: {
      reachMedian: winner.slot.medians.reach,
      retentionMedian: winner.slot.medians.retention,
      engagementMedian: winner.slot.medians.engagement,
      objectiveMedian: score,
      baselineMedian,
      upliftPercent: percentDelta(score, baselineMedian),
    },
  }
}

function overallConfidenceFor(slot: SlotSummary, objectives: ObjectiveSignal[]): AnalyticsConfidence {
  const levels = objectives.flatMap((objective) => {
    const values = slot.signals[objective].map((point) => point.value)
    if (values.length < MIN_SLOT_SAMPLE_SIZE) return []
    return [confidenceFor(values)]
  })
  if (levels.length === 0) return 'low'
  if (levels.includes('low')) return 'low'
  if (levels.includes('medium')) return 'medium'
  return 'high'
}

function points(
  posts: TimeSlotPostEvidence[],
  getter: (post: TimeSlotPostEvidence) => number | null,
): SignalPoint[] {
  return posts.flatMap((post) => {
    const value = getter(post)
    return value === null || !Number.isFinite(value) ? [] : [{ snapshotId: post.snapshotId, value }]
  })
}

function reachSignal(post: TimeSlotPostEvidence): number | null {
  return post.metrics.reach ?? post.metrics.views ?? post.metrics.impressions
}

function medianOfPoints(pointsInput: SignalPoint[]): number | null {
  return summarizeNumbers(pointsInput.map((point) => point.value)).median
}

function outlierIds(pointsInput: SignalPoint[]): string[] {
  if (pointsInput.length < 4) return []
  const median = medianOfPoints(pointsInput)
  if (median === null) return []
  const deviations = pointsInput.map((point) => Math.abs(point.value - median))
  const mad = summarizeNumbers(deviations).median ?? 0
  const threshold = mad > 0 ? 3 * mad : Math.max(1, Math.abs(median) * 2)
  return pointsInput
    .filter((point) => Math.abs(point.value - median) > threshold)
    .map((point) => point.snapshotId)
}

function confidenceFor(values: number[], sampleSizeOverride?: number): AnalyticsConfidence {
  const sampleSize = sampleSizeOverride ?? values.length
  if (sampleSize < 5) return 'low'

  const median = summarizeNumbers(values).median
  if (median === null) return 'low'
  const mad = summarizeNumbers(values.map((value) => Math.abs(value - median))).median ?? 0
  const dispersionRatio = median === 0 ? (mad === 0 ? 0 : Number.POSITIVE_INFINITY) : mad / Math.abs(median)

  if (sampleSize >= 10 && dispersionRatio <= 0.25) return 'high'
  if (dispersionRatio <= 0.75) return 'medium'
  return 'low'
}
