import type {
  ContentVariant,
  ContentVariantInput,
  SocialPlatform,
  VariantRepository,
} from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { ContentVariantInsert, Database, Json } from '../types'

export const CONTENT_VARIANT_CONFLICT = 'content_item_id,platform'

export type StoredContentVariantRow = {
  id: string
  workspace_id: string
  content_item_id: string
  platform: string
  title: string | null
  caption: string | null
  hashtags: string[]
  metadata: Json
  created_at: string
  updated_at: string
}

export type ContentVariantStore = {
  getWorkspaceId(contentItemId: string): Promise<string | null>
  upsert(
    rows: ContentVariantInsert[],
    onConflict: string,
  ): Promise<StoredContentVariantRow[]>
  list(contentItemId: string): Promise<StoredContentVariantRow[]>
}

export class ContentVariantRepositoryError extends Error {
  readonly code = 'content_not_found' as const

  constructor(contentItemId: string) {
    super(`Content item ${contentItemId} was not found`)
    this.name = 'ContentVariantRepositoryError'
  }
}

export function createVariantRepository(store: ContentVariantStore): VariantRepository {
  return {
    async saveVariants(contentItemId, variants) {
      const workspaceId = await requireWorkspaceId(store, contentItemId)
      const rows = variants.map((variant) => toInsert(workspaceId, contentItemId, variant))
      return mapRows(await store.upsert(rows, CONTENT_VARIANT_CONFLICT))
    },

    async updateVariant(contentItemId, variant) {
      const workspaceId = await requireWorkspaceId(store, contentItemId)
      const rows = await store.upsert(
        [toInsert(workspaceId, contentItemId, variant)],
        CONTENT_VARIANT_CONFLICT,
      )
      const updated = rows[0]
      if (!updated) throw new Error('Failed to persist content variant')
      return mapRow(updated)
    },

    async listVariants(contentItemId) {
      return mapRows(await store.list(contentItemId))
    },
  }
}

export function createSupabaseContentVariantStore(
  client: SupabaseClient<Database>,
): ContentVariantStore {
  return {
    async getWorkspaceId(contentItemId) {
      const { data, error } = await client
        .from('content_items')
        .select('workspace_id')
        .eq('id', contentItemId)
        .maybeSingle()

      if (error) throw new Error('Failed to resolve content workspace')
      return data?.workspace_id ?? null
    },

    async upsert(rows, onConflict) {
      const { data, error } = await client
        .from('content_variants')
        .upsert(rows, { onConflict })
        .select('*')

      if (error) throw new Error('Failed to persist content variants')
      return data ?? []
    },

    async list(contentItemId) {
      const { data, error } = await client
        .from('content_variants')
        .select('*')
        .eq('content_item_id', contentItemId)
        .order('platform', { ascending: true })

      if (error) throw new Error('Failed to list content variants')
      return data ?? []
    },
  }
}

async function requireWorkspaceId(
  store: ContentVariantStore,
  contentItemId: string,
): Promise<string> {
  const workspaceId = await store.getWorkspaceId(contentItemId)
  if (!workspaceId) throw new ContentVariantRepositoryError(contentItemId)
  return workspaceId
}

function toInsert(
  workspaceId: string,
  contentItemId: string,
  variant: ContentVariantInput,
): ContentVariantInsert {
  return {
    workspace_id: workspaceId,
    content_item_id: contentItemId,
    platform: variant.platform,
    title: variant.title,
    caption: variant.caption,
    hashtags: variant.hashtags,
    metadata: toJson(variant.metadata),
  }
}

function mapRows(rows: StoredContentVariantRow[]): ContentVariant[] {
  return rows.map(mapRow)
}

function mapRow(row: StoredContentVariantRow): ContentVariant {
  return {
    id: row.id,
    contentItemId: row.content_item_id,
    platform: row.platform as SocialPlatform,
    title: row.title,
    caption: row.caption ?? '',
    hashtags: row.hashtags,
    metadata: toRecord(row.metadata),
  }
}

function toJson(value: Record<string, unknown>): Json {
  try {
    return JSON.parse(JSON.stringify(value)) as Json
  } catch {
    throw new Error('Content variant metadata must be JSON serializable')
  }
}

function toRecord(value: Json): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}
