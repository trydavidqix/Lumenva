import { describe, expect, it } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import { filterEventsForVisibility } from "./event-visibility";

const event = (id: string, conversationId?: string) => ({
  id,
  organization_id: "org-a",
  event_type: "message.received",
  entity_kind: "message",
  entity_id: `message-${id}`,
  payload: conversationId ? { conversation_id: conversationId } : {},
  metadata: {},
  consumed_by: [],
  attempts: 0,
  created_at: new Date().toISOString(),
}) as EventRow & { created_at: string };

describe("realtime conversation visibility", () => {
  it("hides another agent conversation while keeping own and unassigned rows", () => {
    const events = [event("own", "conv-own"), event("other", "conv-other"), event("queue", "conv-queue"), event("org")];
    const visible = filterEventsForVisibility(
      events,
      new Map([
        ["own", "conv-own"],
        ["other", "conv-other"],
        ["queue", "conv-queue"],
      ]),
      [
        { id: "conv-own", assigned_to_user_id: "user-a" },
        { id: "conv-other", assigned_to_user_id: "user-b" },
        { id: "conv-queue", assigned_to_user_id: null },
      ],
      { userId: "user-a", role: "agent", visibilityMode: "own_and_unassigned" },
    );

    expect(visible.map((row) => row.id)).toEqual(["own", "queue", "org"]);
  });

  it("fails closed when agent event conversation cannot be resolved", () => {
    const visible = filterEventsForVisibility(
      [event("unknown", "conv-missing")],
      new Map([["unknown", "conv-missing"]]),
      [],
      { userId: "user-a", role: "agent", visibilityMode: "all" },
    );

    expect(visible).toEqual([]);
  });

  it("keeps tenant-wide events and org-wide roles unchanged", () => {
    const events = [event("org"), event("other", "conv-other")];
    const visible = filterEventsForVisibility(
      events,
      new Map([["other", "conv-other"]]),
      [{ id: "conv-other", assigned_to_user_id: "user-b" }],
      { userId: "user-a", role: "manager", visibilityMode: "own" },
    );

    expect(visible.map((row) => row.id)).toEqual(["org", "other"]);
  });
});
