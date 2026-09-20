import { createHash } from 'node:crypto'

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export type R2ObjectRef = {
  workspaceId: string
  objectId: string
}

export type R2ObjectMetadata = {
  contentType: string
  sizeBytes: number
  sha256: string
}

export type R2PutInput = {
  contentType: string
  bytes: Uint8Array
  metadata?: Readonly<Record<string, string>>
}

export type R2AuthorizationContext = {
  actorId: string
  workspaceId: string
}

export type R2AuthorizationOperation = 'put' | 'get' | 'head' | 'delete' | 'createReadUrl'

export type R2AuthorizationRequest = {
  operation: R2AuthorizationOperation
  ref: R2ObjectRef
  context: R2AuthorizationContext
}

export type R2AuthorizationPolicy = (request: R2AuthorizationRequest) => boolean | Promise<boolean>

export type R2StoreOptions = {
  bucketName: string
  maxBytes: number
  allowedContentTypes: readonly string[]
  readUrl: (key: string, expiresInSeconds: number) => Promise<string>
  keyPrefix?: string
  maxReadUrlSeconds?: number
  authorize: R2AuthorizationPolicy
}

export type R2ObjectLike = {
  body: { arrayBuffer(): Promise<ArrayBuffer> }
  httpMetadata?: { contentType?: string }
  size?: number
  customMetadata?: Readonly<Record<string, string>>
}

export type R2BucketLike = {
  put(
    key: string,
    value: Uint8Array,
    options?: {
      httpMetadata?: { contentType: string }
      customMetadata?: Readonly<Record<string, string>>
    },
  ): Promise<unknown>
  get(key: string): Promise<R2ObjectLike | null>
  head(key: string): Promise<Pick<R2ObjectLike, 'httpMetadata' | 'size' | 'customMetadata'> | null>
  delete(key: string): Promise<void>
}

export type R2ObjectStore = {
  put(ref: R2ObjectRef, input: R2PutInput, context: R2AuthorizationContext): Promise<R2ObjectMetadata>
  get(ref: R2ObjectRef, context: R2AuthorizationContext): Promise<Uint8Array>
  head(ref: R2ObjectRef, context: R2AuthorizationContext): Promise<R2ObjectMetadata | null>
  delete(ref: R2ObjectRef, context: R2AuthorizationContext): Promise<void>
  createReadUrl(ref: R2ObjectRef, expiresInSeconds: number, context: R2AuthorizationContext): Promise<string>
}

export class R2StorageError extends Error {
  constructor(
    readonly code:
      | 'invalid_reference'
      | 'invalid_configuration'
      | 'authorization_required'
      | 'authorization_denied'
      | 'content_type_rejected'
      | 'object_too_large'
      | 'object_not_found'
      | 'checksum_mismatch'
      | 'provider_error',
    message: string,
  ) {
    super(message)
    this.name = 'R2StorageError'
  }
}

export function createR2ObjectStore(
  bucket: R2BucketLike,
  options: R2StoreOptions,
): R2ObjectStore {
  validateOptions(options)
  const contentTypes = new Set(options.allowedContentTypes.map(normalizeContentType))
  const prefix = normalizePrefix(options.keyPrefix ?? 'media')
  const maxUrlSeconds = options.maxReadUrlSeconds ?? 3_600

  return {
    async put(ref, input, context) {
      await authorize(options.authorize, 'put', ref, context)
      const key = keyFor(prefix, ref)
      const contentType = normalizeContentType(input.contentType)
      if (!contentTypes.has(contentType)) {
        throw new R2StorageError('content_type_rejected', 'Object content type is not allowed')
      }
      if (input.bytes.byteLength > options.maxBytes) {
        throw new R2StorageError('object_too_large', 'Object exceeds the configured size limit')
      }

      const sha256 = sha256Hex(input.bytes)
      const customMetadata = {
        ...(input.metadata ?? {}),
        sha256,
      }
      try {
        await bucket.put(key, input.bytes, {
          httpMetadata: { contentType },
          customMetadata,
        })
      } catch {
        throw new R2StorageError('provider_error', 'R2 object upload failed')
      }
      return { contentType, sizeBytes: input.bytes.byteLength, sha256 }
    },

    async get(ref, context) {
      await authorize(options.authorize, 'get', ref, context)
      const key = keyFor(prefix, ref)
      let object: R2ObjectLike | null
      try {
        object = await bucket.get(key)
      } catch {
        throw new R2StorageError('provider_error', 'R2 object download failed')
      }
      if (!object) throw new R2StorageError('object_not_found', 'R2 object was not found')

      const bytes = new Uint8Array(await object.body.arrayBuffer())
      const expected = object.customMetadata?.sha256
      if (expected !== undefined && (!SHA256_PATTERN.test(expected) || sha256Hex(bytes) !== expected)) {
        throw new R2StorageError('checksum_mismatch', 'R2 object checksum verification failed')
      }
      if (bytes.byteLength > options.maxBytes) {
        throw new R2StorageError('object_too_large', 'Object exceeds the configured size limit')
      }
      return bytes
    },

    async head(ref, context) {
      await authorize(options.authorize, 'head', ref, context)
      const key = keyFor(prefix, ref)
      let object: Awaited<ReturnType<R2BucketLike['head']>>
      try {
        object = await bucket.head(key)
      } catch {
        throw new R2StorageError('provider_error', 'R2 object metadata lookup failed')
      }
      if (!object) return null
      const sha256 = object.customMetadata?.sha256
      if (!sha256 || !SHA256_PATTERN.test(sha256)) {
        throw new R2StorageError('checksum_mismatch', 'R2 object has no valid SHA-256 checksum')
      }
      return {
        contentType: normalizeContentType(object.httpMetadata?.contentType ?? 'application/octet-stream'),
        sizeBytes: object.size ?? 0,
        sha256,
      }
    },

    async delete(ref, context) {
      await authorize(options.authorize, 'delete', ref, context)
      try {
        await bucket.delete(keyFor(prefix, ref))
      } catch {
        throw new R2StorageError('provider_error', 'R2 object delete failed')
      }
    },

    async createReadUrl(ref, expiresInSeconds, context) {
      await authorize(options.authorize, 'createReadUrl', ref, context)
      if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > maxUrlSeconds) {
        throw new R2StorageError('invalid_configuration', 'Read URL expiry is outside the allowed range')
      }
      try {
        return await options.readUrl(keyFor(prefix, ref), expiresInSeconds)
      } catch {
        throw new R2StorageError('provider_error', 'R2 read URL creation failed')
      }
    },
  }
}

async function authorize(
  policy: R2AuthorizationPolicy | undefined,
  operation: R2AuthorizationOperation,
  ref: R2ObjectRef,
  context: R2AuthorizationContext | undefined,
): Promise<void> {
  if (!context || typeof context.actorId !== 'string' || context.actorId.trim() === '') {
    throw new R2StorageError('authorization_required', 'A server-side actor/workspace context is required')
  }
  if (typeof context.workspaceId !== 'string' || context.workspaceId !== ref.workspaceId) {
    throw new R2StorageError('authorization_denied', 'Actor context is not authorized for this workspace')
  }

  if (policy) {
    let allowed = false
    try {
      allowed = await policy({ operation, ref, context })
    } catch {
      allowed = false
    }
    if (!allowed) throw new R2StorageError('authorization_denied', 'R2 operation is not authorized')
  }
}

function keyFor(prefix: string, ref: R2ObjectRef): string {
  if (!SAFE_SEGMENT_PATTERN.test(ref.workspaceId) || !SAFE_SEGMENT_PATTERN.test(ref.objectId)) {
    throw new R2StorageError('invalid_reference', 'Object reference contains an invalid segment')
  }
  return `${prefix}/workspace/${ref.workspaceId}/object/${ref.objectId}`
}

function validateOptions(options: R2StoreOptions): void {
  if (typeof options.authorize !== 'function') {
    throw new R2StorageError('authorization_required', 'A server-side authorization policy is required')
  }
  if (!options.bucketName || !Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1) {
    throw new R2StorageError('invalid_configuration', 'R2 bucket and positive byte limit are required')
  }
  if (options.allowedContentTypes.length === 0) {
    throw new R2StorageError('invalid_configuration', 'At least one content type is required')
  }
  if (options.maxReadUrlSeconds !== undefined && (!Number.isInteger(options.maxReadUrlSeconds) || options.maxReadUrlSeconds < 1)) {
    throw new R2StorageError('invalid_configuration', 'Read URL expiry limit must be positive')
  }
}

function normalizePrefix(value: string): string {
  const prefix = value.replace(/^\/+|\/+$/g, '')
  if (!prefix || prefix.split('/').some((segment) => !SAFE_SEGMENT_PATTERN.test(segment))) {
    throw new R2StorageError('invalid_configuration', 'R2 key prefix contains an invalid segment')
  }
  return prefix
}

function normalizeContentType(value: string): string {
  return value.split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
