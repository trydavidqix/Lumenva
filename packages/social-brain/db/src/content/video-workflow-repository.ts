import type { ContentItem, ContentStatus } from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../types'
import { createContentRepository, createSupabaseContentItemStore } from './repository'

export type VideoContentWorkflowStore = {
  getContentItem(id: string): Promise<ContentItem | null>
  updateStatus(id: string, status: ContentStatus): Promise<void>
}

export type VideoContentWorkflowRepository = {
  getContentItem(id: string): Promise<ContentItem | null>
  setStatus(id: string, status: ContentStatus): Promise<void>
}

export function createVideoContentWorkflowRepository(
  store: VideoContentWorkflowStore,
): VideoContentWorkflowRepository {
  return {
    getContentItem(id) {
      return store.getContentItem(id)
    },
    setStatus(id, status) {
      return store.updateStatus(id, status)
    },
  }
}

export function createSupabaseVideoContentWorkflowRepository(
  client: SupabaseClient<Database>,
): VideoContentWorkflowRepository {
  const content = createContentRepository(createSupabaseContentItemStore(client))

  return createVideoContentWorkflowRepository({
    getContentItem(id) {
      return content.getContentItem(id)
    },
    async updateStatus(id, status) {
      const { error } = await client
        .from('content_items')
        .update({ status })
        .eq('id', id)

      if (error) throw new Error('Failed to update content status')
    },
  })
}
