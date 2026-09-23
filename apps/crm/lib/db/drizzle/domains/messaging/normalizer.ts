import type { Conversation, Message } from '../../../../types/messaging';

type DbDate = Date | string | null | undefined;
type DbNumber = number | string | null | undefined;

export interface ConversationDbRow {
  id?: string;
  organization_id?: string;
  contact_id?: string;
  channel_session_id?: string;
  channel?: string;
  status?: string;
  status_changed_at?: DbDate;
  assigned_to_user_id?: string | null;
  assignee_kind?: string | null;
  assigned_at?: DbDate;
  last_inbound_at?: DbDate;
  last_outbound_at?: DbDate;
  last_message_at?: DbDate;
  last_message_preview?: string | null;
  unread_count_for_assignee?: DbNumber;
  is_group?: boolean | null;
  group_chat_id?: string | null;
  tags?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
  snooze_until?: DbDate;
  bot_silenced_until?: DbDate;
  last_handoff_at?: DbDate;
  created_at?: DbDate;
  updated_at?: DbDate;
}

export interface MessageDbRow {
  id?: string;
  organization_id?: string;
  conversation_id?: string;
  channel_session_id?: string;
  contact_id?: string;
  external_id?: string | null;
  type?: string;
  direction?: Message['direction'];
  status?: string;
  ack?: DbNumber;
  error_code?: string | null;
  error_message?: string | null;
  body?: string | null;
  media_url?: string | null;
  media_mime?: string | null;
  media_size_bytes?: DbNumber;
  media_storage_path?: string | null;
  sent_via?: Message['sent_via'];
  sent_by_user_id?: string | null;
  sent_at?: DbDate;
  delivered_at?: DbDate;
  read_at?: DbDate;
  metadata?: Record<string, unknown> | null;
  created_at?: DbDate;
}

export const MessagingNormalizer = {
  conversation(row: ConversationDbRow | null | undefined): Partial<Conversation> {
    if (!row) return row as unknown as Partial<Conversation>;

    // Sort arrays (e.g. tags) for stable comparison
    const tags = row.tags ? [...row.tags] : [];
    tags.sort();

    return {
      id: row.id,
      organization_id: row.organization_id,
      contact_id: row.contact_id,
      channel_session_id: row.channel_session_id,
      channel: row.channel,
      status: row.status,
      status_changed_at: row.status_changed_at ? new Date(row.status_changed_at).toISOString() : undefined,
      assigned_to_user_id: row.assigned_to_user_id || undefined,
      assignee_kind: row.assignee_kind || undefined,
      assigned_at: row.assigned_at ? new Date(row.assigned_at).toISOString() : undefined,
      last_inbound_at: row.last_inbound_at ? new Date(row.last_inbound_at).toISOString() : undefined,
      last_outbound_at: row.last_outbound_at ? new Date(row.last_outbound_at).toISOString() : undefined,
      last_message_at: row.last_message_at ? new Date(row.last_message_at).toISOString() : undefined,
      last_message_preview: row.last_message_preview || undefined,
      unread_count_for_assignee: Number(row.unread_count_for_assignee || 0),
      is_group: Boolean(row.is_group),
      group_chat_id: row.group_chat_id || undefined,
      tags: tags,
      metadata: row.metadata || {},
      snooze_until: row.snooze_until ? new Date(row.snooze_until).toISOString() : undefined,
      bot_silenced_until: row.bot_silenced_until ? new Date(row.bot_silenced_until).toISOString() : undefined,
      last_handoff_at: row.last_handoff_at ? new Date(row.last_handoff_at).toISOString() : undefined,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
    } as unknown as Partial<Conversation>;
  },

  message(row: MessageDbRow | null | undefined): Partial<Message> {
    if (!row) return row as unknown as Partial<Message>;
    return {
      id: row.id,
      organization_id: row.organization_id,
      conversation_id: row.conversation_id,
      channel_session_id: row.channel_session_id,
      contact_id: row.contact_id,
      external_id: row.external_id || undefined,
      type: row.type,
      direction: row.direction,
      status: row.status,
      ack: row.ack !== null && row.ack !== undefined ? Number(row.ack) : undefined,
      error_code: row.error_code || undefined,
      error_message: row.error_message || undefined,
      body: row.body || undefined,
      media_url: row.media_url ? '[REDACTED]' : undefined,
      media_mime: row.media_mime || undefined,
      media_size_bytes: row.media_size_bytes !== null && row.media_size_bytes !== undefined ? Number(row.media_size_bytes) : undefined,
      media_storage_path: row.media_storage_path || undefined,
      sent_via: row.sent_via,
      sent_by_user_id: row.sent_by_user_id || undefined,
      sent_at: row.sent_at ? new Date(row.sent_at).toISOString() : undefined,
      delivered_at: row.delivered_at ? new Date(row.delivered_at).toISOString() : undefined,
      read_at: row.read_at ? new Date(row.read_at).toISOString() : undefined,
      metadata: row.metadata || {},
      created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    } as unknown as Partial<Message>;
  }
};
