import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types'

export type StorageProvider = 'supabase' | 'r2' | 'gcs'

export type StorageLocator = {
  provider: StorageProvider
  bucket: string
  key: string
}

export type StoredObjectMetadata = {
  contentType: string | null
  sizeBytes: number | null
  sha256: string | null
}

export type ObjectStore = {
  put(locator: StorageLocator, bytes: Uint8Array, contentType: string): Promise<void>
  get(locator: StorageLocator): Promise<Uint8Array>
  head(locator: StorageLocator): Promise<StoredObjectMetadata | null>
  delete(locator: StorageLocator): Promise<void>
  createReadUrl(locator: StorageLocator, expiresInSeconds: number): Promise<string>
}

export function createSupabaseObjectStore(
  client: SupabaseClient<Database>,
): ObjectStore {
  function assertProvider(locator: StorageLocator): void {
    if (locator.provider !== 'supabase') {
      throw new Error('Supabase object store received a non-Supabase locator')
    }
  }

  return {
    async put(locator, bytes, contentType) {
      assertProvider(locator)
      const { error } = await client.storage.from(locator.bucket).upload(locator.key, bytes, {
        contentType,
        upsert: true,
      })
      if (error) throw new Error('Supabase object upload failed')
    },

    async get(locator) {
      assertProvider(locator)
      const { data, error } = await client.storage.from(locator.bucket).download(locator.key)
      if (error || !data) throw new Error('Supabase object download failed')
      return new Uint8Array(await data.arrayBuffer())
    },

    async head(locator) {
      assertProvider(locator)
      const separator = locator.key.lastIndexOf('/')
      const prefix = separator === -1 ? '' : locator.key.slice(0, separator)
      const name = separator === -1 ? locator.key : locator.key.slice(separator + 1)
      const { data, error } = await client.storage.from(locator.bucket).list(prefix, {
        limit: 1,
        search: name,
      })
      if (error) throw new Error('Supabase object metadata lookup failed')
      const object = data?.find((entry) => entry.name === name)
      if (!object) return null

      return {
        contentType:
          typeof object.metadata?.mimetype === 'string' ? object.metadata.mimetype : null,
        sizeBytes:
          typeof object.metadata?.size === 'number' ? object.metadata.size : null,
        sha256: null,
      }
    },

    async delete(locator) {
      assertProvider(locator)
      const { error } = await client.storage.from(locator.bucket).remove([locator.key])
      if (error) throw new Error('Supabase object delete failed')
    },

    async createReadUrl(locator, expiresInSeconds) {
      assertProvider(locator)
      const { data, error } = await client.storage
        .from(locator.bucket)
        .createSignedUrl(locator.key, expiresInSeconds)
      if (error || !data?.signedUrl) throw new Error('Supabase signed URL creation failed')
      return data.signedUrl
    },
  }
}
