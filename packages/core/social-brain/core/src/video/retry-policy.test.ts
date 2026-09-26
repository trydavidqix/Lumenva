import { describe, expect, it } from 'vitest'

describe('video retry policy', () => {
  it('classifies timeout, 429 and temporary 5xx as retryable', async () => {
    const mod = await import('./retry-policy').catch(() => null)
    expect(mod, 'video retry policy module must exist').not.toBeNull()
    if (!mod) return

    expect(mod.classifyVideoFailure({ kind: 'timeout', message: 'timed out' })).toMatchObject({
      code: 'video_timeout',
      retryable: true,
    })
    expect(mod.classifyVideoFailure({ kind: 'http', status: 429, message: 'slow down' })).toMatchObject({
      code: 'video_rate_limited',
      retryable: true,
    })
    expect(mod.classifyVideoFailure({ kind: 'http', status: 503, message: 'unavailable' })).toMatchObject({
      code: 'video_provider_unavailable',
      retryable: true,
    })
  })

  it('classifies validation and auth failures as terminal', async () => {
    const mod = await import('./retry-policy').catch(() => null)
    expect(mod, 'video retry policy module must exist').not.toBeNull()
    if (!mod) return

    expect(mod.classifyVideoFailure({ kind: 'validation', message: 'bad request' })).toMatchObject({
      code: 'video_validation_failed',
      retryable: false,
    })
    expect(mod.classifyVideoFailure({ kind: 'auth', message: 'denied' })).toMatchObject({
      code: 'video_auth_failed',
      retryable: false,
    })
    expect(mod.classifyVideoFailure({ kind: 'http', status: 400, message: 'bad request' }).retryable).toBe(false)
  })

  it('never retries after the configured attempt budget is exhausted', async () => {
    const mod = await import('./retry-policy').catch(() => null)
    expect(mod, 'video retry policy module must exist').not.toBeNull()
    if (!mod) return

    const retryable = mod.classifyVideoFailure({ kind: 'http', status: 500, message: 'temporary' })
    const terminal = mod.classifyVideoFailure({ kind: 'validation', message: 'invalid' })

    expect(mod.canRetryVideo(retryable, 1, 3)).toBe(true)
    expect(mod.canRetryVideo(retryable, 2, 3)).toBe(true)
    expect(mod.canRetryVideo(retryable, 3, 3)).toBe(false)
    expect(mod.canRetryVideo(terminal, 1, 3)).toBe(false)
    expect(mod.canRetryVideo(retryable, 0, 0)).toBe(false)
  })
})
