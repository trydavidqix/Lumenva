import type { ReviewSnapshot, SocialPlatform } from '@lumenva/core'

import { createSupabaseServerClient } from '../supabase/server'

export type ApprovalQueueItem = {
  id: string
  topic: string
  status: string
  proposedPublishMode: 'now' | 'schedule' | null
  proposedScheduledFor: string | null
}

export type ReviewMedia = {
  id: string
  mimeType: string | null
  signedUrl: string | null
}

export type ReviewAccount = {
  id: string
  platform: SocialPlatform
  displayName: string | null
}

export type ApprovalReviewData = {
  id: string
  topic: string
  status: string
  scheduleRationale: string | null
  snapshot: ReviewSnapshot
  media: ReviewMedia[]
  accounts: ReviewAccount[]
}

export async function listApprovalQueue(workspaceId: string): Promise<ApprovalQueueItem[]> {
  const supabase = await createSupabaseServerClient()
  const client = supabase as any
  const { data, error } = await client
    .from('content_items')
    .select('id,topic,status,proposed_publish_mode,proposed_scheduled_for')
    .eq('workspace_id', workspaceId)
    .eq('status', 'PENDING_APPROVAL')
    .order('updated_at', { ascending: false })

  if (error) throw new Error('Failed to load approval queue')

  return (data ?? []).map((row: any) => ({
    id: row.id,
    topic: row.topic,
    status: row.status,
    proposedPublishMode:
      row.proposed_publish_mode === 'now' || row.proposed_publish_mode === 'schedule'
        ? row.proposed_publish_mode
        : null,
    proposedScheduledFor: row.proposed_scheduled_for,
  }))
}

export async function loadApprovalReview(
  workspaceId: string,
  contentItemId: string,
): Promise<ApprovalReviewData | null> {
  const supabase = await createSupabaseServerClient()
  const client = supabase as any

  const { data: content, error: contentError } = await client
    .from('content_items')
    .select(
      'id,workspace_id,topic,status,schedule_rationale,review_snapshot_json,review_snapshot_hash',
    )
    .eq('id', contentItemId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (contentError) throw new Error('Failed to load approval review')
  if (!content?.review_snapshot_json || !content.review_snapshot_hash) return null

  const snapshot = parseReviewSnapshot(content.review_snapshot_json)
  if (!snapshot || snapshot.contentId !== content.id) return null

  const [media, accounts] = await Promise.all([
    loadMedia(client, snapshot.mediaAssetIds),
    loadAccounts(client, workspaceId, snapshot.targetAccountIds),
  ])

  return {
    id: content.id,
    topic: content.topic,
    status: content.status,
    scheduleRationale: content.schedule_rationale,
    snapshot,
    media,
    accounts,
  }
}

async function loadMedia(client: any, ids: string[]): Promise<ReviewMedia[]> {
  if (ids.length === 0) return []

  const { data, error } = await client
    .from('media_assets')
    .select('id,storage_bucket,storage_path,mime_type')
    .in('id', ids)

  if (error) throw new Error('Failed to load approval media')

  const byId = new Map((data ?? []).map((row: any) => [row.id, row]))
  return Promise.all(
    ids.map(async (id) => {
      const row = byId.get(id) as any
      if (!row?.storage_bucket || !row.storage_path) {
        return { id, mimeType: row?.mime_type ?? null, signedUrl: null }
      }

      const { data: signed, error: signedError } = await client.storage
        .from(row.storage_bucket)
        .createSignedUrl(row.storage_path, 600)

      return {
        id,
        mimeType: row.mime_type ?? null,
        signedUrl: signedError ? null : signed?.signedUrl ?? null,
      }
    }),
  )
}

async function loadAccounts(
  client: any,
  workspaceId: string,
  ids: string[],
): Promise<ReviewAccount[]> {
  if (ids.length === 0) return []

  const { data, error } = await client
    .from('social_accounts')
    .select('id,platform,display_name')
    .eq('workspace_id', workspaceId)
    .in('id', ids)

  if (error) throw new Error('Failed to load approval accounts')

  const byId = new Map((data ?? []).map((row: any) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id) as any
    if (!row) return []
    return [
      {
        id,
        platform: row.platform as SocialPlatform,
        displayName: row.display_name ?? null,
      },
    ]
  })
}

function parseReviewSnapshot(value: unknown): ReviewSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>

  if (
    typeof candidate.contentId !== 'string' ||
    typeof candidate.script !== 'string' ||
    !Array.isArray(candidate.mediaAssetIds) ||
    !Array.isArray(candidate.variants) ||
    !Array.isArray(candidate.targetAccountIds) ||
    (candidate.publishMode !== 'now' && candidate.publishMode !== 'schedule')
  ) {
    return null
  }

  return JSON.parse(JSON.stringify(value)) as ReviewSnapshot
}
