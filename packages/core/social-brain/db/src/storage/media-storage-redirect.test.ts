import { describe, expect, it, vi } from 'vitest'

import { createMediaStorage } from './media-storage'

describe('media storage redirect safety', () => {
  it('disables automatic redirects so the configured origin allowlist cannot be bypassed', async () => {
    let redirect: RequestRedirect | undefined
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      redirect = init?.redirect
      return new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/internal' },
      })
    })
    const store = { upload: vi.fn(async () => undefined) }
    const storage = createMediaStorage(store, {
      bucket: 'media',
      maxBytes: 1024,
      allowedMimeTypes: ['video/mp4'],
      allowedOrigins: ['https://moneyprinter.test'],
      fetchImpl,
    })

    await expect(
      storage.importFromUrl({
        workspaceId: 'workspace-1',
        contentItemId: 'content-1',
        assetId: 'asset-1',
        downloadUrl: 'https://moneyprinter.test/tasks/task-1/final.mp4',
      }),
    ).rejects.toMatchObject({ retryable: false })

    expect(redirect).toBe('manual')
    expect(store.upload).not.toHaveBeenCalled()
  })
})
