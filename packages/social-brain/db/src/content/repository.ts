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

import { db } from '../client/drizzle'
import { contentItems } from '../schema/content-items'
import { eq } from 'drizzle-orm'

export function createDrizzleContentItemStore(): ContentItemStore {
  return {
    async insert(input) {
      const rows = await db
        .insert(contentItems)
        .values({
          workspaceId: input.workspace_id,
          topic: input.topic,
          objective: input.objective,
          hook: input.hook,
          script: input.script,
          videoBrief: input.video_brief,
          status: input.status ?? 'DRAFT',
          proposedPublishMode: input.proposed_publish_mode,
          proposedScheduledFor: input.proposed_scheduled_for,
          scheduleRationale: input.schedule_rationale,
          reviewSnapshotJson: input.review_snapshot_json,
          reviewSnapshotHash: input.review_snapshot_hash,
          createdAt: input.created_at ? new Date(input.created_at) : new Date(),
          updatedAt: input.updated_at ? new Date(input.updated_at) : new Date(),
        })
        .returning()
      
      const r = rows[0]
      if (!r) throw new Error('Failed to create content item')
      return {
        ...r,
        workspace_id: r.workspaceId,
        video_brief: r.videoBrief as Json | null,
        created_at: r.createdAt.toISOString(),
      }
    },

    async update(id, patch) {
      const rows = await db
        .update(contentItems)
        .set({
          objective: patch.objective,
          topic: patch.topic,
          hook: patch.hook,
          script: patch.script,
          videoBrief: patch.video_brief,
          status: patch.status,
          proposedPublishMode: patch.proposed_publish_mode,
          proposedScheduledFor: patch.proposed_scheduled_for,
          scheduleRationale: patch.schedule_rationale,
          reviewSnapshotJson: patch.review_snapshot_json,
          reviewSnapshotHash: patch.review_snapshot_hash,
          updatedAt: patch.updated_at ? new Date(patch.updated_at) : new Date(),
        })
        .where(eq(contentItems.id, id))
        .returning()

      const r = rows[0]
      if (!r) throw new Error('Failed to update content item')
      return {
        ...r,
        workspace_id: r.workspaceId,
        video_brief: r.videoBrief as Json | null,
        created_at: r.createdAt.toISOString(),
      }
    },

    async get(id) {
      const rows = await db
        .select()
        .from(contentItems)
        .where(eq(contentItems.id, id))
        .limit(1)

      const r = rows[0]
      if (!r) return null
      return {
        ...r,
        workspace_id: r.workspaceId,
        video_brief: r.videoBrief as Json | null,
        created_at: r.createdAt.toISOString(),
      }
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
