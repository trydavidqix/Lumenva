import { pgTable, text, uuid, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const ai_agent_runs = pgTable('ai_agent_runs', {
  tokens_in: integer('tokens_in'),
  tokens_out: integer('tokens_out'),
  cost_cents: text('cost_cents'),
  latency_ms: integer('latency_ms'),
  steps_count: integer('steps_count'),
  is_dry_run: boolean('is_dry_run'),
  started_at: timestamp('started_at'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at'),
});

export const ai_agent_versions = pgTable('ai_agent_versions', {
  version_number: integer('version_number'),
  max_steps: integer('max_steps'),
  token_budget: integer('token_budget'),
  cost_budget_cents: integer('cost_budget_cents'),
  history_message_window: integer('history_message_window'),
  history_token_window: integer('history_token_window'),
  handoff_tool_enabled: boolean('handoff_tool_enabled'),
  published_at: timestamp('published_at'),
  superseded_at: timestamp('superseded_at'),
  created_at: timestamp('created_at'),
});

export const ai_agents = pgTable('ai_agents', {
  is_active: boolean('is_active'),
  is_default: boolean('is_default'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
  priority: integer('priority'),
  archived_at: timestamp('archived_at'),
});

export const ai_budgets = pgTable('ai_budgets', {
  monthly_limit_cents: integer('monthly_limit_cents'),
  alarm_threshold_pct: integer('alarm_threshold_pct'),
  current_month_consumed_cents: text('current_month_consumed_cents'),
  last_alarm_sent_at: timestamp('last_alarm_sent_at'),
  is_throttled: boolean('is_throttled'),
  is_disabled: boolean('is_disabled'),
  updated_at: timestamp('updated_at'),
});

export const ai_chunks = pgTable('ai_chunks', {
  position: integer('position'),
  token_count: integer('token_count'),
  created_at: timestamp('created_at'),
});

export const ai_faq_items = pgTable('ai_faq_items', {
  position: integer('position'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const ai_invocations = pgTable('ai_invocations', {
  prompt_tokens: integer('prompt_tokens'),
  completion_tokens: integer('completion_tokens'),
  total_tokens: integer('total_tokens'),
  latency_ms: integer('latency_ms'),
  cost_cents: text('cost_cents'),
  created_at: timestamp('created_at'),
});

export const ai_knowledge_sources = pgTable('ai_knowledge_sources', {
  is_active: boolean('is_active'),
  last_indexed_at: timestamp('last_indexed_at'),
  chunks_count: integer('chunks_count'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
  ingested_at: timestamp('ingested_at'),
});

export const ai_knowledge_versions = pgTable('ai_knowledge_versions', {
  version_number: integer('version_number'),
  is_active: boolean('is_active'),
  total_chunks: integer('total_chunks'),
  created_at: timestamp('created_at'),
  activated_at: timestamp('activated_at'),
  indexed_at: timestamp('indexed_at'),
});

export const ai_models = pgTable('ai_models', {
  context_window: integer('context_window'),
  input_price_per_million_cents: integer('input_price_per_million_cents'),
  output_price_per_million_cents: integer('output_price_per_million_cents'),
  supports_tools: boolean('supports_tools'),
  is_default_for_provider: boolean('is_default_for_provider'),
  deprecated_at: timestamp('deprecated_at'),
  released_at: timestamp('released_at'),
});

export const ai_pricing = pgTable('ai_pricing', {
  prompt_cents_per_million_tokens: text('prompt_cents_per_million_tokens'),
  completion_cents_per_million_tokens: text('completion_cents_per_million_tokens'),
  embedding_cents_per_million_tokens: text('embedding_cents_per_million_tokens'),
  effective_from: timestamp('effective_from'),
  superseded_at: timestamp('superseded_at'),
});

export const ai_provider_credentials = pgTable('ai_provider_credentials', {
  validated_at: timestamp('validated_at'),
  is_active: boolean('is_active'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const api_audit_log = pgTable('api_audit_log', {
  acting_as_platform_admin: boolean('acting_as_platform_admin'),
  bypassed_rls: boolean('bypassed_rls'),
  created_at: timestamp('created_at'),
});

export const api_tokens = pgTable('api_tokens', {
  last_used_at: timestamp('last_used_at'),
  expires_at: timestamp('expires_at'),
  revoked_at: timestamp('revoked_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const channel_session_warmup = pgTable('channel_session_warmup', {
  messages_sent: integer('messages_sent'),
  messages_received: integer('messages_received'),
  unique_contacts: integer('unique_contacts'),
});

export const channel_sessions = pgTable('channel_sessions', {
  last_health_check_at: timestamp('last_health_check_at'),
  last_status_change_at: timestamp('last_status_change_at'),
  consecutive_health_fails: integer('consecutive_health_fails'),
  daily_message_limit: integer('daily_message_limit'),
  warmup_started_at: timestamp('warmup_started_at'),
  warmup_completed_at: timestamp('warmup_completed_at'),
  is_warmup_complete: boolean('is_warmup_complete'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const contacts = pgTable('contacts', {
  is_blocked: boolean('is_blocked'),
  blocked_at: timestamp('blocked_at'),
  is_anonymized: boolean('is_anonymized'),
  anonymized_at: timestamp('anonymized_at'),
  merged_at: timestamp('merged_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
  last_activity_at: timestamp('last_activity_at'),
  force_human: boolean('force_human'),
  pacing_exempt: boolean('pacing_exempt'),
});

export const conversations = pgTable('conversations', {
  status_changed_at: timestamp('status_changed_at'),
  assigned_at: timestamp('assigned_at'),
  last_inbound_at: timestamp('last_inbound_at'),
  last_outbound_at: timestamp('last_outbound_at'),
  last_message_at: timestamp('last_message_at'),
  unread_count_for_assignee: integer('unread_count_for_assignee'),
  is_group: boolean('is_group'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
  bot_silenced_until: timestamp('bot_silenced_until'),
  last_handoff_at: timestamp('last_handoff_at'),
  usable_for_rag: boolean('usable_for_rag'),
  usable_for_rag_marked_at: timestamp('usable_for_rag_marked_at'),
});

export const crm_lead_activities = pgTable('crm_lead_activities', {
  performed_at: timestamp('performed_at'),
  created_at: timestamp('created_at'),
});

export const crm_lead_links = pgTable('crm_lead_links', {
  created_at: timestamp('created_at'),
});

export const crm_leads = pgTable('crm_leads', {
  position_in_stage: text('position_in_stage'),
  value_cents: integer('value_cents'),
  assigned_at: timestamp('assigned_at'),
  last_activity_at: timestamp('last_activity_at'),
  closed_at: timestamp('closed_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const crm_pipelines = pgTable('crm_pipelines', {
  is_default: boolean('is_default'),
  is_archived: boolean('is_archived'),
  position: text('position'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const crm_stages = pgTable('crm_stages', {
  position: text('position'),
  is_won: boolean('is_won'),
  is_lost: boolean('is_lost'),
  is_archived: boolean('is_archived'),
  expected_duration_hours: text('expected_duration_hours'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
  requires_human: boolean('requires_human'),
});

export const event_log = pgTable('event_log', {
  attempts: integer('attempts'),
  next_attempt_at: timestamp('next_attempt_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const idempotency_keys = pgTable('idempotency_keys', {
  status_code: integer('status_code'),
  created_at: timestamp('created_at'),
  expires_at: timestamp('expires_at'),
});

export const incidents = pgTable('incidents', {
  acknowledged_at: timestamp('acknowledged_at'),
  resolved_at: timestamp('resolved_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const lgpd_requests = pgTable('lgpd_requests', {
  attempts: integer('attempts'),
  received_at: timestamp('received_at'),
  due_at: timestamp('due_at'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
  emergency: boolean('emergency'),
});

export const merge_queue = pgTable('merge_queue', {
  resolved_at: timestamp('resolved_at'),
  created_at: timestamp('created_at'),
});

export const messages = pgTable('messages', {
  ack: integer('ack'),
  media_size_bytes: integer('media_size_bytes'),
  sent_at: timestamp('sent_at'),
  delivered_at: timestamp('delivered_at'),
  read_at: timestamp('read_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const nuvemshop_products = pgTable('nuvemshop_products', {
  price_cents: integer('price_cents'),
  available_qty: integer('available_qty'),
  rag_indexed_at: timestamp('rag_indexed_at'),
  rag_chunk_count: integer('rag_chunk_count'),
  last_updated_at: timestamp('last_updated_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const orders = pgTable('orders', {
  total_cents: integer('total_cents'),
  currency: text('currency'),
  ordered_at: timestamp('ordered_at'),
  updated_at_remote: timestamp('updated_at_remote'),
  is_anonymized: boolean('is_anonymized'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const organizations = pgTable('organizations', {
  rate_limit_rps: integer('rate_limit_rps'),
  ai_budget_cents: integer('ai_budget_cents'),
  media_retention_days: integer('media_retention_days'),
  onboarded_at: timestamp('onboarded_at'),
  suspended_at: timestamp('suspended_at'),
  redacted_at: timestamp('redacted_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const contact_legal_bases = pgTable('contact_legal_bases', {
  id: uuid('id'),
  organization_id: uuid('organization_id'),
  contact_id: uuid('contact_id'),
  purpose: text('purpose'),
  legal_basis: text('legal_basis'),
  text_version: text('text_version'),
  recorded_at: timestamp('recorded_at'),
  evidence: jsonb('evidence'),
  channel: text('channel'),
  revoked_at: timestamp('revoked_at'),
  created_at: timestamp('created_at'),
});

export const platform_admins = pgTable('platform_admins', {
  granted_at: timestamp('granted_at'),
  mfa_required: boolean('mfa_required'),
  revoked_at: timestamp('revoked_at'),
});

export const storage_redaction_queue = pgTable('storage_redaction_queue', {
  attempts: integer('attempts'),
  enqueued_at: timestamp('enqueued_at'),
  processed_at: timestamp('processed_at'),
});

export const tenant_integrations = pgTable('tenant_integrations', {
  expires_at: timestamp('expires_at'),
  last_sync_at: timestamp('last_sync_at'),
  last_health_check_at: timestamp('last_health_check_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const user_organizations = pgTable('user_organizations', {
  invited_at: timestamp('invited_at'),
  accepted_at: timestamp('accepted_at'),
  revoked_at: timestamp('revoked_at'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const user_recovery_codes = pgTable('user_recovery_codes', {
  used_at: timestamp('used_at'),
  created_at: timestamp('created_at'),
});

export const webhook_events_log = pgTable('webhook_events_log', {
  valid_signature: boolean('valid_signature'),
  attempts: integer('attempts'),
  processed_at: timestamp('processed_at'),
  received_at: timestamp('received_at'),
  archived_at: timestamp('archived_at'),
});

export const erasure_decisions = pgTable('erasure_decisions', {
  id: uuid('id'),
  organization_id: uuid('organization_id'),
  contact_id: uuid('contact_id'),
  request_id: uuid('request_id'),
  result: text('result'),
  legal_exception: text('legal_exception'),
  retained_fields: jsonb('retained_fields'),
  irreversibility_proof: text('irreversibility_proof'),
  created_at: timestamp('created_at'),
});

export const rgpd_breach_incidents = pgTable('rgpd_breach_incidents', {
  id: uuid('id'),
  organization_id: uuid('organization_id'),
  known_at: timestamp('known_at'),
  risk_level: text('risk_level'),
  deadline_at: timestamp('deadline_at'),
  notification_decision: text('notification_decision'),
  notified_at: timestamp('notified_at'),
  cnpd_evidence_url: text('cnpd_evidence_url'),
  data_subject_notified_at: timestamp('data_subject_notified_at'),
  escalation_owner: uuid('escalation_owner'),
  escalation_notes: text('escalation_notes'),
  evidence: jsonb('evidence'),
  idempotency_key: text('idempotency_key'),
  created_at: timestamp('created_at'),
  updated_at: timestamp('updated_at'),
});

export const transfer_inventories = pgTable('transfer_inventories', {
  id: uuid('id'),
});
