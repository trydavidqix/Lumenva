import {
  VideoBriefSchema,
  type ContentItem,
  type ContentRepository as CoreContentRepository,
  type ContentStatus,
  type CreateContentItemInput,
  type UpdateContentItemInput,
  type VideoBrief,
} from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { ContentItemInsert, Database, Json } from '../types'

export type StoredContentItemRow = {
  id: string
  workspace_id: string
  topic: string
  objective: string | null
  hook: string | null
  script: string | null
  video_brief: Json | null
  status: string
  created_at: string
}

export type ContentItemStore = {
  insert(input: ContentItemInsert): Promise<StoredContentItemRow>
  update(id: string, patch: Partial<ContentItemInsert>): Promise<StoredContentItemRow>
  get(id: string): Promise<StoredContentItemRow | null>
}

export type ContentRepository = CoreContentRepository

export function createContentRepository(store: ContentItemStore): ContentRepository {
  return {
    async createContentItem(input) {
      const row = await store.insert(toInsert(input))
      return mapContentItem(row)
    },

    async updateContentItem(id, input) {
      const row = await store.update(id, toPlanPatch(input))
      return mapContentItem(row)
    },

    async getContentItem(id) {
      const row = await store.get(id)
      return row ? mapContentItem(row) : null
    },
  }
}

export function createSupabaseContentItemStore(
  client: SupabaseClient<Database>,
): ContentItemStore {
  return {
    async insert(input) {
      const { data, error } = await client
        .from('content_items')
        .insert(input)
        .select('*')
        .single()

      if (error || !data) throw new Error('Failed to create content item')
      return data
    },

    async update(id, patch) {
      const { data, error } = await client
        .from('content_items')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single()

      if (error || !data) throw new Error('Failed to update content item')
      return data
    },

    async get(id) {
      const { data, error } = await client
        .from('content_items')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw new Error('Failed to load content item')
      return data
    },
  }
}

function toInsert(input: CreateContentItemInput): ContentItemInsert {
  return {
    workspace_id: input.workspaceId,
    objective: input.objective,
    topic: input.topic,
    hook: input.hook,
    script: input.script,
    video_brief: input.videoBrief,
    status: input.status,
  }
}

function toPlanPatch(input: UpdateContentItemInput): Partial<ContentItemInsert> {
  return {
    objective: input.objective,
    topic: input.topic,
    hook: input.hook,
    script: input.script,
    video_brief: input.videoBrief,
  }
}

function mapContentItem(row: StoredContentItemRow): ContentItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    topic: row.topic,
    objective: row.objective ?? '',
    hook: row.hook ?? '',
    script: row.script ?? '',
    videoBrief: parseVideoBrief(row.video_brief),
    status: row.status as ContentStatus,
    createdAt: row.created_at,
  }
}

function parseVideoBrief(value: Json | null): VideoBrief | null {
  const parsed = VideoBriefSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}
