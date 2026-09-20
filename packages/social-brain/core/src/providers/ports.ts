import type {
  AccountAnalyticsRequest,
  AnalyticsSnapshotInput,
  PostAnalyticsRequest,
} from '../analytics/types'
import type {
  PublicationRef,
  PublicationStatusRequest,
  PublishNowInput,
  SchedulePostInput,
} from '../publishing/types'
import type { SocialAccount } from '../social/types'
import type {
  VideoGenerationInput,
  VideoJobRef,
  VideoResult,
} from '../video/types'

export type ProviderHealth = {
  ok: boolean
  checkedAt: string
  latencyMs: number | null
  code: string | null
  message: string | null
}

export interface SocialProviderPort {
  readonly provider: string
  health(): Promise<ProviderHealth>
  listAccounts(): Promise<SocialAccount[]>
  getAccountAnalytics(input: AccountAnalyticsRequest): Promise<AnalyticsSnapshotInput>
  getPostAnalytics(input: PostAnalyticsRequest): Promise<AnalyticsSnapshotInput>
}

export interface SocialPublishingPort {
  readonly provider: string
  schedulePost(input: SchedulePostInput): Promise<PublicationRef>
  publishNow(input: PublishNowInput): Promise<PublicationRef>
  getPublicationStatus(input: PublicationStatusRequest): Promise<PublicationRef>
}

export interface VideoGenerator {
  readonly provider: string
  submit(input: VideoGenerationInput): Promise<VideoJobRef>
  status(providerJobId: string): Promise<VideoJobRef>
  fetchResult(providerJobId: string): Promise<VideoResult>
  health(): Promise<ProviderHealth>
}
