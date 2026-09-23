import type { EventRow } from "@/lib/event-log/dispatcher";
import {
  DEFAULT_VISIBILITY_MODE,
  type HumanRole,
  type VisibilityMode,
} from "@/lib/auth/types";

export interface ConversationVisibility {
  id: string;
  assigned_to_user_id: string | null;
}

export interface RealtimeAccessContext {
  userId: string;
  role: HumanRole;
  visibilityMode: VisibilityMode;
}

export type RealtimeEvent = EventRow & { created_at: string };

const CONVERSATION_BOUND_KINDS = new Set(["conversation", "message", "media"]);

export function conversationIdFromEvent(event: EventRow): string | null {
  const payloadConversationId = event.payload?.conversation_id;
  if (typeof payloadConversationId === "string" && payloadConversationId.length > 0) {
    return payloadConversationId;
  }

  if (event.entity_kind === "conversation" && event.entity_id) {
    return event.entity_id;
  }

  return null;
}

export function isConversationBoundEvent(event: EventRow): boolean {
  return (
    CONVERSATION_BOUND_KINDS.has(event.entity_kind) ||
    /^(conversation|message|media)\./.test(event.event_type)
  );
}

export function normalizeVisibilityMode(value: unknown): VisibilityMode {
  if (value === "all" || value === "own_and_unassigned" || value === "own") {
    return value;
  }
  return DEFAULT_VISIBILITY_MODE;
}

export function filterEventsByConversationVisibility(
  events: RealtimeEvent[],
  eventConversationIds: ReadonlyMap<string, string | null>,
  conversations: ReadonlyMap<string, ConversationVisibility>,
  access: RealtimeAccessContext,
): RealtimeEvent[] {
  if (access.role !== "agent") return events;

  return events.filter((event) => {
    let conversationId: string | null;
    if (eventConversationIds.has(event.id)) {
      conversationId = eventConversationIds.get(event.id) ?? null;
    } else {
      const directConversationId = conversationIdFromEvent(event);
      if (directConversationId) {
        conversationId = directConversationId;
      } else if (isConversationBoundEvent(event)) {
        // Unknown conversation mapping is not tenant-wide. Drop it rather than
        // risk emitting a hidden conversation event through the service role.
        return false;
      } else {
        // Events without a conversation scope (for example org settings) are
        // safe after event_log has already applied the organization filter.
        return true;
      }
    }

    if (!conversationId) return false;
    const conversation = conversations.get(conversationId);
    if (!conversation) return false;
    if (conversation.assigned_to_user_id === access.userId) return true;
    if (access.visibilityMode === "all") return true;
    return access.visibilityMode === "own_and_unassigned" && conversation.assigned_to_user_id === null;
  });
}
