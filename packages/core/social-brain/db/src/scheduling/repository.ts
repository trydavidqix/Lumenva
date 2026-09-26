import type {
  ApprovalInvalidationOptions,
  SaveScheduleProposalInput,
  ScheduleRepository,
  SchedulingState,
} from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { ContentItemInsert, Database } from '../types'

export type ScheduleStateRow = {
  id: string
  status: string
}

export type ScheduleStore = {
  getState(contentItemId: string): Promise<ScheduleStateRow | null>
  update(contentItemId: string, patch: Partial<ContentItemInsert>): Promise<void>
}

export function createScheduleRepository(store: ScheduleStore): ScheduleRepository {
  return {
    async getSchedulingState(contentItemId): Promise<SchedulingState | null> {
      const row = await store.getState(contentItemId)
      if (!row) return null

      return {
        contentItemId: row.id,
        hasCurrentApproval: row.status === 'APPROVED',
      }
    },

    async saveScheduleProposal(
      input: SaveScheduleProposalInput,
      options: ApprovalInvalidationOptions,
    ) {
      await store.update(input.contentItemId, {
        proposed_publish_mode: input.publishMode,
        proposed_scheduled_for: input.proposedFor,
        schedule_rationale: input.rationale,
        ...(options.invalidateApproval ? { status: 'READY_FOR_REVIEW' } : {}),
      })
    },

    async clearScheduleProposal(
      contentItemId: string,
      options: ApprovalInvalidationOptions,
    ) {
      await store.update(contentItemId, {
        proposed_publish_mode: null,
        proposed_scheduled_for: null,
        schedule_rationale: null,
        ...(options.invalidateApproval ? { status: 'READY_FOR_REVIEW' } : {}),
      })
    },
  }
}

export function createSupabaseScheduleStore(
  client: SupabaseClient<Database>,
): ScheduleStore {
  return {
    async getState(contentItemId) {
      const { data, error } = await client
        .from('content_items')
        .select('id,status')
        .eq('id', contentItemId)
        .maybeSingle()

      if (error) throw new Error('Failed to load scheduling state')
      return data
    },

    async update(contentItemId, patch) {
      const { error } = await client
        .from('content_items')
        .update(patch)
        .eq('id', contentItemId)

      if (error) throw new Error('Failed to update scheduling state')
    },
  }
}
