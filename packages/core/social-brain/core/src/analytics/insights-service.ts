import type { SocialPlatform } from '../social/types'
import { createAnalyticsContextService, type AnalyticsContext, type AnalyticsContextRepository } from './context-service'
import { buildTimeSlotExplanation, type AnalyticsExplanation } from './explanations'
import { buildRolling24hBuckets, type HourlyAnalyticsBucket } from './hourly-analysis'
import { buildTimeSlotHeatmap, type TimeSlotHeatmapCell } from './time-slot-heatmap'
import {
  rankPostingTimes,
  type TimeSlotObjective,
  type TimeSlotPostEvidence,
  type TimeSlotRecommendations,
} from './time-slot-ranking'

const DAY_MS = 24 * 60 * 60 * 1000
const HISTORY_MS = 120 * DAY_MS
const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube'] as const satisfies readonly SocialPlatform[]

export type AnalyticsInsights = {
  workspaceId: string
  asOf: string
  timeZone: string
  context: AnalyticsContext
  hourly24h: HourlyAnalyticsBucket[]
  hourly24hByPlatform: Record<SocialPlatform, HourlyAnalyticsBucket[]>
  heatmap: {
    all: TimeSlotHeatmapCell[]
    byPlatform: Record<SocialPlatform, TimeSlotHeatmapCell[]>
  }
  timeSlots: {
    all: TimeSlotRecommendations
    byPlatform: Record<SocialPlatform, TimeSlotRecommendations>
  }
  explanations: Record<TimeSlotObjective, AnalyticsExplanation | null>
}

export type AnalyticsInsightsService = {
  build(workspaceId: string, asOf: string): Promise<AnalyticsInsights>
}

export function createAnalyticsInsightsService(
  repository: AnalyticsContextRepository,
): AnalyticsInsightsService {
  return {
    async build(workspaceId, asOf) {
      const asOfMs = Date.parse(asOf)
      if (!Number.isFinite(asOfMs)) throw new Error('Invalid analytics timestamp')

      const normalizedAsOf = new Date(asOfMs).toISOString()
      const [context, timeZone, evidence] = await Promise.all([
        createAnalyticsContextService(repository).buildAnalyticsContext(workspaceId, normalizedAsOf),
        repository.getWorkspaceTimezone(workspaceId),
        repository.listEvidence(
          workspaceId,
          new Date(asOfMs - HISTORY_MS).toISOString(),
          normalizedAsOf,
        ),
      ])

      const latestPosts = latestPublishedPostEvidence(evidence)
      const all = rankPostingTimes(latestPosts, timeZone, 'all')
      const byPlatform = Object.fromEntries(
        PLATFORMS.map((platform) => [platform, rankPostingTimes(latestPosts, timeZone, platform)]),
      ) as Record<SocialPlatform, TimeSlotRecommendations>
      const heatmapByPlatform = Object.fromEntries(
        PLATFORMS.map((platform) => [
          platform,
          buildTimeSlotHeatmap(latestPosts.filter((post) => post.platform === platform), timeZone),
        ]),
      ) as Record<SocialPlatform, TimeSlotHeatmapCell[]>
      const hourly24hByPlatform = Object.fromEntries(
        PLATFORMS.map((platform) => [
          platform,
          buildRolling24hBuckets(evidence.filter((row) => row.platform === platform), normalizedAsOf, timeZone),
        ]),
      ) as Record<SocialPlatform, HourlyAnalyticsBucket[]>
      const explanations = Object.fromEntries(
        (['reach', 'retention', 'engagement', 'overall'] as const).map((objective) => [
          objective,
          all[objective] ? buildTimeSlotExplanation(all[objective]) : null,
        ]),
      ) as Record<TimeSlotObjective, AnalyticsExplanation | null>

      return {
        workspaceId,
        asOf: normalizedAsOf,
        timeZone,
        context,
        hourly24h: buildRolling24hBuckets(evidence, normalizedAsOf, timeZone),
        hourly24hByPlatform,
        heatmap: {
          all: buildTimeSlotHeatmap(latestPosts, timeZone),
          byPlatform: heatmapByPlatform,
        },
        timeSlots: { all, byPlatform },
        explanations,
      }
    },
  }
}

function latestPublishedPostEvidence(
  evidence: Awaited<ReturnType<AnalyticsContextRepository['listEvidence']>>,
): TimeSlotPostEvidence[] {
  const latest = new Map<string, (typeof evidence)[number]>()

  for (const row of evidence) {
    if (!row.contentVariantId || !row.publishedAt) continue
    const previous = latest.get(row.contentVariantId)
    if (!previous || Date.parse(row.capturedAt) > Date.parse(previous.capturedAt)) {
      latest.set(row.contentVariantId, row)
    }
  }

  return [...latest.values()].map((row) => ({
    snapshotId: row.id,
    postId: row.contentVariantId as string,
    platform: row.platform,
    publishedAt: row.publishedAt as string,
    metrics: row.metrics,
  }))
}
