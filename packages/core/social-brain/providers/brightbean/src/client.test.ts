import { describe, expect, it, vi } from 'vitest'

import { BrightBeanClient } from './client'

describe('BrightBean client URL normalization', () => {
  it('normalizes a pathological trailing slash run without regex backtracking', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }))
    const client = new BrightBeanClient({
      baseUrl: `https://brightbean.test${'/'.repeat(200_000)}`,
      apiKey: 'test-key',
      fetchImpl,
    })

    await expect(client.get('/health')).resolves.toEqual({})
    expect(fetchImpl).toHaveBeenCalledWith('https://brightbean.test/health', expect.any(Object))
  })
})
