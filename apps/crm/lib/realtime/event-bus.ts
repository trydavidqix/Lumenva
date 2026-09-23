import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import {
  conversationIdFromEvent,
  filterEventsByConversationVisibility,
  isConversationBoundEvent,
  normalizeVisibilityMode,
  type ConversationVisibility,
  type RealtimeAccessContext,
  type RealtimeEvent,
} from "./event-visibility";

export type RealtimePollAccess = Pick<RealtimeAccessContext, "userId" | "role">;

export async function pollEvents(
  organizationId: string,
  cursorAt: Date,
  limit = 100,
  access: RealtimePollAccess,
): Promise<RealtimeEvent[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("event_log")
    .select("id, organization_id, event_type, entity_kind, entity_id, payload, metadata, consumed_by, attempts, created_at")
    .eq("organization_id", organizationId)
    .gt("created_at", cursorAt.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error("[event-bus.pollEvents] Failed to poll event_log", { error: error.message });
    return [];
  }

  const events = (data ?? []) as unknown as RealtimeEvent[];
  if (access.role !== "agent") return events;

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError || !organization) {
    logger.error("[event-bus.pollEvents] Failed to load visibility settings", {
      error: organizationError?.message ?? "organization_not_found",
    });
    return [];
  }

  const settings = (
    organization.settings && typeof organization.settings === "object" ? organization.settings : {}
  ) as Record<string, unknown>;
  const visibilityMode = normalizeVisibilityMode(settings.visibility_mode);
  const eventConversationIds = new Map<string, string | null>();
  const eventMessageIds = new Map<string, string>();
  const conversationIds = new Set<string>();
  const messageIds = new Set<string>();

  for (const event of events) {
    const directConversationId = conversationIdFromEvent(event);
    if (directConversationId) {
      eventConversationIds.set(event.id, directConversationId);
      conversationIds.add(directConversationId);
    }

    const payloadMessageId = event.payload?.message_id;
    const messageId =
      event.entity_kind === "message" && event.entity_id
        ? event.entity_id
        : typeof payloadMessageId === "string"
          ? payloadMessageId
          : null;
    if (messageId) {
      eventMessageIds.set(event.id, messageId);
      messageIds.add(messageId);
    } else if (!directConversationId && isConversationBoundEvent(event)) {
      eventConversationIds.set(event.id, null);
    }
  }

  if (messageIds.size > 0) {
    const { data: messages, error: messageError } = await admin
      .from("messages")
      .select("id, conversation_id")
      .eq("organization_id", organizationId)
      .in("id", [...messageIds]);
    if (messageError) {
      logger.error("[event-bus.pollEvents] Failed to resolve message conversations", {
        error: messageError.message,
      });
      return [];
    }

    const messageConversationIds = new Map<string, string | null>();
    for (const message of messages ?? []) {
      messageConversationIds.set(message.id, message.conversation_id ?? null);
      if (message.conversation_id) conversationIds.add(message.conversation_id);
    }
    for (const [eventId, messageId] of eventMessageIds) {
      eventConversationIds.set(eventId, messageConversationIds.get(messageId) ?? null);
    }
  }

  const conversations = new Map<string, ConversationVisibility>();
  if (conversationIds.size > 0) {
    const { data: rows, error: conversationError } = await admin
      .from("conversations")
      .select("id, assigned_to_user_id")
      .eq("organization_id", organizationId)
      .in("id", [...conversationIds]);
    if (conversationError) {
      logger.error("[event-bus.pollEvents] Failed to resolve conversation visibility", {
        error: conversationError.message,
      });
      return [];
    }
    for (const row of rows ?? []) {
      conversations.set(row.id, row as ConversationVisibility);
    }
  }

  return filterEventsByConversationVisibility(events, eventConversationIds, conversations, {
    ...access,
    visibilityMode,
  });
}
