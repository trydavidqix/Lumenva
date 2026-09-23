import { describe, expect, it } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import {
  filterEventsByConversationVisibility,
  type ConversationVisibility,
  type RealtimeAccessContext,
} from "./event-visibility";

function event(id: string, entityKind = "message"): EventRow & { created_at: string } {
  return {
    id,
    organization_id: "org-1",
    event_type: `${entityKind}.updated`,
    entity_kind: entityKind,
    entity_id: id,
    payload: {},
    metadata: {},
    consumed_by: [],
    attempts: 0,
    created_at: "2026-09-23T00:00:00.000Z",
  };
}

const conversations = new Map<string, ConversationVisibility>([
  ["conv-own", { id: "conv-own", assigned_to_user_id: "user-1" }],
  ["conv-other", { id: "conv-other", assigned_to_user_id: "user-2" }],
  ["conv-unassigned", { id: "conv-unassigned", assigned_to_user_id: null }],
]);

const agent: RealtimeAccessContext = {
  userId: "user-1",
  role: "agent",
  visibilityMode: "own_and_unassigned",
};

describe("filterEventsByConversationVisibility", () => {
  it("keeps own and unassigned conversations, rejects another agent's conversation", () => {
    const rows = [event("own"), event("other"), event("unassigned")];
    const eventConversationIds = new Map([
      ["own", "conv-own"],
      ["other", "conv-other"],
      ["unassigned", "conv-unassigned"],
    ]);

    expect(
      filterEventsByConversationVisibility(rows, eventConversationIds, conversations, agent).map((row) => row.id),
    ).toEqual(["own", "unassigned"]);
  });

  it("applies own mode to reject unassigned conversations", () => {
    const rows = [event("own"), event("unassigned")];
    const eventConversationIds = new Map([
      ["own", "conv-own"],
      ["unassigned", "conv-unassigned"],
    ]);

    expect(
      filterEventsByConversationVisibility(
        rows,
        eventConversationIds,
        conversations,
        { ...agent, visibilityMode: "own" },
      ).map((row) => row.id),
    ).toEqual(["own"]);
  });

  it("fails closed when a conversation-bound event has no visible conversation row", () => {
    const rows = [event("unknown")];
    const eventConversationIds = new Map<string, string | null>([["unknown", null]]);

    expect(filterEventsByConversationVisibility(rows, eventConversationIds, conversations, agent)).toEqual([]);
  });

  it("does not narrow managers and preserves tenant-wide events", () => {
    const rows = [event("other"), event("tenant-wide", "organization")];
    const eventConversationIds = new Map([["other", "conv-other"]]);

    expect(
      filterEventsByConversationVisibility(
        rows,
        eventConversationIds,
        conversations,
        { ...agent, role: "manager" },
      ).map((row) => row.id),
    ).toEqual(["other", "tenant-wide"]);
  });
});
