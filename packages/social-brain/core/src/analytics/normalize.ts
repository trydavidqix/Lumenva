import type { NormalizedMetrics } from './types'

export type MetricInput = Partial<Record<keyof NormalizedMetrics, number | null | undefined>>

export function normalizeMetrics(input: MetricInput): NormalizedMetrics {
  return {
    views: input.views ?? null,
    reach: input.reach ?? null,
    impressions: input.impressions ?? null,
    likes: input.likes ?? null,
    comments: input.comments ?? null,
    shares: input.shares ?? null,
    saves: input.saves ?? null,
    watchTimeMs: input.watchTimeMs ?? null,
    retentionRate: input.retentionRate ?? null,
    followerDelta: input.followerDelta ?? null,
  }
}
