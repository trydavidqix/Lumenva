export type PublishState =
  | 'queued'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'reconcile_required'
  | 'failed'
  | 'unknown'

export type PublishContentInput = {
  providerAccountId: string
  caption: string
  title: string | null
  providerMediaAssetIds: string[]
  idempotencyKey: string
}

export type SchedulePostInput = PublishContentInput & {
  scheduledFor: string
}

export type PublishNowInput = PublishContentInput & {
  executionTime: string
}

export type PublicationStatusRequest = {
  providerPublicationId: string
  providerAccountId: string
}

export type PublicationRef = {
  providerPublicationId: string
  providerPlatformPublicationId: string | null
  providerAccountId: string
  state: PublishState
  externalPostId: string | null
  externalUrl: string | null
  scheduledFor: string | null
  publishedAt: string | null
  errorMessage: string | null
}
