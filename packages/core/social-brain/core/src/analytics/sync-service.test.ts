import { describe, expect, it } from 'vitest'

import {
  normalizeMetrics,
  type AccountAnalyticsRequest,
  type AnalyticsSnapshotInput,
  type AnalyticsWindow,
  type SocialProviderPort,
  type StoredAnalyticsSnapshot,
} from '../index'

const ACCOUNT_TARGET = {
  workspaceId: 'workspace-1',
  socialAccountId: 'account-local-1',
  providerAccountId: 'account-brightbean-1',
}

const POST_TARGET = {
  workspaceId: 'workspace-1',
  socialAccountId: 'account-local-1',
  contentVariantId: 'variant-1',
  publishJobId: 'publish-1',
  providerAccountId: 'account-brightbean-1',
  providerPostId: 'brightbean-post-1',
  externalPostId: 'instagram-media-1',
}

function snapshot(
  externalPostId: string | null,
  captureWindow: AnalyticsWindow | null = null,
): AnalyticsSnapshotInput {
  return {
    source: 'brightbean',
    sourceVersion: null,
    capturedAt: '2026-08-17T12:00:00.000Z',
    captureWindow,
    externalPostId,
    metrics: normalizeMetrics({ views: 120, likes: 9 }),
  }
}

function stored(
  id: string,
  input: AnalyticsSnapshotInput,
  contentVariantId: string | null = null,
  publishJobId: string | null = null,
): StoredAnalyticsSnapshot {
  return {
    ...input,
    id,
    workspaceId: 'workspace-1',
    socialAccountId: 'account-local-1',
    contentVariantId,
    publishJobId,
  }
}

describe('analytics sync service', () => {
  it('collects and persists provider-supported 7d, 15d, 30d, and 60d account windows', async () => {
    const mod = await import('./sync-service').catch(() => null)
    expect(mod, 'analytics sync service module must exist').not.toBeNull()
    if (!mod) return

    const providerCalls: unknown[] = []
    const provider = {
      provider: 'brightbean',
      health: async () => ({ ok: true, checkedAt: '', latencyMs: 0, code: null, message: null }),
      listAccounts: async () => [],
      getAccountAnalytics: async (input: AccountAnalyticsRequest) => {
        providerCalls.push(input)
        return snapshot(null, input.captureWindow)
      },
      getPostAnalytics: async () => snapshot('instagram-media-1'),
    } satisfies SocialProviderPort

    const saved: unknown[] = []
    const repository = {
      getAccountTarget: async () => ACCOUNT_TARGET,
      getPostTarget: async () => POST_TARGET,
      upsertAccountSnapshot: async (target: typeof ACCOUNT_TARGET, input: AnalyticsSnapshotInput) => {
        saved.push({ target, input })
        return stored(`snapshot-${saved.length}`, input)
      },
      upsertPostSnapshot: async (_target: typeof POST_TARGET, input: AnalyticsSnapshotInput) =>
        stored('snapshot-post', input, 'variant-1', 'publish-1'),
    }

    const service = mod.createAnalyticsSyncService(provider, repository)
    const result = await service.syncAccountAnalytics('account-local-1', '2026-08-17T12:00:00.000Z')

    expect(providerCalls).toEqual([
      {
        providerAccountId: 'account-brightbean-1',
        capturedAt: '2026-08-17T12:00:00.000Z',
        captureWindow: '7d',
      },
      {
        providerAccountId: 'account-brightbean-1',
        capturedAt: '2026-08-17T12:00:00.000Z',
        captureWindow: '15d',
      },
      {
        providerAccountId: 'account-brightbean-1',
        capturedAt: '2026-08-17T12:00:00.000Z',
        captureWindow: '30d',
      },
      {
        providerAccountId: 'account-brightbean-1',
        capturedAt: '2026-08-17T12:00:00.000Z',
        captureWindow: '60d',
      },
    ])
    expect(saved).toHaveLength(4)
    expect(result).toHaveLength(4)
  })

  it('uses the BrightBean publication id for lookup and preserves the network post id', async () => {
    const mod = await import('./sync-service').catch(() => null)
    expect(mod, 'analytics sync service module must exist').not.toBeNull()
    if (!mod) return

    const providerCalls: unknown[] = []
    const provider = {
      provider: 'brightbean',
      health: async () => ({ ok: true, checkedAt: '', latencyMs: 0, code: null, message: null }),
      listAccounts: async () => [],
      getAccountAnalytics: async () => snapshot(null, '30d'),
      getPostAnalytics: async (input: Parameters<SocialProviderPort['getPostAnalytics']>[0]) => {
        providerCalls.push(input)
        return snapshot(input.externalPostId)
      },
    } satisfies SocialProviderPort

    const repository = {
      getAccountTarget: async () => ACCOUNT_TARGET,
      getPostTarget: async () => POST_TARGET,
      upsertAccountSnapshot: async (_target: typeof ACCOUNT_TARGET, input: AnalyticsSnapshotInput) =>
        stored('snapshot-account', input),
      upsertPostSnapshot: async (_target: typeof POST_TARGET, input: AnalyticsSnapshotInput) =>
        stored('snapshot-post', input, 'variant-1', 'publish-1'),
    }

    const service = mod.createAnalyticsSyncService(provider, repository)
    const result = await service.syncPostAnalytics('variant-1', '2026-08-17T12:00:00.000Z')

    expect(providerCalls).toEqual([
      {
        providerAccountId: 'account-brightbean-1',
        providerPostId: 'brightbean-post-1',
        externalPostId: 'instagram-media-1',
        capturedAt: '2026-08-17T12:00:00.000Z',
        captureWindow: null,
      },
    ])
    expect(result.externalPostId).toBe('instagram-media-1')
  })
})
