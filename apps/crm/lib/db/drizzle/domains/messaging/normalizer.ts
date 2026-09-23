/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { Conversation, Message } from '../../../types/messaging';

export const MessagingNormalizer = {
  conversation(row: unknown): Partial<Conversation> {
    if (!row) return row as Partial<Conversation>;

    // Sort arrays (e.g. tags) for stable comparison
    const record = row as Record<string, unknown>;
    const tags = Array.isArray(record.tags) ? [...record.tags] : [];
    tags.sort();

    return {
      id: record.id as string | undefined,
      organization_id: record.organization_id as string | undefined,
      contact_id: record.contact_id as string | undefined,
      channel_session_id: record.channel_session_id as string | undefined,
      channel: record.channel as string | undefined,
      status: record.status as string | undefined,
      status_changed_at: record.status_changed_at ? new Date(record.status_changed_at as string | number | Date).toISOString() : undefined,
      assigned_to_user_id: (record.assigned_to_user_id as string) || undefined,
      assignee_kind: (record.assignee_kind as string) || undefined,
      assigned_at: record.assigned_at ? new Date(record.assigned_at as string | number | Date).toISOString() : undefined,
      last_inbound_at: record.last_inbound_at ? new Date(record.last_inbound_at as string | number | Date).toISOString() : undefined,
      last_outbound_at: record.last_outbound_at ? new Date(record.last_outbound_at as string | number | Date).toISOString() : undefined,
      last_message_at: record.last_message_at ? new Date(record.last_message_at as string | number | Date).toISOString() : undefined,
      last_message_preview: (record.last_message_preview as string) || undefined,
      unread_count_for_assignee: Number(record.unread_count_for_assignee || 0),
      is_group: Boolean(record.is_group),
      group_chat_id: (record.group_chat_id as string) || undefined,
      tags: tags as string[],
      metadata: (record.metadata as Record<string, unknown>) || {},
      snooze_until: record.snooze_until ? new Date(record.snooze_until as string | number | Date).toISOString() : undefined,
      bot_silenced_until: record.bot_silenced_until ? new Date(record.bot_silenced_until as string | number | Date).toISOString() : undefined,
      last_handoff_at: record.last_handoff_at ? new Date(record.last_handoff_at as string | number | Date).toISOString() : undefined,
      created_at: record.created_at ? new Date(record.created_at as string | number | Date).toISOString() : undefined,
      updated_at: record.updated_at ? new Date(record.updated_at as string | number | Date).toISOString() : undefined,
    } as unknown as Partial<Conversation>;
  },

  message(row: unknown): Partial<Message> {
    if (!row) return row as Partial<Message>;

    const record = row as Record<string, unknown>;

    return {
      id: record.id as string | undefined,
      organization_id: record.organization_id as string | undefined,
      conversation_id: record.conversation_id as string | undefined,
      channel_session_id: record.channel_session_id as string | undefined,
      contact_id: record.contact_id as string | undefined,
      external_id: (record.external_id as string) || undefined,
      type: record.type as string | undefined,
      direction: record.direction as "inbound" | "outbound" | undefined,
      status: record.status as string | undefined,
      ack: record.ack !== null && record.ack !== undefined ? Number(record.ack) : undefined,
      error_code: (record.error_code as string) || undefined,
      error_message: (record.error_message as string) || undefined,
      body: (record.body as string) || undefined,
      media_url: record.media_url ? '[REDACTED]' : undefined,
      media_mime: (record.media_mime as string) || undefined,
      media_size_bytes: record.media_size_bytes !== null && record.media_size_bytes !== undefined ? Number(record.media_size_bytes) : undefined,
      media_storage_path: (record.media_storage_path as string) || undefined,
      sent_via: record.sent_via as "user" | "ai" | "system" | undefined,
      sent_by_user_id: (record.sent_by_user_id as string) || undefined,
      sent_at: record.sent_at ? new Date(record.sent_at as string | number | Date).toISOString() : undefined,
      delivered_at: record.delivered_at ? new Date(record.delivered_at as string | number | Date).toISOString() : undefined,
      read_at: record.read_at ? new Date(record.read_at as string | number | Date).toISOString() : undefined,
      metadata: (record.metadata as Record<string, unknown>) || {},
      created_at: record.created_at ? new Date(record.created_at as string | number | Date).toISOString() : undefined,
    } as unknown as Partial<Message>;
  }
};
