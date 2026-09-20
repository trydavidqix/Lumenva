import { describe, expect, it, vi } from 'vitest'

describe('media storage import', () => {
  it('downloads an allowlisted video within the configured size and uploads to the canonical path', async () => {
    const mod = await import('./media-storage').catch(() => null)
    expect(mod, 'media storage module must exist').not.toBeNull()
    if (!mod) return

    const bytes = new Uint8Array([1, 2, 3, 4])
    const store = { upload: vi.fn(async () => undefined) }
    const fetchImpl = vi.fn(async () =>
      new Response(bytes, {
        status: 200,
        headers: {
          'content-type': 'video/mp4',
          'content-length': String(bytes.byteLength),
        },
      }),
    )
    const storage = mod.createMediaStorage(store, {
      bucket: 'media',
      maxBytes: 1024,
      allowedMimeTypes: ['video/mp4'],
      allowedOrigins: ['https://moneyprinter.test'],
      fetchImpl,
    })

    const result = await storage.importFromUrl({
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      assetId: 'asset-1',
      downloadUrl: 'https://moneyprinter.test/tasks/task-1/final.mp4',
    })

    expect(result).toEqual({
      bucket: 'media',
      path: 'workspace/workspace-1/content/content-1/asset-1',
      mimeType: 'video/mp4',
      sizeBytes: 4,
    })
    expect(store.upload).toHaveBeenCalledWith(
      'media',
      'workspace/workspace-1/content/content-1/asset-1',
      expect.any(Uint8Array),
      'video/mp4',
    )
  })

  it('rejects a MIME type outside the allowlist before upload', async () => {
    const mod = await import('./media-storage').catch(() => null)
    expect(mod, 'media storage module must exist').not.toBeNull()
    if (!mod) return

    const store = { upload: vi.fn(async () => undefined) }
    const storage = mod.createMediaStorage(store, {
      bucket: 'media',
      maxBytes: 1024,
      allowedMimeTypes: ['video/mp4'],
      allowedOrigins: ['https://moneyprinter.test'],
      fetchImpl: async () =>
        new Response(new Uint8Array([1]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
    })

    await expect(
      storage.importFromUrl({
        workspaceId: 'workspace-1',
        contentItemId: 'content-1',
        assetId: 'asset-1',
        downloadUrl: 'https://moneyprinter.test/tasks/task-1/final.jpg',
      }),
    ).rejects.toMatchObject({ code: 'media_type_rejected', retryable: false })
    expect(store.upload).not.toHaveBeenCalled()
  })

  it('rejects declared or actual content larger than the configured limit', async () => {
    const mod = await import('./media-storage').catch(() => null)
    expect(mod, 'media storage module must exist').not.toBeNull()
    if (!mod) return

    const store = { upload: vi.fn(async () => undefined) }
    const options = {
      bucket: 'media',
      maxBytes: 3,
      allowedMimeTypes: ['video/mp4'],
      allowedOrigins: ['https://moneyprinter.test'],
    }

    const declaredTooLarge = mod.createMediaStorage(store, {
      ...options,
      fetchImpl: async () =>
        new Response(new Uint8Array([1]), {
          headers: { 'content-type': 'video/mp4', 'content-length': '4' },
        }),
    })
    await expect(
      declaredTooLarge.importFromUrl({
        workspaceId: 'workspace-1',
        contentItemId: 'content-1',
        assetId: 'asset-1',
        downloadUrl: 'https://moneyprinter.test/tasks/task-1/final.mp4',
      }),
    ).rejects.toMatchObject({ code: 'media_too_large', retryable: false })

    const actualTooLarge = mod.createMediaStorage(store, {
      ...options,
      fetchImpl: async () =>
        new Response(new Uint8Array([1, 2, 3, 4]), {
          headers: { 'content-type': 'video/mp4' },
        }),
    })
    await expect(
      actualTooLarge.importFromUrl({
        workspaceId: 'workspace-1',
        contentItemId: 'content-1',
        assetId: 'asset-2',
        downloadUrl: 'https://moneyprinter.test/tasks/task-1/final.mp4',
      }),
    ).rejects.toMatchObject({ code: 'media_too_large', retryable: false })
    expect(store.upload).not.toHaveBeenCalled()
  })

  it('stops reader consumption as soon as a chunked response exceeds the configured limit', async () => {
    const mod = await import('./media-storage').catch(() => null)
    expect(mod, 'media storage module must exist').not.toBeNull()
    if (!mod) return

    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2]) })
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([3, 4]) })
      .mockRejectedValue(new Error('reader consumed beyond the size boundary'))
    const cancel = vi.fn(async () => undefined)
    const releaseLock = vi.fn()
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'video/mp4' }),
      body: { getReader: () => ({ read, cancel, releaseLock }) },
      arrayBuffer: vi.fn(async () => {
        throw new Error('unbounded arrayBuffer must not be used')
      }),
    } as unknown as Response

    const store = { upload: vi.fn(async () => undefined) }
    const storage = mod.createMediaStorage(store, {
      bucket: 'media',
      maxBytes: 3,
      allowedMimeTypes: ['video/mp4'],
      allowedOrigins: ['https://moneyprinter.test'],
      fetchImpl: async () => response,
    })

    await expect(
      storage.importFromUrl({
        workspaceId: 'workspace-1',
        contentItemId: 'content-1',
        assetId: 'asset-stream',
        downloadUrl: 'https://moneyprinter.test/tasks/task-1/chunked.mp4',
      }),
    ).rejects.toMatchObject({ code: 'media_too_large', retryable: false })
    expect(read).toHaveBeenCalledTimes(2)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(releaseLock).toHaveBeenCalledTimes(1)
    expect(response.arrayBuffer).not.toHaveBeenCalled()
    expect(store.upload).not.toHaveBeenCalled()
  })

  it('rejects an empty successful provider response before upload', async () => {
    const mod = await import('./media-storage').catch(() => null)
    expect(mod, 'media storage module must exist').not.toBeNull()
    if (!mod) return

    const store = { upload: vi.fn(async () => undefined) }
    const storage = mod.createMediaStorage(store, {
      bucket: 'media',
      maxBytes: 1024,
      allowedMimeTypes: ['video/mp4'],
      allowedOrigins: ['https://moneyprinter.test'],
      fetchImpl: async () =>
        new Response(new Uint8Array(), {
          status: 200,
          headers: { 'content-type': 'video/mp4', 'content-length': '0' },
        }),
    })

    await expect(
      storage.importFromUrl({
        workspaceId: 'workspace-1',
        contentItemId: 'content-1',
        assetId: 'asset-empty',
        downloadUrl: 'https://moneyprinter.test/tasks/task-1/empty.mp4',
      }),
    ).rejects.toMatchObject({ code: 'media_download_failed', retryable: true })
    expect(store.upload).not.toHaveBeenCalled()
  })

  it('uses idempotent Supabase upsert for canonical media retries', async () => {
    const mod = await import('./media-storage').catch(() => null)
    expect(mod, 'media storage module must exist').not.toBeNull()
    if (!mod) return

    const upload = vi.fn(async () => ({ data: { path: 'asset-1' }, error: null }))
    const from = vi.fn(() => ({ upload }))
    const client = { storage: { from } }
    const store = mod.createSupabaseMediaObjectStore(client as never)
    const bytes = new Uint8Array([1, 2, 3])

    await store.upload(
      'media',
      'workspace/workspace-1/content/content-1/asset-1',
      bytes,
      'video/mp4',
    )

    expect(from).toHaveBeenCalledWith('media')
    expect(upload).toHaveBeenCalledWith(
      'workspace/workspace-1/content/content-1/asset-1',
      bytes,
      { contentType: 'video/mp4', upsert: true },
    )
  })
})
