import type { AnalyticsInsights } from '@lumenva/core'
import { describe, expect, it } from 'vitest'

import { AnalyticsWindowSchema, selectAnalyticsInsightsWindow } from './analytics'

describe('social.analytics.analyze window schema', () => {
  it.each(['24h', '7d', '15d', '30d', '60d', 'all'])('accepts %s', (window) => {
    expect(AnalyticsWindowSchema.parse(window)).toBe(window)
  })

  it('rejects the removed 90d window', () => {
    expect(() => AnalyticsWindowSchema.parse('90d')).toThrow()
  })
})

describe('social.analytics.analyze payload', () => {
  it('returns 24h hourly evidence for all networks and each platform', () => {
    const insights = fixtureInsights()
    const selected = selectAnalyticsInsightsWindow(insights, '24h')

    expect(selected).toMatchObject({
      workspaceId: 'workspace-1',
      timeZone: 'Europe/Lisbon',
      window: { window: '24h' },
      hourly24h: {
        all: [{ index: 23 }],
        byPlatform: { instagram: [{ index: 23 }] },
      },
    })
  })

  it('omits hourly detail for longer windows while retaining recommendations and evidence surfaces', () => {
    const selected = selectAnalyticsInsightsWindow(fixtureInsights(), '30d')
    expect(selected.window).toMatchObject({ window: '30d' })
    expect(selected.hourly24h).toBeUndefined()
    expect(selected).toHaveProperty('timeSlots')
    expect(selected).toHaveProperty('heatmap')
    expect(selected).toHaveProperty('explanations')
  })
})

function fixtureInsights(): AnalyticsInsights {
  const emptyRecommendations = { reach: null, retention: null, engagement: null, overall: null }
  const window = (label: string) => ({ window: label })
  return {
    workspaceId: 'workspace-1',
    asOf: '2026-08-18T12:00:00.000Z',
    timeZone: 'Europe/Lisbon',
    context: {
      workspaceId: 'workspace-1',
      asOf: '2026-08-18T12:00:00.000Z',
      windows: {
        '24h': window('24h'),
        '7d': window('7d'),
        '15d': window('15d'),
        '30d': window('30d'),
        '60d': window('60d'),
      },
    },
    hourly24h: [{ index: 23 }],
    hourly24hByPlatform: {
      instagram: [{ index: 23 }],
      facebook: [],
      tiktok: [],
      youtube: [],
    },
    heatmap: { all: [], byPlatform: { instagram: [], facebook: [], tiktok: [], youtube: [] } },
    timeSlots: {
      all: emptyRecommendations,
      byPlatform: {
        instagram: emptyRecommendations,
        facebook: emptyRecommendations,
        tiktok: emptyRecommendations,
        youtube: emptyRecommendations,
      },
    },
    explanations: { reach: null, retention: null, engagement: null, overall: null },
  } as unknown as AnalyticsInsights
}
