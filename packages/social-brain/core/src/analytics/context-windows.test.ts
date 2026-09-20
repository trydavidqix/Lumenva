import { describe, expect, it } from 'vitest'

import { createAnalyticsContextService } from './context-service'

describe('V1.1 analytics comparison windows', () => {
  it('builds 24h, 7d, 15d, 30d and 60d with equal-length baselines', async () => {
    const repository = {
      listEvidence: async () => [],
      getWorkspaceTimezone: async () => 'Europe/Lisbon',
      insertStrategyNote: async () => ({ id: 'note-1' }),
    }
    const service = createAnalyticsContextService(repository)
    const context = await service.buildAnalyticsContext('workspace-1', '2026-08-18T12:00:00.000Z')

    expect(Object.keys(context.windows)).toEqual(['24h', '7d', '15d', '30d', '60d'])
    expect(context.windows['24h']).toMatchObject({
      startAt: '2026-08-17T12:00:00.000Z',
      baselineStartAt: '2026-08-16T12:00:00.000Z',
    })
    expect(context.windows['15d']).toMatchObject({
      startAt: '2026-08-03T12:00:00.000Z',
      baselineStartAt: '2026-07-19T12:00:00.000Z',
    })
    expect(context.windows['60d']).toMatchObject({
      startAt: '2026-06-19T12:00:00.000Z',
      baselineStartAt: '2026-04-20T12:00:00.000Z',
    })
  })

  it('queries at least the full 60d baseline history', async () => {
    const calls: Array<{ from: string; to: string }> = []
    const repository = {
      listEvidence: async (_workspaceId: string, from: string, to: string) => {
        calls.push({ from, to })
        return []
      },
      getWorkspaceTimezone: async () => 'Europe/Lisbon',
      insertStrategyNote: async () => ({ id: 'note-1' }),
    }
    const service = createAnalyticsContextService(repository)
    await service.buildAnalyticsContext('workspace-1', '2026-08-18T12:00:00.000Z')

    expect(calls).toEqual([{
      from: '2026-04-20T12:00:00.000Z',
      to: '2026-08-18T12:00:00.000Z',
    }])
  })
})
