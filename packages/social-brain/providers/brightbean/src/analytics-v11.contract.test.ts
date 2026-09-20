import { describe, expect, it } from 'vitest'

import { BrightBeanProvider } from './provider'

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111'
const POST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function response(payload: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }))
}

describe('BrightBean V1.1 analytics contract', () => {
  it('normalizes official saves and avg_view_pct metrics without inventing completion', async () => {
    const provider = new BrightBeanProvider({
      baseUrl: 'https://brightbean.test',
      apiKey: 'test-key',
      fetchImpl: () => response({
        post_id: POST_ID,
        workspace_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        title: 'Analytics',
        caption: 'Analytics',
        platform_posts: [{
          platform_post_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          social_account_id: ACCOUNT_ID,
          platform: 'instagram',
          status: 'published',
          published_at: '2026-08-18T10:00:00Z',
          analytics_available: true,
          unavailable_reason: null,
          metric_tiles: [
            { key: 'views', label: 'Views', kind: 'count', value: 1000, series: [], is_primary: true },
            { key: 'saves', label: 'Saves', kind: 'count', value: 44, series: [], is_primary: false },
            { key: 'avg_view_pct', label: 'Avg view %', kind: 'percent', value: 63.5, series: [], is_primary: false },
          ],
          captured_at: '2026-08-18T12:00:00Z',
          next_sync_eta: null,
        }],
      }),
      timeoutMs: 100,
    })

    const snapshot = await provider.getPostAnalytics({
      providerAccountId: ACCOUNT_ID,
      providerPostId: POST_ID,
      externalPostId: 'network-post-1',
      capturedAt: '2026-08-18T12:00:00Z',
      captureWindow: null,
    })

    expect(snapshot.metrics).toMatchObject({
      views: 1000,
      saves: 44,
      retentionRate: 63.5,
    })
    expect(snapshot.metrics).not.toHaveProperty('completionRate')
  })
})
