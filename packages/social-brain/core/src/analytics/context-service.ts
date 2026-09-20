import type { AnalyticsWindow, NormalizedMetrics } from './types'
import type { SocialPlatform } from '../social/types'
import { engagementActions, percentDelta, summarizeNumbers, type NumericSummary } from './statistics'

export type AnalyticsEvidenceSnapshot = {
  id: string
  workspaceId: string
  socialAccountId: string
  contentVariantId: string | null
  platform: SocialPlatform
  capturedAt: string
  publishedAt: string | null
  captureWindow: AnalyticsWindow | null
  externalPostId: string | null
  metrics: NormalizedMetrics
}

export type MetricsSummary = {
  [K in keyof NormalizedMetrics]: NumericSummary
}

export type BaselineComparison = {
  currentSampleSize: number
  previousSampleSize: number
  viewsMeanDeltaPercent: number | null
  reachMeanDeltaPercent: number | null
  retentionRateMeanDeltaPercent: number | null
  savesMeanDeltaPercent: number | null
  engagementActionsMeanDeltaPercent: number | null
}

export type PlatformAnalyticsSummary = {
  platform: SocialPlatform
  accountSampleSize: number
  metrics: MetricsSummary
  baseline: BaselineComparison
}

export type RankedPost = {
  snapshotId: string
  contentVariantId: string
  platform: SocialPlatform
  capturedAt: string
  publishedAt: string | null
  views: number | null
  engagementActions: number | null
}

export type AnalyticsWindowContext = {
  window: AnalyticsWindow
  baselineStartAt: string
  startAt: string
  endAt: string
  accountSampleSize: number
  metrics: MetricsSummary
  perPlatform: PlatformAnalyticsSummary[]
  topPosts: RankedPost[]
  baseline: BaselineComparison
  availabilityNotes: string[]
  evidenceSnapshotIds: string[]
  baselineEvidenceSnapshotIds: string[]
}

export type AnalyticsContext = {
  workspaceId: string
  asOf: string
  windows: Record<AnalyticsWindow, AnalyticsWindowContext>
}

export type StrategyNoteRequest = {
  workspaceId: string
  summary: string
  evidenceSnapshotIds: string[]
  baselineStart: string
  windowStart: string
  windowEnd: string
  windowLabel: AnalyticsWindow
}

export type AnalyticsContextRepository = {
  listEvidence(workspaceId: string, from: string, to: string): Promise<AnalyticsEvidenceSnapshot[]>
  getWorkspaceTimezone(workspaceId: string): Promise<string>
  insertStrategyNote(input: StrategyNoteRequest): Promise<{ id: string }>
}

export type AnalyticsContextService = {
  buildAnalyticsContext(workspaceId: string, asOf: string): Promise<AnalyticsContext>
  recordStrategyNote(
    workspaceId: string,
    summary: string,
    context: AnalyticsContext,
    window: AnalyticsWindow,
  ): Promise<{ id: string }>
}

const METRIC_KEYS = [
  'views',
  'reach',
  'impressions',
  'likes',
  'comments',
  'shares',
  'saves',
  'watchTimeMs',
  'retentionRate',
  'followerDelta',
] as const satisfies readonly (keyof NormalizedMetrics)[]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WINDOWS: Array<[AnalyticsWindow, number]> = [
  ['24h', 24 * HOUR_MS],
  ['7d', 7 * DAY_MS],
  ['15d', 15 * DAY_MS],
  ['30d', 30 * DAY_MS],
  ['60d', 60 * DAY_MS],
]
const MAX_BASELINE_HISTORY_MS = 120 * DAY_MS

export function createAnalyticsContextService(
  repository: AnalyticsContextRepository,
): AnalyticsContextService {
  return {
    async buildAnalyticsContext(workspaceId, asOf) {
      const asOfMs = parseDate(asOf)
      const queryStart = new Date(asOfMs - MAX_BASELINE_HISTORY_MS).toISOString()
      const evidence = await repository.listEvidence(workspaceId, queryStart, new Date(asOfMs).toISOString())

      return {
        workspaceId,
        asOf: new Date(asOfMs).toISOString(),
        windows: Object.fromEntries(
          WINDOWS.map(([label, durationMs]) => [label, buildWindow(label, durationMs, asOfMs, evidence)]),
        ) as Record<AnalyticsWindow, AnalyticsWindowContext>,
      }
    },

    async recordStrategyNote(workspaceId, summary, context, window) {
      if (context.workspaceId !== workspaceId) throw new Error('Analytics context workspace mismatch')
      const selected = context.windows[window]
      return repository.insertStrategyNote({
        workspaceId,
        summary,
        evidenceSnapshotIds: [...new Set([
          ...selected.evidenceSnapshotIds,
          ...selected.baselineEvidenceSnapshotIds,
        ])],
        baselineStart: selected.baselineStartAt,
        windowStart: selected.startAt,
        windowEnd: selected.endAt,
        windowLabel: window,
      })
    },
  }
}

function buildWindow(
  label: AnalyticsWindow,
  durationMs: number,
  asOfMs: number,
  evidence: AnalyticsEvidenceSnapshot[],
): AnalyticsWindowContext {
  const startMs = asOfMs - durationMs
  const previousStartMs = startMs - durationMs

  const currentAccounts = latestAccountSnapshots(
    evidence.filter(
      (row) => row.contentVariantId === null && row.captureWindow === label && inWindow(row.capturedAt, startMs, asOfMs),
    ),
  )
  const previousAccounts = latestAccountSnapshots(
    evidence.filter(
      (row) =>
        row.contentVariantId === null &&
        row.captureWindow === label &&
        inWindow(row.capturedAt, previousStartMs, startMs),
    ),
  )
  const latestPosts = latestPostSnapshots(
    evidence.filter(
      (row) => row.contentVariantId !== null && row.captureWindow === null && inWindow(row.capturedAt, startMs, asOfMs),
    ),
  )
  const previousPosts = latestPostSnapshots(
    evidence.filter(
      (row) => row.contentVariantId !== null && row.captureWindow === null && inWindow(row.capturedAt, previousStartMs, startMs),
    ),
  )

  const currentMetricRows = label === '24h' ? latestPosts : currentAccounts
  const previousMetricRows = label === '24h' ? previousPosts : previousAccounts
  const metrics = summarizeMetrics(currentMetricRows)

  const perPlatform = (['instagram', 'facebook', 'tiktok', 'youtube'] as const)
    .map((platform) => {
      const currentRows = currentMetricRows.filter((row) => row.platform === platform)
      const previousRows = previousMetricRows.filter((row) => row.platform === platform)
      return {
        platform,
        accountSampleSize: currentRows.length,
        metrics: summarizeMetrics(currentRows),
        baseline: compareMetricRows(currentRows, previousRows),
      }
    })
    .filter((summary) => summary.accountSampleSize > 0)

  const topPosts = latestPosts
    .map((row): RankedPost => ({
      snapshotId: row.id,
      contentVariantId: row.contentVariantId as string,
      platform: row.platform,
      capturedAt: row.capturedAt,
      publishedAt: row.publishedAt,
      views: row.metrics.views,
      engagementActions: engagementActions(row.metrics),
    }))
    .sort(comparePosts)
    .slice(0, 5)

  return {
    window: label,
    baselineStartAt: new Date(previousStartMs).toISOString(),
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(asOfMs).toISOString(),
    accountSampleSize: currentMetricRows.length,
    metrics,
    perPlatform,
    topPosts,
    baseline: compareMetricRows(currentMetricRows, previousMetricRows),
    availabilityNotes: METRIC_KEYS
      .filter((key) => metrics[key].sampleSize === 0)
      .map((key) => `${key} unavailable in ${label} analytics`),
    evidenceSnapshotIds: [...new Set([...currentMetricRows, ...latestPosts].map((row) => row.id))],
    baselineEvidenceSnapshotIds: previousMetricRows.map((row) => row.id),
  }
}

function compareMetricRows(
  currentRows: AnalyticsEvidenceSnapshot[],
  previousRows: AnalyticsEvidenceSnapshot[],
): BaselineComparison {
  return {
    currentSampleSize: currentRows.length,
    previousSampleSize: previousRows.length,
    viewsMeanDeltaPercent: metricMeanDelta(currentRows, previousRows, (row) => row.metrics.views),
    reachMeanDeltaPercent: metricMeanDelta(currentRows, previousRows, (row) => row.metrics.reach),
    retentionRateMeanDeltaPercent: metricMeanDelta(currentRows, previousRows, (row) => row.metrics.retentionRate),
    savesMeanDeltaPercent: metricMeanDelta(currentRows, previousRows, (row) => row.metrics.saves),
    engagementActionsMeanDeltaPercent: metricMeanDelta(currentRows, previousRows, (row) => engagementActions(row.metrics)),
  }
}

function metricMeanDelta(
  currentRows: AnalyticsEvidenceSnapshot[],
  previousRows: AnalyticsEvidenceSnapshot[],
  getMetric: (row: AnalyticsEvidenceSnapshot) => number | null,
): number | null {
  const current = summarizeNumbers(currentRows.map(getMetric)).mean
  const previous = summarizeNumbers(previousRows.map(getMetric)).mean
  return percentDelta(current, previous)
}

function summarizeMetrics(rows: AnalyticsEvidenceSnapshot[]): MetricsSummary {
  return Object.fromEntries(
    METRIC_KEYS.map((key) => [key, summarizeNumbers(rows.map((row) => row.metrics[key]))]),
  ) as MetricsSummary
}

function latestAccountSnapshots(rows: AnalyticsEvidenceSnapshot[]): AnalyticsEvidenceSnapshot[] {
  const latest = new Map<string, AnalyticsEvidenceSnapshot>()
  for (const row of rows) {
    const previous = latest.get(row.socialAccountId)
    if (!previous || parseDate(row.capturedAt) > parseDate(previous.capturedAt)) {
      latest.set(row.socialAccountId, row)
    }
  }
  return [...latest.values()]
}

function latestPostSnapshots(rows: AnalyticsEvidenceSnapshot[]): AnalyticsEvidenceSnapshot[] {
  const latest = new Map<string, AnalyticsEvidenceSnapshot>()
  for (const row of rows) {
    if (!row.contentVariantId) continue
    const previous = latest.get(row.contentVariantId)
    if (!previous || parseDate(row.capturedAt) > parseDate(previous.capturedAt)) {
      latest.set(row.contentVariantId, row)
    }
  }
  return [...latest.values()]
}

function comparePosts(a: RankedPost, b: RankedPost): number {
  const byViews = compareNullableDescending(a.views, b.views)
  if (byViews !== 0) return byViews
  const byEngagement = compareNullableDescending(a.engagementActions, b.engagementActions)
  if (byEngagement !== 0) return byEngagement
  return b.capturedAt.localeCompare(a.capturedAt)
}

function compareNullableDescending(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return b - a
}

function inWindow(value: string, exclusiveStartMs: number, inclusiveEndMs: number): boolean {
  const timestamp = parseDate(value)
  return timestamp > exclusiveStartMs && timestamp <= inclusiveEndMs
}

function parseDate(value: string): number {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error('Invalid analytics timestamp')
  return timestamp
}
