import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const API_KEY = 'bb_studio_test_secret_never_log'
const BASE_URL = 'https://brightbean.test'
const INSTAGRAM_ACCOUNT_ID = '11111111-1111-4111-8111-111111111111'
const POST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const NETWORK_POST_ID = 'instagram-media-17890000000000000'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function fixture(name: string): unknown {
  const url = new URL(`../../../testkit/src/fixtures/brightbean/${name}`, import.meta.url)
  return JSON.parse(readFileSync(url, 'utf8'))
}

function jsonFetch(payload: unknown, status = 200, inspect?: (url: string, init?: RequestInit) => void): FetchLike {
  return async (input, init) => {
    const url = String(input)
    inspect?.(url, init)
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
}

async function createProvider(fetchImpl: FetchLike) {
  const mod = await import('./provider').catch(() => null)
  expect(mod, 'BrightBean provider module must exist').not.toBeNull()
  if (!mod) throw new Error('BrightBean provider module missing')

  return new mod.BrightBeanProvider({
    baseUrl: BASE_URL,
    apiKey: API_KEY,
    fetchImpl,
    timeoutMs: 50,
  })
}

describe('BrightBeanProvider contract', () => {
  it('maps only the four V1 social platforms and sends bearer auth', async () => {
    let requestUrl = ''
    let authorization = ''
    const provider = await createProvider(
      jsonFetch(fixture('accounts.json'), 200, (url, init) => {
        requestUrl = url
        authorization = new Headers(init?.headers).get('authorization') ?? ''
      }),
    )

    const accounts = await provider.listAccounts()

    expect(requestUrl).toBe(`${BASE_URL}/api/v1/accounts/`)
    expect(authorization).toBe(`Bearer ${API_KEY}`)
    expect(accounts.map((account: { platform: string }) => account.platform)).toEqual([
      'instagram',
      'facebook',
      'tiktok',
      'youtube',
    ])
    expect(accounts.every((account: { externalAccountId: string | null }) => account.externalAccountId === null)).toBe(true)
  })

  it('marks token-expiring accounts as disabled until they reconnect', async () => {
    const payload = fixture('accounts.json') as { accounts: Array<Record<string, unknown>> }
    payload.accounts[0] = { ...payload.accounts[0], connection_status: 'token_expiring' }
    const provider = await createProvider(jsonFetch(payload))

    const accounts = await provider.listAccounts()

    expect(accounts[0]).toMatchObject({
      providerAccountId: INSTAGRAM_ACCOUNT_ID,
      status: 'disabled',
    })
  })

  it('does not map the separate instagram_login connector into the V1 Instagram account set', async () => {
    const payload = fixture('accounts.json') as { accounts: Array<Record<string, unknown>> }
    payload.accounts.push({
      ...payload.accounts[0],
      id: '66666666-6666-4666-8666-666666666666',
      platform: 'instagram_login',
    })
    const provider = await createProvider(jsonFetch(payload))

    const accounts = await provider.listAccounts()

    expect(accounts.map((account: { platform: string }) => account.platform)).not.toContain('instagram_login')
    expect(accounts).toHaveLength(4)
  })

  it('normalizes account analytics and preserves unavailable metrics as null', async () => {
    let requestUrl = ''
    const provider = await createProvider(
      jsonFetch(fixture('account-analytics.json'), 200, (url) => {
        requestUrl = url
      }),
    )

    const snapshot = await provider.getAccountAnalytics({
      providerAccountId: INSTAGRAM_ACCOUNT_ID,
      capturedAt: '2026-08-17T12:15:00Z',
      captureWindow: '30d',
    })

    expect(requestUrl).toBe(`${BASE_URL}/api/v1/analytics/accounts/${INSTAGRAM_ACCOUNT_ID}?days=30`)
    expect(snapshot).toMatchObject({
      source: 'brightbean',
      sourceVersion: null,
      capturedAt: '2026-08-17T12:00:00Z',
      captureWindow: '30d',
      externalPostId: null,
      metrics: {
        views: 1200,
        reach: 800,
        impressions: null,
        likes: 100,
        comments: 12,
        shares: 8,
        watchTimeMs: null,
        retentionRate: null,
        followerDelta: 25,
      },
    })
  })

  it('uses the BrightBean post id for analytics lookup and preserves the network post id', async () => {
    let requestUrl = ''
    const provider = await createProvider(
      jsonFetch(fixture('post-analytics.json'), 200, (url) => {
        requestUrl = url
      }),
    )

    const snapshot = await provider.getPostAnalytics({
      providerAccountId: INSTAGRAM_ACCOUNT_ID,
      providerPostId: POST_ID,
      externalPostId: NETWORK_POST_ID,
      capturedAt: '2026-08-17T12:15:00Z',
      captureWindow: null,
    })

    expect(requestUrl).toBe(`${BASE_URL}/api/v1/analytics/posts/${POST_ID}`)
    expect(snapshot).toMatchObject({
      source: 'brightbean',
      capturedAt: '2026-08-17T12:10:00Z',
      externalPostId: NETWORK_POST_ID,
      metrics: {
        views: 400,
        reach: null,
        impressions: null,
        likes: 40,
        comments: 5,
        shares: 3,
        watchTimeMs: null,
        retentionRate: null,
        followerDelta: null,
      },
    })
  })

  it.each([
    [401, 'unauthorized'],
    [429, 'rate_limited'],
    [503, 'upstream_error'],
  ])('maps HTTP %i to a safe provider error', async (status, code) => {
    const provider = await createProvider(jsonFetch({ detail: `do not leak ${API_KEY}` }, status))

    const error = await provider.listAccounts().then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code, status })
    expect(String(error)).not.toContain(API_KEY)
  })

  it('maps AbortError to timeout without leaking credentials', async () => {
    const provider = await createProvider(async () => {
      const error = new Error(`aborted ${API_KEY}`)
      error.name = 'AbortError'
      throw error
    })

    const error = await provider.listAccounts().then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code: 'timeout' })
    expect(String(error)).not.toContain(API_KEY)
  })

  it('rejects malformed BrightBean payloads safely', async () => {
    const provider = await createProvider(
      jsonFetch({ accounts: [{ platform: 'instagram', account_name: 'missing id and state' }] }),
    )

    await expect(provider.listAccounts()).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
