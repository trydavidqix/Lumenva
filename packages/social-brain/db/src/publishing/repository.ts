import type {
  EnsurePublishJobInput,
  EnsuredPublicationJob,
  PublicationJobRecord,
  PublicationJobStatus,
  PublicationRepository,
  PublicationTarget,
  SocialPlatform,
} from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, PublishJobInsert } from '../types'

export type PublicationVariantRow = {
  id: string
  platform: string
}

export type PublicationAccountRow = {
  id: string
  platform: string
}

export type StoredPublishJobRow = {
  id: string
  workspace_id: string
  content_item_id: string
  content_variant_id: string
  social_account_id: string
  approval_id: string
  platform: string
  publish_mode: string
  scheduled_for: string | null
  status: string
  idempotency_key: string
}

export type InsertPublishJobResult = {
  row: StoredPublishJobRow
  created: boolean
}

export type PublicationStore = {
  listVariants(contentItemId: string): Promise<PublicationVariantRow[]>
  listAccounts(ids: string[]): Promise<PublicationAccountRow[]>
  getByIdempotencyKey(key: string): Promise<StoredPublishJobRow | null>
  insert(input: PublishJobInsert): Promise<InsertPublishJobResult>
  setContentStatus(
    contentItemId: string,
    status: string,
    expectedStatus?: string,
  ): Promise<boolean>
  getContentStatus(contentItemId: string): Promise<string | null>
  getById(id: string): Promise<StoredPublishJobRow | null>
  markForRetry(id: string): Promise<StoredPublishJobRow | null>
}

export function createPublicationRepository(store: PublicationStore): PublicationRepository {
  return {
    async listPublicationTargets(contentItemId, targetAccountIds) {
      const [variants, accounts] = await Promise.all([
        store.listVariants(contentItemId),
        store.listAccounts(targetAccountIds),
      ])

      const accountByPlatform = new Map<string, string>()
      const duplicatePlatforms = new Set<string>()
      for (const account of accounts) {
        if (accountByPlatform.has(account.platform)) duplicatePlatforms.add(account.platform)
        accountByPlatform.set(account.platform, account.id)
      }

      if (duplicatePlatforms.size > 0) return []

      return variants.flatMap((variant): PublicationTarget[] => {
        const socialAccountId = accountByPlatform.get(variant.platform)
        if (!socialAccountId) return []
        return [{
          contentVariantId: variant.id,
          platform: variant.platform as SocialPlatform,
          socialAccountId,
        }]
      })
    },

    async ensurePublishJob(input): Promise<EnsuredPublicationJob> {
      const existing = await store.getByIdempotencyKey(input.idempotencyKey)
      if (existing) {
        return { job: mapPublishJob(existing), created: false }
      }

      const inserted = await store.insert(toInsert(input))
      return {
        job: mapPublishJob(inserted.row),
        created: inserted.created,
      }
    },

    async markContentPublicationState(contentItemId, mode) {
      const targetStatus = mode === 'schedule' ? 'SCHEDULED' : 'PUBLISHING'
      const updated = await store.setContentStatus(contentItemId, targetStatus, 'APPROVED')
      if (updated) return

      const currentStatus = await store.getContentStatus(contentItemId)
      const allowed = mode === 'schedule'
        ? new Set(['SCHEDULED', 'PUBLISHING', 'RETRYING', 'FAILED', 'PUBLISHED'])
        : new Set(['PUBLISHING', 'RETRYING', 'FAILED', 'PUBLISHED'])

      if (!currentStatus || !allowed.has(currentStatus)) {
        throw new Error('Approved content state changed before publication jobs were queued')
      }
    },

    async getPublishJob(id) {
      const row = await store.getById(id)
      return row ? mapPublishJob(row) : null
    },

    async markForRetry(id) {
      const row = await store.markForRetry(id)
      if (!row) throw new Error('Publish job not found during retry')
      await store.setContentStatus(row.content_item_id, 'RETRYING')
      return mapPublishJob(row)
    },
  }
}

const PUBLISH_JOB_COLUMNS = `
  id,
  workspace_id,
  content_item_id,
  content_variant_id,
  social_account_id,
  approval_id,
  platform,
  publish_mode,
  scheduled_for,
  status,
  idempotency_key
`

export function createSupabasePublicationStore(
  client: SupabaseClient<Database>,
): PublicationStore {
  return {
    async listVariants(contentItemId) {
      const { data, error } = await client
        .from('content_variants')
        .select('id,platform')
        .eq('content_item_id', contentItemId)
        .order('platform', { ascending: true })

      if (error) throw new Error('Failed to load publication variants')
      return data ?? []
    },

    async listAccounts(ids) {
      if (ids.length === 0) return []
      const { data, error } = await client
        .from('social_accounts')
        .select('id,platform')
        .in('id', ids)
        .order('platform', { ascending: true })

      if (error) throw new Error('Failed to load publication accounts')
      return data ?? []
    },

    async getByIdempotencyKey(key) {
      const { data, error } = await client
        .from('publish_jobs')
        .select(PUBLISH_JOB_COLUMNS)
        .eq('idempotency_key', key)
        .maybeSingle()

      if (error) throw new Error('Failed to load idempotent publish job')
      return data
    },

    async insert(input) {
      const { data, error } = await client
        .from('publish_jobs')
        .upsert(input, { onConflict: 'idempotency_key', ignoreDuplicates: true })
        .select(PUBLISH_JOB_COLUMNS)
        .maybeSingle()

      if (error) throw new Error('Failed to create publish job')
      if (data) {
        return { row: data, created: true }
      }

      const { data: existing, error: existingError } = await client
        .from('publish_jobs')
        .select(PUBLISH_JOB_COLUMNS)
        .eq('idempotency_key', input.idempotency_key)
        .maybeSingle()

      if (existingError || !existing) throw new Error('Failed to resolve idempotent publish job')
      return { row: existing, created: false }
    },

    async setContentStatus(contentItemId, status, expectedStatus) {
      let query = client
        .from('content_items')
        .update({ status })
        .eq('id', contentItemId)

      if (expectedStatus !== undefined) query = query.eq('status', expectedStatus)

      const { data, error } = await query
        .select('id')
        .maybeSingle()

      if (error) throw new Error('Failed to update content publication state')
      return Boolean(data)
    },

    async getContentStatus(contentItemId) {
      const { data, error } = await client
        .from('content_items')
        .select('status')
        .eq('id', contentItemId)
        .maybeSingle()

      if (error) throw new Error('Failed to load content publication state')
      return data?.status ?? null
    },

    async getById(id) {
      const { data, error } = await client
        .from('publish_jobs')
        .select(PUBLISH_JOB_COLUMNS)
        .eq('id', id)
        .maybeSingle()

      if (error) throw new Error('Failed to load publish job')
      return data
    },

    async markForRetry(id) {
      const { data, error } = await client
        .from('publish_jobs')
        .update({
          status: 'retrying',
          last_error_code: null,
          last_error_message: null,
        })
        .eq('id', id)
        .eq('status', 'failed')
        .select(PUBLISH_JOB_COLUMNS)
        .maybeSingle()

      if (error) throw new Error('Failed to mark publish job for retry')
      return data
    },
  }
}

function toInsert(input: EnsurePublishJobInput): PublishJobInsert {
  return {
    workspace_id: input.workspaceId,
    content_item_id: input.contentItemId,
    content_variant_id: input.contentVariantId,
    social_account_id: input.socialAccountId,
    approval_id: input.approvalId,
    platform: input.platform,
    publish_mode: input.publishMode,
    scheduled_for: input.scheduledFor,
    status: 'queued',
    idempotency_key: input.idempotencyKey,
  }
}

function mapPublishJob(row: StoredPublishJobRow): PublicationJobRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentItemId: row.content_item_id,
    contentVariantId: row.content_variant_id,
    socialAccountId: row.social_account_id,
    approvalId: row.approval_id,
    platform: row.platform as SocialPlatform,
    publishMode: row.publish_mode as PublicationJobRecord['publishMode'],
    scheduledFor: row.scheduled_for,
    status: row.status as PublicationJobStatus,
    idempotencyKey: row.idempotency_key,
  }
}
