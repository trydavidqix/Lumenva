import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json, MediaAssetInsert } from '../types'

export type MediaAssetStatus = 'pending' | 'generating' | 'ready' | 'failed'

export type MediaAsset = {
  id: string
  workspaceId: string
  contentItemId: string | null
  provider: string
  providerAssetId: string | null
  storageBucket: string
  storagePath: string | null
  mimeType: string | null
  status: MediaAssetStatus
  metadata: Record<string, unknown>
}

export type CreateGeneratingMediaInput = {
  id: string
  workspaceId: string
  contentItemId: string
  provider: string
  providerAssetId: string
}

export type ReadyMediaPatch = {
  storageBucket: string
  storagePath: string
  mimeType: string
  metadata: Record<string, unknown>
}

export type MediaFailure = {
  code: string
  message: string
}

export type StoredMediaAssetRow = {
  id: string
  workspace_id: string
  content_item_id: string | null
  provider: string
  provider_asset_id: string | null
  storage_bucket: string
  storage_path: string | null
  mime_type: string | null
  status: string
  metadata: Json
  created_at: string
  updated_at: string
}

export type MediaAssetStore = {
  findLatest(contentItemId: string, provider: string): Promise<StoredMediaAssetRow | null>
  insert(input: MediaAssetInsert): Promise<StoredMediaAssetRow>
  update(id: string, patch: Partial<MediaAssetInsert>): Promise<StoredMediaAssetRow>
}

export type MediaRepository = {
  findForContent(contentItemId: string, provider: string): Promise<MediaAsset | null>
  createGenerating(input: CreateGeneratingMediaInput): Promise<MediaAsset>
  markReady(id: string, patch: ReadyMediaPatch): Promise<void>
  markFailed(id: string, failure: MediaFailure): Promise<void>
}

export function createMediaRepository(store: MediaAssetStore): MediaRepository {
  return {
    async findForContent(contentItemId, provider) {
      const row = await store.findLatest(contentItemId, provider)
      return row ? mapRow(row) : null
    },

    async createGenerating(input) {
      return mapRow(
        await store.insert({
          id: input.id,
          workspace_id: input.workspaceId,
          content_item_id: input.contentItemId,
          provider: input.provider,
          provider_asset_id: input.providerAssetId,
          storage_bucket: 'media',
          storage_path: null,
          mime_type: null,
          status: 'generating',
          metadata: {},
        }),
      )
    },

    async markReady(id, patch) {
      await store.update(id, {
        storage_bucket: patch.storageBucket,
        storage_path: patch.storagePath,
        mime_type: patch.mimeType,
        status: 'ready',
        metadata: toJson(patch.metadata),
      })
    },

    async markFailed(id, failure) {
      await store.update(id, {
        status: 'failed',
        metadata: {
          error: {
            code: failure.code,
            message: failure.message,
          },
        },
      })
    },
  }
}

export function createSupabaseMediaAssetStore(
  client: SupabaseClient<Database>,
): MediaAssetStore {
  return {
    async findLatest(contentItemId, provider) {
      const { data, error } = await client
        .from('media_assets')
        .select('*')
        .eq('content_item_id', contentItemId)
        .eq('provider', provider)
        .in('status', ['generating', 'ready'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw new Error('Failed to load media asset')
      return data
    },

    async insert(input) {
      const { data, error } = await client
        .from('media_assets')
        .insert(input)
        .select('*')
        .single()

      if (error || !data) throw new Error('Failed to create media asset')
      return data
    },

    async update(id, patch) {
      const { data, error } = await client
        .from('media_assets')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) throw new Error('Failed to update media asset')
      return data
    },
  }
}

function mapRow(row: StoredMediaAssetRow): MediaAsset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentItemId: row.content_item_id,
    provider: row.provider,
    providerAssetId: row.provider_asset_id,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    status: row.status as MediaAssetStatus,
    metadata: toRecord(row.metadata),
  }
}

function toJson(value: Record<string, unknown>): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

function toRecord(value: Json): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}
