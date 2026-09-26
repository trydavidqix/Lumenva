import { describe, expect, it, vi } from 'vitest'

import { createR2ObjectStore, R2StorageError, type R2BucketLike, type R2StoreOptions } from './r2'

const ref = { workspaceId: 'workspace-1', objectId: 'asset-1' }
const authorization = { actorId: 'actor-1', workspaceId: 'workspace-1' }

function makeBucket(): R2BucketLike {
  return { put: vi.fn(async () => undefined), get: vi.fn(async () => null), head: vi.fn(async () => null), delete: vi.fn(async () => undefined) }
}

function makeStore(bucket: R2BucketLike = makeBucket()) {
  return { bucket, store: createR2ObjectStore(bucket, { bucketName: 'private-media', maxBytes: 10, allowedContentTypes: ['video/mp4'], readUrl: vi.fn(async (key, seconds) => `https://media.test/${key}?ttl=${seconds}`), authorize: async () => true }) }
}

describe('R2 object store', () => {
  it('generates the bucket-owned key, stores SHA-256 and preserves metadata', async () => {
    const { bucket, store } = makeStore()
    const bytes = new Uint8Array([1, 2, 3])
    const result = await store.put(ref, { bytes, contentType: 'video/mp4; codecs=h264', metadata: { source: 'test' } }, authorization)
    expect(result).toEqual({ contentType: 'video/mp4', sizeBytes: 3, sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81' })
    expect(bucket.put).toHaveBeenCalledWith('media/workspace/workspace-1/object/asset-1', bytes, expect.objectContaining({ httpMetadata: { contentType: 'video/mp4' }, customMetadata: expect.objectContaining({ source: 'test', sha256: expect.stringMatching(/^[a-f0-9]{64}$/) }) }))
  })

  it('supports get, head, delete and signed read URLs without exposing bucket/key inputs', async () => {
    const bucket = makeBucket()
    const bytes = new Uint8Array([7, 8])
    const sha256 = 'bd7c250566c6e99f47c174b589b7551f8b0e930ed056511d1e8f653bc71d3c4a'
    bucket.get = vi.fn(async () => ({ body: { arrayBuffer: async () => bytes.buffer }, customMetadata: { sha256 } }))
    bucket.head = vi.fn(async () => ({ size: 2, httpMetadata: { contentType: 'video/mp4' }, customMetadata: { sha256 } }))
    const { store } = makeStore(bucket)
    await expect(store.get(ref, authorization)).resolves.toEqual(bytes)
    await expect(store.head(ref, authorization)).resolves.toEqual({ contentType: 'video/mp4', sizeBytes: 2, sha256 })
    await expect(store.createReadUrl(ref, 60, authorization)).resolves.toContain('media/workspace/workspace-1/object/asset-1')
    await expect(store.delete(ref, authorization)).resolves.toBeUndefined()
    expect(bucket.delete).toHaveBeenCalledWith('media/workspace/workspace-1/object/asset-1')
  })

  it('rejects unsafe references, disallowed types, oversized objects and bad checksums', async () => {
    const { store } = makeStore()
    await expect(store.get({ workspaceId: 'workspace-1', objectId: '../escape' }, authorization)).rejects.toMatchObject({ code: 'invalid_reference' })
    await expect(store.put(ref, { bytes: new Uint8Array([1]), contentType: 'text/plain' }, authorization)).rejects.toMatchObject({ code: 'content_type_rejected' })
    await expect(store.put(ref, { bytes: new Uint8Array(11), contentType: 'video/mp4' }, authorization)).rejects.toMatchObject({ code: 'object_too_large' })
    const bucket = makeBucket()
    bucket.get = vi.fn(async () => ({ body: { arrayBuffer: async () => new Uint8Array([1]).buffer }, customMetadata: { sha256: '0'.repeat(64) } }))
    await expect(makeStore(bucket).store.get(ref, authorization)).rejects.toBeInstanceOf(R2StorageError)
    await expect(makeStore().store.createReadUrl(ref, 3_601, authorization)).rejects.toMatchObject({ code: 'invalid_configuration' })
  })

  it('rejects pathological references and prefixes without regex backtracking', async () => {
    const { store } = makeStore()
    const pathological = `${'a'.repeat(200_000)}!`
    await expect(store.get({ workspaceId: pathological, objectId: 'asset-1' }, authorization)).rejects.toMatchObject({ code: 'invalid_reference' })
    expect(() => createR2ObjectStore(makeBucket(), {
      bucketName: 'private-media',
      maxBytes: 10,
      allowedContentTypes: ['video/mp4'],
      readUrl: vi.fn(async () => 'https://media.test/read'),
      authorize: async () => true,
      keyPrefix: `${'/'.repeat(100_000)}${'a'.repeat(200_000)}!`,
    })).toThrowError(expect.objectContaining({ code: 'invalid_configuration' }))
  })

  it('fails closed when actor context is absent before calling the bucket', async () => {
    const { bucket, store } = makeStore()
    await expect(store.get(ref, undefined as never)).rejects.toMatchObject({ code: 'authorization_required' })
    expect(bucket.get).not.toHaveBeenCalled()
  })

  it('rejects a context for a different workspace before calling the bucket', async () => {
    const { bucket, store } = makeStore()
    await expect(store.delete(ref, { actorId: 'actor-1', workspaceId: 'workspace-2' })).rejects.toMatchObject({ code: 'authorization_denied' })
    expect(bucket.delete).not.toHaveBeenCalled()
  })

  it('rejects a denied policy before calling the bucket', async () => {
    const bucket = makeBucket()
    const policy = vi.fn(async () => false)
    const deniedStore = createR2ObjectStore(bucket, {
      bucketName: 'private-media',
      maxBytes: 10,
      allowedContentTypes: ['video/mp4'],
      readUrl: vi.fn(async () => 'https://media.test/read'),
      authorize: policy,
    })
    await expect(deniedStore.put(ref, { bytes: new Uint8Array([1]), contentType: 'video/mp4' }, authorization)).rejects.toMatchObject({ code: 'authorization_denied' })
    expect(policy).toHaveBeenCalledWith(expect.objectContaining({ operation: 'put', ref, context: authorization }))
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('requires a server-side authorization policy at the adapter boundary', () => {
    const options = {
      bucketName: 'private-media',
      maxBytes: 10,
      allowedContentTypes: ['video/mp4'],
      readUrl: vi.fn(async () => 'https://media.test/read'),
    } as unknown as R2StoreOptions
    expect(() => createR2ObjectStore(makeBucket(), options)).toThrowError(expect.objectContaining({ code: 'authorization_required' }))
  })

  it('rejects every unauthorized operation before calling the bucket', async () => {
    const bucket = makeBucket()
    const deniedStore = createR2ObjectStore(bucket, {
      bucketName: 'private-media',
      maxBytes: 10,
      allowedContentTypes: ['video/mp4'],
      readUrl: vi.fn(async () => 'https://media.test/read'),
      authorize: async () => false,
    })

    await expect(deniedStore.put(ref, { bytes: new Uint8Array([1]), contentType: 'video/mp4' }, authorization)).rejects.toMatchObject({ code: 'authorization_denied' })
    await expect(deniedStore.get(ref, authorization)).rejects.toMatchObject({ code: 'authorization_denied' })
    await expect(deniedStore.head(ref, authorization)).rejects.toMatchObject({ code: 'authorization_denied' })
    await expect(deniedStore.delete(ref, authorization)).rejects.toMatchObject({ code: 'authorization_denied' })
    await expect(deniedStore.createReadUrl(ref, 60, authorization)).rejects.toMatchObject({ code: 'authorization_denied' })
    expect(bucket.put).not.toHaveBeenCalled()
    expect(bucket.get).not.toHaveBeenCalled()
    expect(bucket.head).not.toHaveBeenCalled()
    expect(bucket.delete).not.toHaveBeenCalled()
  })
})
