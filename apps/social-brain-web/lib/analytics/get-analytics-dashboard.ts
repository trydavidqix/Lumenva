import {
  buildTimeSlotExplanation,
  createAnalyticsInsightsService,
  type AnalyticsInsights,
  type AnalyticsWindow,
  type HourlyAnalyticsBucket,
  type TimeSlotObjective,
  type TimeSlotRecommendations,
} from '@lumenva/core'
import { createAnalyticsQueryRepository, createSupabaseAnalyticsQueryStore } from '@lumenva/db/analytics/queries'

import { createSupabaseServerClient } from '../supabase/server'

export const ANALYTICS_PERIODS = ['24h', '7d', '15d', '30d', '60d'] as const satisfies readonly AnalyticsWindow[]
const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube'] as const
export const ANALYTICS_PLATFORMS = ['all', ...SOCIAL_PLATFORMS] as const
export type AnalyticsPlatformFilter = (typeof ANALYTICS_PLATFORMS)[number]

export type AnalyticsDashboardViewModel = ReturnType<typeof analyticsDashboardFromInsights>

export async function getAnalyticsDashboard(
  workspaceId: string,
  window: AnalyticsWindow = '24h',
  platform: AnalyticsPlatformFilter = 'all',
): Promise<AnalyticsDashboardViewModel> {
  const client = await createSupabaseServerClient()
  const repository = createAnalyticsQueryRepository(createSupabaseAnalyticsQueryStore(client))
  const insights = await createAnalyticsInsightsService(repository).build(workspaceId, new Date().toISOString())
  return analyticsDashboardFromInsights(insights, window, platform)
}

export function analyticsDashboardFromInsights(
  insights: AnalyticsInsights,
  window: AnalyticsWindow,
  platform: AnalyticsPlatformFilter = 'all',
) {
  const selected = insights.context.windows[window]
  const platformSummary = platform === 'all'
    ? null
    : selected.perPlatform.find((item) => item.platform === platform) ?? null
  const metrics = platformSummary?.metrics ?? selected.metrics
  const baseline = platformSummary?.baseline ?? selected.baseline
  const slotRecommendations = platform === 'all'
    ? insights.timeSlots.all
    : insights.timeSlots.byPlatform[platform]
  const heatmap = platform === 'all'
    ? insights.heatmap.all
    : insights.heatmap.byPlatform[platform]
  const hourly = platform === 'all'
    ? insights.hourly24h
    : insights.hourly24hByPlatform[platform]

  const recommendations = buildRecommendationItems(slotRecommendations)
  const recommendationsByPlatform = Object.fromEntries(
    SOCIAL_PLATFORMS.map((socialPlatform) => [
      socialPlatform,
      buildRecommendationItems(insights.timeSlots.byPlatform[socialPlatform]),
    ]),
  ) as Record<(typeof SOCIAL_PLATFORMS)[number], ReturnType<typeof buildRecommendationItems>>

  return {
    workspaceId: insights.workspaceId,
    asOf: insights.asOf,
    timeZone: insights.timeZone,
    window,
    platform,
    periodOptions: [...ANALYTICS_PERIODS],
    platformOptions: [...ANALYTICS_PLATFORMS],
    kpis: window === '24h'
      ? build24hKpis(hourly)
      : [
          {
            key: 'views',
            label: 'Visualizações',
            value: metrics.views.mean,
            deltaPercent: baseline.viewsMeanDeltaPercent,
          },
          {
            key: 'reach',
            label: 'Alcance',
            value: metrics.reach.mean,
            deltaPercent: baseline.reachMeanDeltaPercent,
          },
          {
            key: 'retention',
            label: 'Retenção média',
            value: metrics.retentionRate.mean,
            deltaPercent: baseline.retentionRateMeanDeltaPercent,
          },
          {
            key: 'saves',
            label: 'Salvamentos',
            value: metrics.saves.mean,
            deltaPercent: baseline.savesMeanDeltaPercent,
          },
        ],
    hourly24h: hourly.map((bucket) => ({
      ...bucket,
      evidenceCount: bucket.evidenceSnapshotIds.length,
      baselineEvidenceCount: bucket.baselineEvidenceSnapshotIds.length,
    })),
    hourlyHighlights: buildHourlyHighlights(hourly),
    heatmap,
    recommendations,
    recommendationsByPlatform,
    anomalies: buildAnomalies(recommendations),
    topContent: selected.topPosts.filter((post) => platform === 'all' || post.platform === platform),
    platforms: selected.perPlatform,
    availabilityNotes: selected.availabilityNotes,
    baseline,
  }
}

function buildRecommendationItems(slotRecommendations: TimeSlotRecommendations) {
  return (['reach', 'retention', 'engagement', 'overall'] as const).map((objective) => {
    const recommendation = slotRecommendations[objective]
    return {
      objective,
      label: objectiveLabel(objective),
      recommendation,
      explanation: recommendation ? buildTimeSlotExplanation(recommendation) : null,
    }
  })
}

function build24hKpis(hourly: HourlyAnalyticsBucket[]) {
  const currentViews = sumHourly(hourly, (bucket) => bucket.metrics.viewsDelta)
  const previousViews = sumHourly(hourly, (bucket) => bucket.baselineMetrics.viewsDelta)
  const currentInteractions = sumHourly(hourly, (bucket) => bucket.metrics.interactionsDelta)
  const previousInteractions = sumHourly(hourly, (bucket) => bucket.baselineMetrics.interactionsDelta)
  const currentSaves = sumHourly(hourly, (bucket) => bucket.metrics.savesDelta)
  const previousSaves = sumHourly(hourly, (bucket) => bucket.baselineMetrics.savesDelta)
  const currentRetention = meanNonNull(hourly.map((bucket) => bucket.metrics.retentionMedian))
  const previousRetention = meanNonNull(hourly.map((bucket) => bucket.baselineMetrics.retentionMedian))

  return [
    { key: 'views', label: 'Views ganhas em 24h', value: currentViews, deltaPercent: percentDelta(currentViews, previousViews) },
    { key: 'interactions', label: 'Interações em 24h', value: currentInteractions, deltaPercent: percentDelta(currentInteractions, previousInteractions) },
    { key: 'retention', label: 'Retenção observada', value: currentRetention, deltaPercent: percentDelta(currentRetention, previousRetention) },
    { key: 'saves', label: 'Salvamentos em 24h', value: currentSaves, deltaPercent: percentDelta(currentSaves, previousSaves) },
  ]
}

function buildHourlyHighlights(hourly: HourlyAnalyticsBucket[]) {
  const peakViews = maxBucket(hourly, (bucket) => bucket.metrics.viewsDelta)
  const peakRetention = maxBucket(hourly, (bucket) => bucket.metrics.retentionMedian)
  const peakInteractions = maxBucket(hourly, (bucket) => bucket.metrics.interactionsDelta)
  const drops = hourly.flatMap((bucket) => {
    const current = bucket.metrics.viewsDelta
    const previous = bucket.baselineMetrics.viewsDelta
    if (current === null || previous === null) return []
    return [{ bucket, difference: current - previous }]
  })
  const largestDrop = drops
    .filter((item) => item.difference < 0)
    .sort((a, b) => a.difference - b.difference)[0] ?? null

  return {
    peakViews: peakViews ? highlight('Pico de views', peakViews.bucket, peakViews.value, 'views') : null,
    peakRetention: peakRetention ? highlight('Maior retenção', peakRetention.bucket, peakRetention.value, 'retention') : null,
    peakInteractions: peakInteractions ? highlight('Pico de interação', peakInteractions.bucket, peakInteractions.value, 'interactions') : null,
    largestDrop: largestDrop
      ? {
          label: 'Maior queda vs. 24h anteriores',
          localWeekday: largestDrop.bucket.localWeekday,
          localHour: largestDrop.bucket.localHour,
          value: largestDrop.difference,
          metric: 'views' as const,
          evidenceSnapshotIds: largestDrop.bucket.evidenceSnapshotIds,
        }
      : null,
  }
}

function maxBucket(
  hourly: HourlyAnalyticsBucket[],
  getValue: (bucket: HourlyAnalyticsBucket) => number | null,
): { bucket: HourlyAnalyticsBucket; value: number } | null {
  const values = hourly.flatMap((bucket) => {
    const value = getValue(bucket)
    return value === null ? [] : [{ bucket, value }]
  })
  return values.sort((a, b) => b.value - a.value)[0] ?? null
}

function highlight(
  label: string,
  bucket: HourlyAnalyticsBucket,
  value: number,
  metric: 'views' | 'retention' | 'interactions',
) {
  return {
    label,
    localWeekday: bucket.localWeekday,
    localHour: bucket.localHour,
    value,
    metric,
    evidenceSnapshotIds: bucket.evidenceSnapshotIds,
  }
}

function sumHourly(hourly: HourlyAnalyticsBucket[], getValue: (bucket: HourlyAnalyticsBucket) => number | null): number | null {
  const values = hourly.map(getValue).filter((value): value is number => value !== null)
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0)
}

function meanNonNull(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null)
  return available.length === 0 ? null : available.reduce((sum, value) => sum + value, 0) / available.length
}

function percentDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function buildAnomalies(
  recommendations: Array<{
    objective: TimeSlotObjective
    label: string
    recommendation: AnalyticsInsights['timeSlots']['all'][TimeSlotObjective]
  }>,
) {
  const bySnapshot = new Map<string, Set<string>>()
  for (const item of recommendations) {
    for (const snapshotId of item.recommendation?.outlierIds ?? []) {
      const labels = bySnapshot.get(snapshotId) ?? new Set<string>()
      labels.add(item.label)
      bySnapshot.set(snapshotId, labels)
    }
  }
  return [...bySnapshot.entries()].map(([snapshotId, labels]) => ({
    snapshotId,
    reasons: [...labels],
  }))
}

function objectiveLabel(objective: TimeSlotObjective): string {
  switch (objective) {
    case 'reach': return 'Melhor para alcance'
    case 'retention': return 'Melhor para retenção'
    case 'engagement': return 'Melhor para interação'
    case 'overall': return 'Melhor horário geral'
  }
}
