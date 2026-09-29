import type { EventRow } from "@/lib/event-log/dispatcher";

export type ConversationVisibilityMode = "all" | "own_and_unassigned" | "own";
export type RealtimeHumanRole = "viewer" | "agent" | "manager" | "admin";

export interface ConversationVisibilityRow {
  id: string;
  assigned_to_user_id: string | null;
}

export interface RealtimeAccessContext {
  userId: string;
  role: RealtimeHumanRole;
  visibilityMode: ConversationVisibilityMode;
}

/**
 * Return conversation id carried directly by an event.
 * Message events normally carry payload.conversation_id; conversation events
 * carry entity_id. Events without conversation scope remain tenant-wide.
 */
export function conversationIdFromEvent(event: Pick<EventRow, "entity_kind" | "entity_id" | "payload">): string | null {
  const payloadConversationId = event.payload?.conversation_id;
  if (typeof payloadConversationId === "string" && payloadConversationId.length > 0) {
    return payloadConversationId;
  }
  if (event.entity_kind === "conversation" && event.entity_id) return event.entity_id;
  return null;
}

/**
 * Apply conversation visibility to already tenant-filtered events.
 * Only agent role uses visibility_mode. Unknown conversation mapping fails
 * closed; events with no conversation scope remain tenant-wide.
 */
export function filterEventsForVisibility(
  events: readonly (EventRow & { created_at: string })[],
  conversationIdByEventId: ReadonlyMap<string, string>,
  conversations: readonly ConversationVisibilityRow[],
  access: RealtimeAccessContext,
): (EventRow & { created_at: string })[] {
  if (access.role !== "agent") return [...events];

  const rowsById = new Map(conversations.map((row) => [row.id, row]));
  return events.filter((event) => {
    const conversationId = conversationIdByEventId.get(event.id);
    if (!conversationId) return true;

    const conversation = rowsById.get(conversationId);
    if (!conversation) return false;
    if (conversation.assigned_to_user_id === access.userId) return true;
    if (access.visibilityMode === "all") return true;
    return access.visibilityMode === "own_and_unassigned" && conversation.assigned_to_user_id === null;
  });
}
