import { describe, expect, it } from "vitest";
import { createHandoffPack, reconstructSessionState } from "./handoff-pack";
import type { SessionState } from "./session-service";

const state: SessionState = {
  session_id: "session-1", organization_id: "org-1", agent_id: "agent-1", agent_version: "v1",
  execution_epoch: 3, state_version: 9, status: "PAUSED", goal: "recover provider failure",
  constraints: ["no external side effects"], facts: ["provider unavailable"], decisions: ["use compatible fallback"],
  promises: ["preserve context"], completed: ["checkpoint"], pending: ["resume"], artifacts: ["snapshot:9"],
  errors: ["provider_timeout"], blockers: ["owner validation"], verification: ["snapshot persisted"],
  next_action: "validate fallback", context_budget: { max_tokens: 1000, max_items: 8, max_latency_ms: 500 },
  created_at: "2026-09-12T19:00:00.000Z", updated_at: "2026-09-12T19:05:00.000Z",
};
const input = { handoff_id: "handoff-1" as const, reason: "PROVIDER_FAILURE" as const, source_refs: ["provider:receipt-1"], evidence_refs: ["snapshot:9"], redacted: false };

describe("HandoffPack", () => {
  it("reconstructs the original session state faithfully", () => {
    const pack = createHandoffPack(state, input);
    expect(reconstructSessionState(state, pack)).toEqual(state);
  });

  it("redacts sensitive content before it enters the pack", () => {
    const pack = createHandoffPack({ ...state, facts: ["api_key=super-secret-value"] }, { ...input, redacted: true });
    expect(pack.facts).toEqual(["api_key=[REDACTED]"]);
    expect(JSON.stringify(pack)).not.toContain("super-secret-value");
  });

  it("applies the destination execution epoch during reconstruction", () => {
    const pack = createHandoffPack(state, { ...input, to_execution_epoch: 4 });
    expect(reconstructSessionState(state, pack).execution_epoch).toBe(4);
  });
});
