import type {
  PublicationJobStatus,
  PublicationRef,
} from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '../types'

export type PublishExecutionContext = {
  id: string
  workspaceId: string
  contentItemId: string
  contentVariantId: string
  approvalId: string
  publishMode: 'schedule' | 'now'
  scheduledFor: string
  idempotencyKey: string
  status: PublicationJobStatus
  providerPublicationId: string | null
  providerAccountId: string
  caption: string
  title: string | null
}

export type ApprovedPublishMedia = {
  id: string
  filename: string
  mimeType: string
  storageBucket: string
  storagePath: string
  providerMediaAssetId: string | null
  providerMediaProcessingStatus: string | null
}

export type PublicationExecutionRepository = {
  loadContext(publishJobId: string): Promise<PublishExecutionContext | null>
  loadApprovedMedia(mediaAssetIds: string[]): Promise<ApprovedPublishMedia[]>
  savePreparedMedia(
    mediaAssetId: string,
    providerMediaAssetId: string,
    processingStatus: string,
  ): Promise<void>
  markPublishing(publishJobId: string): Promise<void>
  markResult(publishJobId: string, result: PublicationRef): Promise<void>
  markRetrying(publishJobId: string, code: string, message: string): Promise<void>
  markFailed(publishJobId: string, code: string, message: string): Promise<void>
  markReconcileRequired(publishJobId: string, code: string, message: string): Promise<void>
}

export type PublicationMediaSource = {
  download(bucket: string, path: string): Promise<Uint8Array>
}

export function createSupabasePublicationExecutionRepository(
  client: SupabaseClient<Database>,
): PublicationExecutionRepository {
  const db = client as unknown as SupabaseClient<any>

  return {
    async loadContext(publishJobId) {
      const { data: job, error: jobError } = await db
        .from('publish_jobs')
        .select(
          'id,workspace_id,content_item_id,content_variant_id,social_account_id,approval_id,publish_mode,scheduled_for,status,idempotency_key,brightbean_publication_id',
        )
        .eq('id', publishJobId)
        .maybeSingle()

      if (jobError) throw new Error('Failed to load publish execution job')
      if (!job) return null
      if (!job.scheduled_for) throw new Error('Publish job is missing provider execution time')

      const [{ data: variant, error: variantError }, { data: account, error: accountError }] = await Promise.all([
        db
          .from('content_variants')
          .select('id,workspace_id,caption,title')
          .eq('id', job.content_variant_id)
          .eq('workspace_id', job.workspace_id)
          .maybeSingle(),
        db
          .from('social_accounts')
          .select('id,workspace_id,brightbean_account_id')
          .eq('id', job.social_account_id)
          .eq('workspace_id', job.workspace_id)
          .maybeSingle(),
      ])

      if (variantError || accountError) throw new Error('Failed to load publish execution dependencies')
      if (!variant || !account) throw new Error('Publish execution dependencies are missing')

      return {
        id: job.id,
        workspaceId: job.workspace_id,
        contentItemId: job.content_item_id,
        contentVariantId: job.content_variant_id,
        approvalId: job.approval_id,
        publishMode: job.publish_mode as 'schedule' | 'now',
        scheduledFor: job.scheduled_for,
        idempotencyKey: job.idempotency_key,
        status: job.status as PublicationJobStatus,
        providerPublicationId: job.brightbean_publication_id,
        providerAccountId: account.brightbean_account_id,
        caption: variant.caption ?? '',
        title: variant.title,
      }
    },

    async loadApprovedMedia(mediaAssetIds) {
      if (mediaAssetIds.length === 0) return []

      const { data, error } = await db
        .from('media_assets')
        .select('id,storage_bucket,storage_path,mime_type,metadata')
        .in('id', mediaAssetIds)

      if (error) throw new Error('Failed to load approved publication media')
      const byId = new Map((data ?? []).map((row: any) => [row.id, row]))

      return mediaAssetIds.flatMap((id) => {
        const row = byId.get(id) as any
        if (!row?.storage_bucket || !row.storage_path || !row.mime_type) return []
        const mapping = readBrightBeanMedia(row.metadata)
        return [{
          id,
          filename: `${id}.${extensionForMime(row.mime_type)}`,
          mimeType: row.mime_type,
          storageBucket: row.storage_bucket,
          storagePath: row.storage_path,
          providerMediaAssetId: mapping.mediaAssetId,
          providerMediaProcessingStatus: mapping.processingStatus,
        }]
      })
    },

    async savePreparedMedia(mediaAssetId, providerMediaAssetId, processingStatus) {
      const { data: current, error: currentError } = await db
        .from('media_assets')
        .select('metadata')
        .eq('id', mediaAssetId)
        .maybeSingle()

      if (currentError || !current) throw new Error('Failed to load media metadata for provider mapping')
      const metadata = asObject(current.metadata)
      const next: Json = {
        ...metadata,
        brightbean: {
          mediaAssetId: providerMediaAssetId,
          processingStatus,
        },
      }

      const { error } = await db
        .from('media_assets')
        .update({ metadata: next })
        .eq('id', mediaAssetId)

      if (error) throw new Error('Failed to persist BrightBean media mapping')
    },

    async markPublishing(publishJobId) {
      const { data: current, error: currentError } = await db
        .from('publish_jobs')
        .select('attempt_count,status')
        .eq('id', publishJobId)
        .maybeSingle()

      if (currentError || !current) throw new Error('Failed to load publish job attempt state')

      const { data, error } = await db
        .from('publish_jobs')
        .update({
          status: 'publishing',
          attempt_count: Number(current.attempt_count ?? 0) + 1,
          last_error_code: null,
          last_error_message: null,
        })
        .eq('id', publishJobId)
        .in('status', ['queued', 'retrying'])
        .select('id')
        .maybeSingle()

      if (error || !data) throw new Error('Publish job could not enter publishing state')
    },

    async markResult(publishJobId, result) {
      const status = result.state === 'queued' ? 'scheduled' : result.state
      const { error } = await db
        .from('publish_jobs')
        .update({
          status,
          brightbean_publication_id: result.providerPublicationId,
          external_post_id: result.externalPostId,
          external_url: result.externalUrl,
          published_at: result.publishedAt,
          last_error_code: result.state === 'failed' ? 'publication_failed' : null,
          last_error_message: result.errorMessage,
        })
        .eq('id', publishJobId)

      if (error) throw new Error('Failed to persist publication result')
      await syncContentPublicationStatus(db, publishJobId)
    },

    async markRetrying(publishJobId, code, message) {
      await updateFailureState(db, publishJobId, 'retrying', code, message)
    },

    async markFailed(publishJobId, code, message) {
      await updateFailureState(db, publishJobId, 'failed', code, message)
    },

    async markReconcileRequired(publishJobId, code, message) {
      await updateFailureState(db, publishJobId, 'reconcile_required', code, message)
    },
  }
}

export function createSupabasePublicationMediaSource(
  client: SupabaseClient<Database>,
): PublicationMediaSource {
  return {
    async download(bucket, path) {
      const { data, error } = await client.storage.from(bucket).download(path)
      if (error || !data) throw new Error('Failed to download canonical publication media')
      return new Uint8Array(await data.arrayBuffer())
    },
  }
}

async function updateFailureState(
  db: SupabaseClient<any>,
  publishJobId: string,
  status: 'retrying' | 'failed' | 'reconcile_required',
  code: string,
  message: string,
): Promise<void> {
  const { error } = await db
    .from('publish_jobs')
    .update({
      status,
      last_error_code: code,
      last_error_message: message,
    })
    .eq('id', publishJobId)

  if (error) throw new Error('Failed to update publish job failure state')
  await syncContentPublicationStatus(db, publishJobId)
}

async function syncContentPublicationStatus(
  db: SupabaseClient<any>,
  publishJobId: string,
): Promise<void> {
  const { data: current, error: currentError } = await db
    .from('publish_jobs')
    .select('content_item_id,publish_mode')
    .eq('id', publishJobId)
    .maybeSingle()

  if (currentError || !current) throw new Error('Failed to resolve content publication state')

  const { data: jobs, error: jobsError } = await db
    .from('publish_jobs')
    .select('status')
    .eq('content_item_id', current.content_item_id)

  if (jobsError) throw new Error('Failed to load publication states')
  const statuses = (jobs ?? []).map((row: any) => String(row.status))
  if (statuses.length === 0) return

  const nextStatus = deriveContentPublicationStatus(statuses, current.publish_mode)
  const { error } = await db
    .from('content_items')
    .update({ status: nextStatus })
    .eq('id', current.content_item_id)

  if (error) throw new Error('Failed to synchronize content publication state')
}

export function deriveContentPublicationStatus(
  statuses: string[],
  publishMode: string,
): string {
  if (statuses.every((status) => status === 'published')) return 'PUBLISHED'

  const hasPublished = statuses.some((status) => status === 'published')
  const hasPublishing = statuses.some((status) => status === 'publishing')
  if (hasPublished || hasPublishing) return 'PUBLISHING'

  if (statuses.some((status) => ['retrying', 'unknown', 'reconcile_required'].includes(status))) {
    return 'RETRYING'
  }

  const active = statuses.some((status) => ['queued', 'publishing', 'retrying', 'unknown', 'reconcile_required'].includes(status))
  const failed = statuses.some((status) => status === 'failed')
  if (failed && !active) return 'FAILED'

  if (publishMode === 'schedule') return 'SCHEDULED'
  return 'PUBLISHING'
}

function readBrightBeanMedia(value: unknown): {
  mediaAssetId: string | null
  processingStatus: string | null
} {
  const metadata = asObject(value)
  const brightbean = asObject(metadata.brightbean)
  return {
    mediaAssetId: typeof brightbean.mediaAssetId === 'string' ? brightbean.mediaAssetId : null,
    processingStatus:
      typeof brightbean.processingStatus === 'string' ? brightbean.processingStatus : null,
  }
}

function asObject(value: unknown): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {}
}

function extensionForMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'video/webm':
      return 'webm'
    case 'video/quicktime':
      return 'mov'
    default:
      return 'mp4'
  }
}
