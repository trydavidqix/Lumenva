export type AnalyticsWindow = '24h' | '7d' | '15d' | '30d' | '60d'

export type NormalizedMetrics = {
  views: number | null
  reach: number | null
  impressions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  watchTimeMs: number | null
  retentionRate: number | null
  followerDelta: number | null
}

export type AnalyticsSnapshotInput = {
  source: string
  sourceVersion: string | null
  capturedAt: string
  captureWindow: AnalyticsWindow | null
  externalPostId: string | null
  metrics: NormalizedMetrics
}

export type AccountAnalyticsRequest = {
  providerAccountId: string
  capturedAt: string
  captureWindow: AnalyticsWindow | null
}

export type PostAnalyticsRequest = {
  providerAccountId: string
  providerPostId: string
  externalPostId: string | null
  capturedAt: string
  captureWindow: null
}
