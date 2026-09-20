import type {
  ApprovalDecisionRecord,
  ApprovalRepository,
  ApprovalSnapshotSource,
  FinalizeApprovalDecisionInput,
  PendingApproval,
  ReviewSnapshot,
  SocialPlatform,
} from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, Json } from '../types'

const SUPPORTED_PLATFORMS: readonly SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
]

export type ApprovalContentRow = {
  id: string
  workspace_id: string
  status: string
  script: string | null
  proposed_publish_mode: string | null
  proposed_scheduled_for: string | null
  review_snapshot_json: Json | null
  review_snapshot_hash: string | null
}

export type ApprovalContentPatch = {
  review_snapshot_json?: Json | null
  review_snapshot_hash?: string | null
  status?: string
}

export type ApprovalVariantRow = {
  platform: string
  caption: string | null
  title: string | null
  hashtags: string[]
}

export type ApprovalAccountRow = {
  id: string
  platform: string
}

export type ApprovalStoredDecisionRow = {
  id: string
  workspace_id: string
  content_item_id: string
  decision: string
  reason: string | null
  review_snapshot_json: Json
  snapshot_hash: string
  publish_mode: string
  decided_by: string
  decided_at: string
}

export type ApprovalStore = {
  getContent(contentItemId: string): Promise<ApprovalContentRow | null>
  listReadyMedia(contentItemId: string): Promise<Array<{ id: string }>>
  listVariants(contentItemId: string): Promise<ApprovalVariantRow[]>
  listActiveAccounts(workspaceId: string): Promise<ApprovalAccountRow[]>
  savePending(contentItemId: string, patch: ApprovalContentPatch): Promise<void>
  finalizeDecision(input: FinalizeApprovalDecisionInput): Promise<ApprovalStoredDecisionRow>
  getLatestApproved(contentItemId: string): Promise<ApprovalStoredDecisionRow | null>
  isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean>
}

export function createApprovalRepository(store: ApprovalStore): ApprovalRepository {
  return {
    async loadSnapshotSource(contentItemId) {
      const content = await store.getContent(contentItemId)
      if (!content) return null

      const [media, variants, accounts] = await Promise.all([
        store.listReadyMedia(contentItemId),
        store.listVariants(contentItemId),
        store.listActiveAccounts(content.workspace_id),
      ])

      return {
        workspaceId: content.workspace_id,
        contentId: content.id,
        status: content.status as ApprovalSnapshotSource['status'],
        script: content.script ?? '',
        mediaAssetIds: media.map((asset) => asset.id),
        variants: variants.map((variant) => ({
          platform: variant.platform as SocialPlatform,
          caption: variant.caption ?? '',
          title: variant.title,
          hashtags: [...variant.hashtags],
        })),
        targetAccountIds: resolveDestinationAccounts(accounts),
        proposedPublishMode:
          content.proposed_publish_mode === 'schedule' || content.proposed_publish_mode === 'now'
            ? content.proposed_publish_mode
            : null,
        proposedScheduledFor: content.proposed_scheduled_for,
      }
    },

    async savePendingApproval(input: PendingApproval) {
      await store.savePending(input.contentItemId, {
        review_snapshot_json: toJson(input.snapshot),
        review_snapshot_hash: input.snapshotHash,
        status: 'PENDING_APPROVAL',
      })
    },

    async loadPendingApproval(contentItemId) {
      const content = await store.getContent(contentItemId)
      if (!content?.review_snapshot_json || !content.review_snapshot_hash) return null

      const snapshot = parseSnapshot(content.review_snapshot_json)
      if (!snapshot) return null

      return {
        workspaceId: content.workspace_id,
        contentItemId: content.id,
        snapshot,
        snapshotHash: content.review_snapshot_hash,
      }
    },

    async finalizeDecision(input) {
      return mapDecision(await store.finalizeDecision(input))
    },

    async loadLatestApproved(contentItemId) {
      const row = await store.getLatestApproved(contentItemId)
      return row ? mapDecision(row) : null
    },

    isWorkspaceOwner(workspaceId, userId) {
      return store.isWorkspaceOwner(workspaceId, userId)
    },
  }
}

export function createSupabaseApprovalStore(
  client: SupabaseClient<Database>,
): ApprovalStore {
  const approvalClient = client as unknown as SupabaseClient<any>

  return {
    async getContent(contentItemId) {
      const { data, error } = await approvalClient
        .from('content_items')
        .select(
          'id,workspace_id,status,script,proposed_publish_mode,proposed_scheduled_for,review_snapshot_json,review_snapshot_hash',
        )
        .eq('id', contentItemId)
        .maybeSingle()

      if (error) throw new Error('Failed to load approval content')
      return data as ApprovalContentRow | null
    },

    async listReadyMedia(contentItemId) {
      const { data, error } = await approvalClient
        .from('media_assets')
        .select('id')
        .eq('content_item_id', contentItemId)
        .eq('status', 'ready')
        .not('storage_path', 'is', null)
        .order('created_at', { ascending: true })

      if (error) throw new Error('Failed to load approval media')
      return (data ?? []) as Array<{ id: string }>
    },

    async listVariants(contentItemId) {
      const { data, error } = await approvalClient
        .from('content_variants')
        .select('platform,caption,title,hashtags')
        .eq('content_item_id', contentItemId)
        .order('platform', { ascending: true })

      if (error) throw new Error('Failed to load approval variants')
      return (data ?? []) as ApprovalVariantRow[]
    },

    async listActiveAccounts(workspaceId) {
      const { data, error } = await approvalClient
        .from('social_accounts')
        .select('id,platform')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .order('platform', { ascending: true })

      if (error) throw new Error('Failed to load approval destination accounts')
      return (data ?? []) as ApprovalAccountRow[]
    },

    async savePending(contentItemId, patch) {
      const { error } = await approvalClient
        .from('content_items')
        .update(patch)
        .eq('id', contentItemId)

      if (error) throw new Error('Failed to save pending approval')
    },

    async finalizeDecision(input) {
      const { data, error } = await approvalClient.rpc('finalize_content_decision', {
        p_content_item_id: input.contentItemId,
        p_decision: input.decision,
        p_reason: input.reason,
        p_review_snapshot_json: toJson(input.snapshot),
        p_snapshot_hash: input.snapshotHash,
        p_publish_mode: input.publishMode,
        p_decided_by: input.decidedBy,
      })

      if (error || !data) throw new Error('Failed to finalize approval decision')
      return data as ApprovalStoredDecisionRow
    },

    async getLatestApproved(contentItemId) {
      const { data, error } = await approvalClient
        .from('approvals')
        .select('*')
        .eq('content_item_id', contentItemId)
        .eq('decision', 'approved')
        .order('decided_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw new Error('Failed to load latest approval')
      return data as ApprovalStoredDecisionRow | null
    },

    async isWorkspaceOwner(workspaceId, userId) {
      const { data, error } = await approvalClient
        .from('workspaces')
        .select('owner_user_id')
        .eq('id', workspaceId)
        .maybeSingle()

      if (error) throw new Error('Failed to verify workspace owner')
      return data?.owner_user_id === userId
    },
  }
}

function resolveDestinationAccounts(accounts: ApprovalAccountRow[]): string[] {
  return SUPPORTED_PLATFORMS.map((platform) => {
    const matches = accounts.filter((account) => account.platform === platform)
    if (matches.length !== 1) {
      throw new Error('Destination accounts are not uniquely resolvable')
    }
    return matches[0]!.id
  })
}

function mapDecision(row: ApprovalStoredDecisionRow): ApprovalDecisionRecord {
  const snapshot = parseSnapshot(row.review_snapshot_json)
  if (!snapshot) throw new Error('Stored approval snapshot is invalid')

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    contentItemId: row.content_item_id,
    decision: row.decision as ApprovalDecisionRecord['decision'],
    reason: row.reason,
    snapshot,
    snapshotHash: row.snapshot_hash,
    publishMode: row.publish_mode as ApprovalDecisionRecord['publishMode'],
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
  }
}

function parseSnapshot(value: Json): ReviewSnapshot | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.contentId !== 'string' ||
    typeof candidate.script !== 'string' ||
    !Array.isArray(candidate.mediaAssetIds) ||
    !Array.isArray(candidate.variants) ||
    !Array.isArray(candidate.targetAccountIds) ||
    (candidate.publishMode !== 'schedule' && candidate.publishMode !== 'now')
  ) {
    return null
  }
  return JSON.parse(JSON.stringify(value)) as ReviewSnapshot
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}
