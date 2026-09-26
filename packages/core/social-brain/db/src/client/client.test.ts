import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ kind: 'browser' })),
  createServerClient: vi.fn(() => ({ kind: 'server' })),
}))

vi.mock('@supabase/ssr', () => mocks)

import { createDbBrowserClient } from './browser'
import { createDbServerClient } from './server'

describe('typed Supabase clients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a browser client with the project public configuration', () => {
    expect(createDbBrowserClient('https://example.supabase.co', 'publishable-key')).toEqual({ kind: 'browser' })
    expect(mocks.createBrowserClient).toHaveBeenCalledWith('https://example.supabase.co', 'publishable-key')
  })

  it('passes the SSR cookie options to the server client', () => {
    const options = {
      cookies: {
        getAll: () => [],
        setAll: () => undefined,
      },
    }

    expect(createDbServerClient('https://example.supabase.co', 'publishable-key', options)).toEqual({ kind: 'server' })
    expect(mocks.createServerClient).toHaveBeenCalledWith('https://example.supabase.co', 'publishable-key', options)
  })
})
