import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const BASE_URL = 'https://moneyprinter.test'
const API_TOKEN = 'mp_test_secret_never_log'
const TASK_ID = 'mp-task-123'

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function fixture(name: string): unknown {
  const url = new URL(`../../../testkit/src/fixtures/moneyprinter/${name}`, import.meta.url)
  return JSON.parse(readFileSync(url, 'utf8'))
}

function jsonFetch(
  payload: unknown,
  status = 200,
  inspect?: (url: string, init?: RequestInit) => void,
): FetchLike {
  return async (input, init) => {
    inspect?.(String(input), init)
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }
}

async function createProvider(fetchImpl: FetchLike) {
  const mod = await import('./provider').catch(() => null)
  expect(mod, 'MoneyPrinter provider module must exist').not.toBeNull()
  if (!mod) throw new Error('MoneyPrinter provider module missing')

  return new mod.MoneyPrinterProvider({
    baseUrl: BASE_URL,
    apiToken: API_TOKEN,
    fetchImpl,
    timeoutMs: 50,
  })
}

const input = {
  contentItemId: 'content-1',
  subject: 'Social video hooks',
  script: 'Use the first two seconds to state the result, then prove it.',
  videoBrief: {
    format: '9:16' as const,
    durationTargetSeconds: 35,
    visualDirection: 'Fast vertical cuts with large captions',
    voiceDirection: 'Clear and energetic',
  },
  idempotencyKey: 'video-content-1-v1',
}

describe('MoneyPrinterProvider contract', () => {
  it('submits the Claude-authored script to the official /api/v1/videos endpoint', async () => {
    let requestUrl = ''
    let requestBody: unknown = null
    let authorization = ''
    const provider = await createProvider(
      jsonFetch(fixture('job-created.json'), 200, (url, init) => {
        requestUrl = url
        requestBody = JSON.parse(String(init?.body))
        authorization = new Headers(init?.headers).get('authorization') ?? ''
      }),
    )

    const job = await provider.submit(input)

    expect(requestUrl).toBe(`${BASE_URL}/api/v1/videos`)
    expect(requestBody).toEqual({
      video_subject: input.subject,
      video_script: input.script,
      video_aspect: '9:16',
      video_count: 1,
    })
    expect(authorization).toBe(`Bearer ${API_TOKEN}`)
    expect(job).toEqual({ provider: 'moneyprinter', providerJobId: TASK_ID, state: 'queued' })
  })

  it('maps official processing state 4 to running', async () => {
    let requestUrl = ''
    const provider = await createProvider(
      jsonFetch(
        { status: 200, message: 'success', data: { task_id: TASK_ID, state: 4, progress: 45 } },
        200,
        (url) => {
          requestUrl = url
        },
      ),
    )

    await expect(provider.status(TASK_ID)).resolves.toEqual({
      provider: 'moneyprinter',
      providerJobId: TASK_ID,
      state: 'running',
    })
    expect(requestUrl).toBe(`${BASE_URL}/api/v1/tasks/${TASK_ID}`)
  })

  it('maps official complete state 1 and returns the canonical download URL', async () => {
    const provider = await createProvider(jsonFetch(fixture('job-complete.json')))

    await expect(provider.fetchResult(TASK_ID)).resolves.toEqual({
      providerJobId: TASK_ID,
      state: 'succeeded',
      downloadUrl: `${BASE_URL}/tasks/${TASK_ID}/final-1.mp4`,
    })
  })

  it('maps official failed state -1 to a terminal canonical result', async () => {
    const provider = await createProvider(jsonFetch(fixture('job-failed.json')))

    await expect(provider.fetchResult(TASK_ID)).resolves.toMatchObject({
      providerJobId: TASK_ID,
      state: 'failed',
      error: {
        code: 'moneyprinter_task_failed',
        retryable: false,
      },
    })
  })

  it.each([
    [422, 'validation_failed', false],
    [429, 'rate_limited', true],
    [503, 'submission_uncertain', false],
  ])('maps submit HTTP %i to safe provider error %s', async (status, code, retryable) => {
    const provider = await createProvider(
      jsonFetch({ detail: `do not leak ${API_TOKEN} or ${BASE_URL}` }, status),
    )

    const error = await provider.submit(input).then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code, status, retryable })
    expect(String(error)).not.toContain(API_TOKEN)
    expect(String(error)).not.toContain(BASE_URL)
  })

  it('treats submit timeout as uncertain and never blind-retries it', async () => {
    const provider = await createProvider(async () => {
      const error = new Error(`aborted ${API_TOKEN} ${BASE_URL}`)
      error.name = 'AbortError'
      throw error
    })

    const error = await provider.submit(input).then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code: 'submission_uncertain', retryable: false })
    expect(String(error)).not.toContain(API_TOKEN)
    expect(String(error)).not.toContain(BASE_URL)
  })

  it('treats submit network failure as uncertain and never blind-retries it', async () => {
    const provider = await createProvider(async () => {
      throw new Error(`network ${API_TOKEN} ${BASE_URL}`)
    })

    const error = await provider.submit(input).then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code: 'submission_uncertain', retryable: false })
    expect(String(error)).not.toContain(API_TOKEN)
    expect(String(error)).not.toContain(BASE_URL)
  })

  it('keeps polling timeout retryable because no new remote task is created', async () => {
    const provider = await createProvider(async () => {
      const error = new Error(`aborted ${API_TOKEN} ${BASE_URL}`)
      error.name = 'AbortError'
      throw error
    })

    const error = await provider.status(TASK_ID).then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toMatchObject({ code: 'timeout', retryable: true })
    expect(String(error)).not.toContain(API_TOKEN)
    expect(String(error)).not.toContain(BASE_URL)
  })

  it('rejects malformed MoneyPrinter payloads safely', async () => {
    const provider = await createProvider(
      jsonFetch({ status: 200, message: 'success', data: { missing_task_id: true } }),
    )

    await expect(provider.submit(input)).rejects.toMatchObject({
      code: 'invalid_response',
      retryable: false,
    })
  })
})
