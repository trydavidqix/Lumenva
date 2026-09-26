import { expect, it } from 'vitest'

import type { AnalyticsInsights, HourlyAnalyticsBucket } from '@lumenva/core'

import { analyticsDashboardFromInsights } from './get-analytics-dashboard'

it('maps insights into a serializable dashboard model for the selected window and platform', () => {
  const insights = fixtureInsights()

  const model = analyticsDashboardFromInsights(insights, '7d', 'instagram')
  expect(model.window).toBe('7d')
  expect(model.platform).toBe('instagram')
  expect(model.timeZone).toBe('Europe/Lisbon')
  expect(model.periodOptions).toEqual(['24h', '7d', '15d', '30d', '60d'])
  expect(model.platformOptions).toEqual(['all', 'instagram', 'facebook', 'tiktok', 'youtube'])
  expect(model.kpis.find((item) => item.key === 'views')).toMatchObject({ value: 80, deltaPercent: 60 })
  expect(model.kpis.find((item) => item.key === 'reach')).toMatchObject({ value: 80, deltaPercent: 60 })
})

it('builds 24h KPIs from observed hourly deltas instead of unsupported account aggregates', () => {
  const insights = fixtureInsights()
  const model = analyticsDashboardFromInsights(insights, '24h', 'instagram')

  expect(model.kpis).toEqual([
    { key: 'views', label: 'Views ganhas em 24h', value: 60, deltaPercent: 100 },
    { key: 'interactions', label: 'Interações em 24h', value: 9, deltaPercent: 80 },
    { key: 'retention', label: 'Retenção observada', value: 48, deltaPercent: 20 },
    { key: 'saves', label: 'Salvamentos em 24h', value: 2, deltaPercent: 100 },
  ])
})

it('identifies hourly peaks with evidence and only reports a drop when current views trail the prior-day bucket', () => {
  const model = analyticsDashboardFromInsights(fixtureInsights(), '24h', 'instagram')

  expect(model.hourlyHighlights.peakViews).toMatchObject({
    label: 'Pico de views',
    localHour: 12,
    value: 60,
    evidenceSnapshotIds: ['current'],
  })
  expect(model.hourlyHighlights.peakRetention).toMatchObject({ value: 48 })
  expect(model.hourlyHighlights.peakInteractions).toMatchObject({ value: 9 })
  expect(model.hourlyHighlights.largestDrop).toBeNull()
})

function fixtureInsights(): AnalyticsInsights {
  const windows = {
    '24h': windowContext('24h'),
    '7d': windowContext('7d'),
    '15d': windowContext('15d'),
    '30d': windowContext('30d'),
    '60d': windowContext('60d'),
  }
  const hourly = [hourBucket()]
  return {
    workspaceId: 'workspace-1',
    asOf: '2026-08-18T12:00:00.000Z',
    timeZone: 'Europe/Lisbon',
    context: { workspaceId: 'workspace-1', asOf: '2026-08-18T12:00:00.000Z', windows },
    hourly24h: hourly,
    hourly24hByPlatform: { instagram: hourly, facebook: [], tiktok: [], youtube: [] },
    heatmap: { all: [], byPlatform: { instagram: [], facebook: [], tiktok: [], youtube: [] } },
    timeSlots: {
      all: emptyRecommendations(),
      byPlatform: {
        instagram: emptyRecommendations(),
        facebook: emptyRecommendations(),
        tiktok: emptyRecommendations(),
        youtube: emptyRecommendations(),
      },
    },
    explanations: { reach: null, retention: null, engagement: null, overall: null },
  }
}

function hourBucket(): HourlyAnalyticsBucket {
  return {
    index: 23,
    startAt: '2026-08-18T11:00:00.000Z',
    endAt: '2026-08-18T12:00:00.000Z',
    localWeekday: 'tuesday',
    localHour: 12,
    evidenceSnapshotIds: ['current'],
    baselineEvidenceSnapshotIds: ['previous'],
    metrics: {
      viewsDelta: 60,
      interactionsDelta: 9,
      savesDelta: 2,
      retentionMedian: 48,
      comparablePostCount: 1,
      observedPostCount: 1,
    },
    baselineMetrics: {
      viewsDelta: 30,
      interactionsDelta: 5,
      savesDelta: 1,
      retentionMedian: 40,
      comparablePostCount: 1,
      observedPostCount: 1,
    },
  }
}

function emptyRecommendations() {
  return { reach: null, retention: null, engagement: null, overall: null }
}

function baseline(currentSampleSize = 1, previousSampleSize = 1, delta = 10) {
  return {
    currentSampleSize,
    previousSampleSize,
    viewsMeanDeltaPercent: delta,
    reachMeanDeltaPercent: delta,
    retentionRateMeanDeltaPercent: delta,
    savesMeanDeltaPercent: delta,
    engagementActionsMeanDeltaPercent: delta,
  }
}

function windowContext(window: '24h' | '7d' | '15d' | '30d' | '60d') {
  const metric = { sampleSize: 1, mean: 100, median: 100 }
  const instagramMetric = { sampleSize: 1, mean: 80, median: 80 }
  const missing = { sampleSize: 0, mean: null, median: null }
  const metrics = {
    views: metric,
    reach: metric,
    impressions: missing,
    likes: metric,
    comments: metric,
    shares: metric,
    saves: missing,
    watchTimeMs: missing,
    retentionRate: metric,
    followerDelta: missing,
  }
  const instagramMetrics = { ...metrics, views: instagramMetric, reach: instagramMetric }
  return {
    window,
    baselineStartAt: '2026-08-16T12:00:00.000Z',
    startAt: '2026-08-17T12:00:00.000Z',
    endAt: '2026-08-18T12:00:00.000Z',
    accountSampleSize: 1,
    metrics,
    perPlatform: [{
      platform: 'instagram' as const,
      accountSampleSize: 1,
      metrics: instagramMetrics,
      baseline: baseline(1, 1, 60),
    }],
    topPosts: [],
    baseline: baseline(1, 1, 10),
    availabilityNotes: [],
    evidenceSnapshotIds: [],
    baselineEvidenceSnapshotIds: [],
  }
}
