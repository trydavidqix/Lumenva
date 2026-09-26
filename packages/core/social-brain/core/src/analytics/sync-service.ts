import type { AnalyticsSnapshotInput, AnalyticsWindow } from './types'
import type { SocialProviderPort } from '../providers/ports'

export type AccountAnalyticsTarget = {
  workspaceId: string
  socialAccountId: string
  providerAccountId: string
}

export type PostAnalyticsTarget = AccountAnalyticsTarget & {
  contentVariantId: string
  publishJobId: string
  providerPostId: string
  externalPostId: string | null
}

export type StoredAnalyticsSnapshot = AnalyticsSnapshotInput & {
  id: string
  workspaceId: string
  socialAccountId: string | null
  contentVariantId: string | null
  publishJobId: string | null
}

export type AnalyticsSyncRepository = {
  getAccountTarget(socialAccountId: string): Promise<AccountAnalyticsTarget | null>
  getPostTarget(contentVariantId: string): Promise<PostAnalyticsTarget | null>
  upsertAccountSnapshot(
    target: AccountAnalyticsTarget,
    snapshot: AnalyticsSnapshotInput,
  ): Promise<StoredAnalyticsSnapshot>
  upsertPostSnapshot(
    target: PostAnalyticsTarget,
    snapshot: AnalyticsSnapshotInput,
  ): Promise<StoredAnalyticsSnapshot>
}

export type AnalyticsSyncService = {
  syncAccountAnalytics(socialAccountId: string, capturedAt: string): Promise<StoredAnalyticsSnapshot[]>
  syncPostAnalytics(contentVariantId: string, capturedAt: string): Promise<StoredAnalyticsSnapshot>
}

// BrightBean's account endpoint is day-window based and does not expose a
// native 1-day/24h account window. V1.1's 24h view is built from timestamped
// post evidence instead of fabricating an unsupported account aggregate.
const ACCOUNT_WINDOWS: readonly AnalyticsWindow[] = ['7d', '15d', '30d', '60d']

export function createAnalyticsSyncService(
  provider: SocialProviderPort,
  repository: AnalyticsSyncRepository,
): AnalyticsSyncService {
  return {
    async syncAccountAnalytics(socialAccountId, capturedAt) {
      const target = await repository.getAccountTarget(socialAccountId)
      if (!target) throw new Error('Social account mapping not found')

      const stored: StoredAnalyticsSnapshot[] = []
      for (const captureWindow of ACCOUNT_WINDOWS) {
        const snapshot = await provider.getAccountAnalytics({
          providerAccountId: target.providerAccountId,
          capturedAt,
          captureWindow,
        })
        stored.push(
          await repository.upsertAccountSnapshot(target, {
            ...snapshot,
            captureWindow,
          }),
        )
      }
      return stored
    },

    async syncPostAnalytics(contentVariantId, capturedAt) {
      const target = await repository.getPostTarget(contentVariantId)
      if (!target) throw new Error('Published post mapping not found')

      const snapshot = await provider.getPostAnalytics({
        providerAccountId: target.providerAccountId,
        providerPostId: target.providerPostId,
        externalPostId: target.externalPostId,
        capturedAt,
        captureWindow: null,
      })

      return repository.upsertPostSnapshot(target, {
        ...snapshot,
        captureWindow: null,
        externalPostId: target.externalPostId,
      })
    },
  }
}
