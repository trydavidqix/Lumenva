export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type WorkspaceRow = {
  id: string
  owner_user_id: string
  name: string
  timezone: string
  created_at: string
  updated_at: string
}
export type WorkspaceInsert = {
  id?: string
  owner_user_id: string
  name?: string
  timezone?: string
  created_at?: string
  updated_at?: string
}

export type SocialAccountRow = {
  id: string
  workspace_id: string
  platform: string
  external_account_id: string | null
  brightbean_account_id: string
  display_name: string | null
  status: string
  metadata: Json
  created_at: string
  updated_at: string
}
export type SocialAccountInsert = {
  id?: string
  workspace_id: string
  platform: string
  external_account_id?: string | null
  brightbean_account_id: string
  display_name?: string | null
  status?: string
  metadata?: Json
  created_at?: string
  updated_at?: string
}

export type ContentItemRow = {
  id: string
  workspace_id: string
  topic: string
  objective: string | null
  hook: string | null
  script: string | null
  video_brief: Json | null
  status: string
  proposed_publish_mode: string | null
  proposed_scheduled_for: string | null
  schedule_rationale: string | null
  review_snapshot_json: Json | null
  review_snapshot_hash: string | null
  created_at: string
  updated_at: string
}
export type ContentItemInsert = {
  id?: string
  workspace_id: string
  topic: string
  objective?: string | null
  hook?: string | null
  script?: string | null
  video_brief?: Json | null
  status?: string
  proposed_publish_mode?: string | null
  proposed_scheduled_for?: string | null
  schedule_rationale?: string | null
  review_snapshot_json?: Json | null
  review_snapshot_hash?: string | null
  created_at?: string
  updated_at?: string
}

export type ContentVariantRow = {
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
export type ContentVariantInsert = {
  id?: string
  workspace_id: string
  content_item_id: string
  platform: string
  title?: string | null
  caption?: string | null
  hashtags?: string[]
  metadata?: Json
  created_at?: string
  updated_at?: string
}

export type MediaAssetRow = {
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
export type MediaAssetInsert = {
  id?: string
  workspace_id: string
  content_item_id?: string | null
  provider: string
  provider_asset_id?: string | null
  storage_bucket?: string
  storage_path?: string | null
  mime_type?: string | null
  status?: string
  metadata?: Json
  created_at?: string
  updated_at?: string
}

export type ApprovalRow = {
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
  created_at: string
}
export type ApprovalInsert = {
  id?: string
  workspace_id: string
  content_item_id: string
  decision: string
  reason?: string | null
  review_snapshot_json: Json
  snapshot_hash: string
  publish_mode: string
  decided_by: string
  decided_at?: string
  created_at?: string
}

export type PublishJobRow = {
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
  brightbean_publication_id: string | null
  external_post_id: string | null
  external_url: string | null
  attempt_count: number
  last_error_code: string | null
  last_error_message: string | null
  created_at: string
  updated_at: string
  published_at: string | null
}
export type PublishJobInsert = {
  id?: string
  workspace_id: string
  content_item_id: string
  content_variant_id: string
  social_account_id: string
  approval_id: string
  platform: string
  publish_mode: string
  scheduled_for?: string | null
  status?: string
  idempotency_key: string
  brightbean_publication_id?: string | null
  external_post_id?: string | null
  external_url?: string | null
  attempt_count?: number
  last_error_code?: string | null
  last_error_message?: string | null
  created_at?: string
  updated_at?: string
  published_at?: string | null
}

export type AnalyticsSnapshotRow = {
  id: string
  workspace_id: string
  social_account_id: string | null
  content_variant_id: string | null
  publish_job_id: string | null
  external_post_id: string | null
  metrics_json: Json
  source: string
  source_version: string | null
  capture_window: string | null
  captured_at: string
  created_at: string
}
export type AnalyticsSnapshotInsert = {
  id?: string
  workspace_id: string
  social_account_id?: string | null
  content_variant_id?: string | null
  publish_job_id?: string | null
  external_post_id?: string | null
  metrics_json?: Json
  source?: string
  source_version?: string | null
  capture_window?: string | null
  captured_at: string
  created_at?: string
}

export type StrategyNoteRow = {
  id: string
  workspace_id: string
  summary: string
  evidence: Json
  window_start: string | null
  window_end: string | null
  created_at: string
}
export type StrategyNoteInsert = {
  id?: string
  workspace_id: string
  summary: string
  evidence?: Json
  window_start?: string | null
  window_end?: string | null
  created_at?: string
}

export type AgentRunRow = {
  id: string
  workspace_id: string
  tool_name: string
  correlation_id: string | null
  safe_input: Json
  safe_output: Json | null
  status: string
  error_code: string | null
  started_at: string
  completed_at: string | null
}
export type AgentRunInsert = {
  id?: string
  workspace_id: string
  tool_name: string
  correlation_id?: string | null
  safe_input?: Json
  safe_output?: Json | null
  status: string
  error_code?: string | null
  started_at?: string
  completed_at?: string | null
}

export type AuditEventRow = {
  id: string
  workspace_id: string
  actor_user_id: string | null
  event_type: string
  entity_type: string | null
  entity_id: string | null
  correlation_id: string | null
  metadata: Json
  created_at: string
}
export type AuditEventInsert = {
  id?: string
  workspace_id: string
  actor_user_id?: string | null
  event_type: string
  entity_type?: string | null
  entity_id?: string | null
  correlation_id?: string | null
  metadata?: Json
  created_at?: string
}

export type BackgroundJobRow = {
  id: string
  workspace_id: string
  job_type: string
  payload: Json
  status: string
  attempt_count: number
  max_attempts: number
  run_after: string
  locked_by: string | null
  locked_at: string | null
  last_error_code: string | null
  last_error_message: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}
export type BackgroundJobInsert = {
  id?: string
  workspace_id: string
  job_type: string
  payload?: Json
  status?: string
  attempt_count?: number
  max_attempts?: number
  run_after?: string
  locked_by?: string | null
  locked_at?: string | null
  last_error_code?: string | null
  last_error_message?: string | null
  created_at?: string
  updated_at?: string
  completed_at?: string | null
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15'
  }
  public: {
    Tables: {
      workspaces: TableDefinition<WorkspaceRow, WorkspaceInsert>
      social_accounts: TableDefinition<SocialAccountRow, SocialAccountInsert>
      content_items: TableDefinition<ContentItemRow, ContentItemInsert>
      content_variants: TableDefinition<ContentVariantRow, ContentVariantInsert>
      media_assets: TableDefinition<MediaAssetRow, MediaAssetInsert>
      approvals: TableDefinition<ApprovalRow, ApprovalInsert>
      publish_jobs: TableDefinition<PublishJobRow, PublishJobInsert>
      analytics_snapshots: TableDefinition<AnalyticsSnapshotRow, AnalyticsSnapshotInsert>
      strategy_notes: TableDefinition<StrategyNoteRow, StrategyNoteInsert>
      agent_runs: TableDefinition<AgentRunRow, AgentRunInsert>
      audit_events: TableDefinition<AuditEventRow, AuditEventInsert>
      background_jobs: TableDefinition<BackgroundJobRow, BackgroundJobInsert>
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_background_job: {
        Args: { p_worker_id: string }
        Returns: BackgroundJobRow
        SetofOptions: {
          from: '*'
          to: 'background_jobs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_content_decision: {
        Args: {
          p_content_item_id: string
          p_decision: string
          p_reason: string
          p_review_snapshot_json: Json
          p_snapshot_hash: string
          p_publish_mode: string
          p_decided_by: string
        }
        Returns: ApprovalRow
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']