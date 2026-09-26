import { describe, expect, it } from 'vitest'

describe('normalizeMetrics', () => {
  it('preserves unavailable metrics as null', async () => {
    const mod = await import('./normalize').catch(() => null)

    if (!mod) {
      expect(mod).not.toBeNull()
      return
    }

    expect(mod.normalizeMetrics({ views: 100 })).toEqual({
      views: 100,
      reach: null,
      impressions: null,
      likes: null,
      comments: null,
      shares: null,
      saves: null,
      watchTimeMs: null,
      retentionRate: null,
      followerDelta: null,
    })
  })

  it('preserves provider-supported saves without deriving unavailable metrics', async () => {
    const mod = await import('./normalize').catch(() => null)
    expect(mod).not.toBeNull()
    if (!mod) return

    expect(mod.normalizeMetrics({ views: 100, saves: 12 })).toMatchObject({
      views: 100,
      saves: 12,
      retentionRate: null,
    })
  })
})
