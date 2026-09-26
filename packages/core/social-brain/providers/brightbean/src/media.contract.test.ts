import { describe, expect, it } from 'vitest'

import { BrightBeanProvider } from './provider'

const MEDIA_ID = '22222222-2222-4222-8222-222222222222'

function mediaPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: MEDIA_ID,
    organization_id: null,
    workspace_id: '33333333-3333-4333-8333-333333333333',
    filename: 'video.mp4',
    media_type: 'video',
    mime_type: 'video/mp4',
    file_size: 3,
    file_size_display: '3 B',
    width: 1080,
    height: 1920,
    aspect_ratio: 0.5625,
    duration: 15,
    title: '',
    alt_text: '',
    tags: [],
    folder_id: null,
    is_starred: false,
    is_shared: false,
    processing_status: 'completed',
    url: '/media/video.mp4',
    thumbnail_url: null,
    created_at: '2026-08-17T18:30:00Z',
    updated_at: '2026-08-17T18:30:00Z',
    ...overrides,
  }
}

describe('BrightBean media contract', () => {
  it('uploads generated media as multipart with a stable idempotency key', async () => {
    let requestUrl = ''
    let requestInit: RequestInit | undefined
    const provider = new BrightBeanProvider({
      baseUrl: 'https://brightbean.test',
      apiKey: 'bb_test_media_secret',
      fetchImpl: async (input, init) => {
        requestUrl = String(input)
        requestInit = init
        return new Response(JSON.stringify(mediaPayload()), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        })
      },
    })

    const result = await provider.uploadMedia({
      filename: 'video.mp4',
      mimeType: 'video/mp4',
      bytes: new Uint8Array([1, 2, 3]),
      idempotencyKey: 'media:asset-1',
    })

    expect(requestUrl).toBe('https://brightbean.test/api/v1/media/')
    expect(requestInit?.method).toBe('POST')
    expect(new Headers(requestInit?.headers).get('content-type')).toBeNull()
    expect(requestInit?.body).toBeInstanceOf(FormData)
    const form = requestInit?.body as FormData
    expect(form.get('idempotency_key')).toBe('media:asset-1')
    expect(form.get('file')).toBeInstanceOf(Blob)
    expect(result).toEqual({
      providerMediaAssetId: MEDIA_ID,
      processingStatus: 'completed',
    })
  })

  it('rejects malformed media responses instead of inventing a provider id', async () => {
    const provider = new BrightBeanProvider({
      baseUrl: 'https://brightbean.test',
      apiKey: 'bb_test_media_secret',
      fetchImpl: async () => new Response(JSON.stringify({ processing_status: 'completed' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    })

    await expect(provider.uploadMedia({
      filename: 'video.mp4',
      mimeType: 'video/mp4',
      bytes: new Uint8Array([1]),
      idempotencyKey: 'media:asset-1',
    })).rejects.toMatchObject({ code: 'invalid_response' })
  })
})
