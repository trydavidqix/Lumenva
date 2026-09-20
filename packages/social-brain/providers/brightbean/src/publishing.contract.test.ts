import { describe, expect, it } from 'vitest'

const API_KEY = 'bb_studio_publish_test_secret_never_log'
const BASE_URL = 'https://brightbean.test'
const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111'
const MEDIA_ID = '22222222-2222-4222-8222-222222222222'
const POST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PLATFORM_POST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function postResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: POST_ID,
    workspace_id: '33333333-3333-4333-8333-333333333333',
    title: 'Short title',
    caption: 'Caption',
    first_comment: '',
    internal_notes: '',
    scheduled_at: '2026-08-18T18:30:00Z',
    published_at: null,
    proposed_publish_at: null,
    status: 'scheduled',
    platform_posts: [
      {
        id: PLATFORM_POST_ID,
        social_account_id: ACCOUNT_ID,
        platform: 'instagram',
        status: 'scheduled',
        scheduled_at: '2026-08-18T18:30:00Z',
        published_at: null,
        platform_post_id: '',
        publish_error: '',
      },
    ],
    created_at: '2026-08-17T18:30:00Z',
    updated_at: '2026-08-17T18:30:00Z',
    ...overrides,
  }
}

function jsonFetch(payload: unknown, status = 200, inspect?: (url: string, init?: RequestInit) => void): FetchLike {
  return async (input, init) => {
    inspect?.(String(input), init)
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
}

async function createProvider(fetchImpl: FetchLike) {
  const mod = await import('./provider')
  return new mod.BrightBeanProvider({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl,
    timeoutMs: 50,
  })
}

describe('BrightBean publishing contract', () => {
  it('schedules one approved platform job with provider idempotency', async () => {
    let url = ''
    let init: RequestInit | undefined
    const provider = await createProvider(jsonFetch(postResponse(), 200, (nextUrl, nextInit) => {
      url = nextUrl
      init = nextInit
    }))

    const result = await provider.schedulePost({
      providerAccountId: ACCOUNT_ID,
      caption: 'Caption',
      title: 'Short title',
      providerMediaAssetIds: [MEDIA_ID],
      idempotencyKey: 'publish-job-1',
      scheduledFor: '2026-08-18T18:30:00.000Z',
    })

    expect(url).toBe(`${BASE_URL}/api/v1/posts/`)
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${API_KEY}`)
    expect(JSON.parse(String(init?.body))).toEqual({
      social_account_id: ACCOUNT_ID,
      caption: 'Caption',
      title: 'Short title',
      first_comment: '',
      internal_notes: '',
      media_asset_ids: [MEDIA_ID],
      platform_overrides: [],
      action: 'schedule',
      scheduled_at: '2026-08-18T18:30:00.000Z',
      proposed_publish_at: null,
      idempotency_key: 'publish-job-1',
    })
    expect(result).toMatchObject({
      providerPublicationId: POST_ID,
      providerPlatformPublicationId: PLATFORM_POST_ID,
      providerAccountId: ACCOUNT_ID,
      state: 'scheduled',
      externalPostId: null,
      externalUrl: null,
    })
  })

  it('implements publish-now as an explicit deterministic BrightBean schedule', async () => {
    let body: Record<string, unknown> | null = null
    const provider = await createProvider(jsonFetch(postResponse({ scheduled_at: '2026-08-17T18:30:00Z' }), 200, (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
    }))

    await provider.publishNow({
      providerAccountId: ACCOUNT_ID,
      caption: 'Caption',
      title: null,
      providerMediaAssetIds: [MEDIA_ID],
      idempotencyKey: 'publish-now-1',
      executionTime: '2026-08-17T18:30:00.000Z',
    })

    expect(body).toMatchObject({
      action: 'schedule',
      scheduled_at: '2026-08-17T18:30:00.000Z',
      idempotency_key: 'publish-now-1',
    })
  })

  it('reads publication status and keeps internal/external ids separate', async () => {
    const provider = await createProvider(jsonFetch(postResponse({
      status: 'published',
      published_at: '2026-08-17T18:31:00Z',
      platform_posts: [{
        id: PLATFORM_POST_ID,
        social_account_id: ACCOUNT_ID,
        platform: 'instagram',
        status: 'published',
        scheduled_at: '2026-08-17T18:30:00Z',
        published_at: '2026-08-17T18:31:00Z',
        platform_post_id: 'instagram-media-123',
        publish_error: '',
      }],
    })))

    const result = await provider.getPublicationStatus({
      providerPublicationId: POST_ID,
      providerAccountId: ACCOUNT_ID,
    })

    expect(result).toMatchObject({
      providerPublicationId: POST_ID,
      providerPlatformPublicationId: PLATFORM_POST_ID,
      externalPostId: 'instagram-media-123',
      state: 'published',
      publishedAt: '2026-08-17T18:31:00Z',
    })
  })

  it('maps an unknown remote state to unknown, never published', async () => {
    const provider = await createProvider(jsonFetch(postResponse({
      status: 'mystery',
      platform_posts: [{
        id: PLATFORM_POST_ID,
        social_account_id: ACCOUNT_ID,
        platform: 'instagram',
        status: 'mystery',
        scheduled_at: null,
        published_at: null,
        platform_post_id: '',
        publish_error: '',
      }],
    })))

    const result = await provider.getPublicationStatus({
      providerPublicationId: POST_ID,
      providerAccountId: ACCOUNT_ID,
    })

    expect(result.state).toBe('unknown')
  })

  it.each([
    [422, 'request_rejected'],
    [429, 'rate_limited'],
    [503, 'upstream_error'],
  ])('maps publish HTTP %i to safe provider error %s', async (status, code) => {
    const provider = await createProvider(jsonFetch({ detail: `do not leak ${API_KEY}` }, status))

    await expect(provider.schedulePost({
      providerAccountId: ACCOUNT_ID,
      caption: 'Caption',
      title: null,
      providerMediaAssetIds: [MEDIA_ID],
      idempotencyKey: 'error-case',
      scheduledFor: '2026-08-18T18:30:00.000Z',
    })).rejects.toMatchObject({ code, status })
  })

  it('rejects malformed publication payload safely', async () => {
    const provider = await createProvider(jsonFetch({ id: POST_ID, status: 'scheduled' }))

    await expect(provider.schedulePost({
      providerAccountId: ACCOUNT_ID,
      caption: 'Caption',
      title: null,
      providerMediaAssetIds: [MEDIA_ID],
      idempotencyKey: 'bad-payload',
      scheduledFor: '2026-08-18T18:30:00.000Z',
    })).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
