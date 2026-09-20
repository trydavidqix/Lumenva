import { describe, expect, it, vi } from 'vitest'

import { createSupabaseObjectStore } from './object-store'

describe('provider-neutral object store contract', () => {
  it('rejects a locator owned by another provider before calling Supabase', async () => {
    const from = vi.fn()
    const store = createSupabaseObjectStore({ storage: { from } } as never)

    await expect(
      store.get({ provider: 'r2', bucket: 'media', key: 'asset-1' }),
    ).rejects.toThrow('non-Supabase locator')
    expect(from).not.toHaveBeenCalled()
  })

  it('uses the same locator contract for upload and signed reads', async () => {
    const upload = vi.fn(async () => ({ error: null }))
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: 'https://storage.test/signed/asset-1' },
      error: null,
    }))
    const from = vi.fn(() => ({ upload, createSignedUrl }))
    const store = createSupabaseObjectStore({ storage: { from } } as never)
    const locator = { provider: 'supabase' as const, bucket: 'media', key: 'asset-1' }

    await store.put(locator, new Uint8Array([1, 2]), 'video/mp4')
    await expect(store.createReadUrl(locator, 60)).resolves.toBe(
      'https://storage.test/signed/asset-1',
    )

    expect(from).toHaveBeenCalledWith('media')
    expect(upload).toHaveBeenCalledWith('asset-1', expect.any(Uint8Array), {
      contentType: 'video/mp4',
      upsert: true,
    })
    expect(createSignedUrl).toHaveBeenCalledWith('asset-1', 60)
  })
})
