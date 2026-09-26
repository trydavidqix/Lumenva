import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types'

export type MediaStorageErrorCode =
  | 'media_source_rejected'
  | 'media_download_failed'
  | 'media_type_rejected'
  | 'media_too_large'
  | 'media_upload_failed'
  | 'media_timeout'

export class MediaStorageError extends Error {
  readonly code: MediaStorageErrorCode
  readonly retryable: boolean

  constructor(code: MediaStorageErrorCode, message: string, retryable: boolean) {
    super(message)
    this.name = 'MediaStorageError'
    this.code = code
    this.retryable = retryable
  }
}

export type MediaObjectStore = {
  upload(bucket: string, path: string, bytes: Uint8Array, mimeType: string): Promise<void>
}

export type MediaStorageOptions = {
  bucket: string
  maxBytes: number
  allowedMimeTypes: readonly string[]
  allowedOrigins: readonly string[]
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export type ImportMediaInput = {
  workspaceId: string
  contentItemId: string
  assetId: string
  downloadUrl: string
}

export type ImportedMedia = {
  bucket: string
  path: string
  mimeType: string
  sizeBytes: number
}

export type MediaStorage = {
  importFromUrl(input: ImportMediaInput): Promise<ImportedMedia>
}

export function createMediaStorage(
  store: MediaObjectStore,
  options: MediaStorageOptions,
): MediaStorage {
  const allowedMimeTypes = new Set(options.allowedMimeTypes.map(normalizeMimeType))
  const allowedOrigins = new Set(options.allowedOrigins)
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 30_000

  return {
    async importFromUrl(input) {
      const source = validateSource(input.downloadUrl, allowedOrigins)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetchImpl(source.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new MediaStorageError(
            'media_download_failed',
            'Generated media download failed',
            response.status === 429 || response.status >= 500,
          )
        }

        const mimeType = normalizeMimeType(response.headers.get('content-type') ?? '')
        if (!mimeType || !allowedMimeTypes.has(mimeType)) {
          throw new MediaStorageError(
            'media_type_rejected',
            'Generated media type is not allowed',
            false,
          )
        }

        const declaredLength = parseContentLength(response.headers.get('content-length'))
        if (declaredLength !== null && declaredLength > options.maxBytes) {
          throw tooLargeError()
        }

        const bytes = await readBoundedBody(response, options.maxBytes)
        if (bytes.byteLength === 0) {
          throw new MediaStorageError(
            'media_download_failed',
            'Generated media response was empty',
            true,
          )
        }

        const path = `workspace/${input.workspaceId}/content/${input.contentItemId}/${input.assetId}`

        try {
          await store.upload(options.bucket, path, bytes, mimeType)
        } catch (error) {
          if (error instanceof MediaStorageError) throw error
          throw new MediaStorageError(
            'media_upload_failed',
            'Generated media could not be stored',
            true,
          )
        }

        return {
          bucket: options.bucket,
          path,
          mimeType,
          sizeBytes: bytes.byteLength,
        }
      } catch (error) {
        if (error instanceof MediaStorageError) throw error
        if (error instanceof Error && error.name === 'AbortError') {
          throw new MediaStorageError(
            'media_timeout',
            'Generated media download timed out',
            true,
          )
        }
        throw new MediaStorageError(
          'media_download_failed',
          'Generated media download failed',
          true,
        )
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

export function createSupabaseMediaObjectStore(
  client: SupabaseClient<Database>,
): MediaObjectStore {
  return {
    async upload(bucket, path, bytes, mimeType) {
      const { error } = await client.storage.from(bucket).upload(path, bytes, {
        contentType: mimeType,
        upsert: true,
      })
      if (error) throw new Error('Supabase media upload failed')
    },
  }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array()

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      total += value.byteLength
      if (total > maxBytes) {
        try {
          await reader.cancel('media size limit exceeded')
        } catch {
          // The size violation remains terminal even if stream cancellation itself fails.
        }
        throw tooLargeError()
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function tooLargeError(): MediaStorageError {
  return new MediaStorageError(
    'media_too_large',
    'Generated media exceeds the configured size limit',
    false,
  )
}

function validateSource(value: string, allowedOrigins: Set<string>): URL {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new MediaStorageError('media_source_rejected', 'Generated media source is invalid', false)
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new MediaStorageError('media_source_rejected', 'Generated media source is invalid', false)
  }
  if (!allowedOrigins.has(parsed.origin)) {
    throw new MediaStorageError(
      'media_source_rejected',
      'Generated media source is outside the configured provider origins',
      false,
    )
  }
  return parsed
}

function normalizeMimeType(value: string): string {
  return value.split(';', 1)[0]?.trim().toLowerCase() ?? ''
}

function parseContentLength(value: string | null): number | null {
  if (value === null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}
