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
const input = { handoff_id: "handoff-1" as const, reason: "PROVIDER_FAILURE" as const, source_refs: ["provider:receipt-1"], evidence_refs: ["snapshot:9"] };

describe("HandoffPack", () => {
  it("reconstrói fielmente sobre uma base diferente e aplica o epoch de destino", () => {
    const pack = createHandoffPack(state, { ...input, to_execution_epoch: 4 });
    const base = { ...state, goal: "stale", constraints: [], facts: [], decisions: [], promises: [], completed: [], pending: [], artifacts: [], errors: [], blockers: [], verification: [], next_action: "wrong", execution_epoch: 3, state_version: 99 };
    const rebuilt = reconstructSessionState(base, pack);
    expect(rebuilt).toMatchObject({ session_id: state.session_id, organization_id: state.organization_id, agent_id: state.agent_id, agent_version: state.agent_version, execution_epoch: 4, state_version: 99, status: "PAUSED", goal: state.goal, constraints: state.constraints, facts: state.facts, decisions: state.decisions, promises: state.promises, completed: state.completed, pending: state.pending, artifacts: state.artifacts, errors: state.errors, blockers: state.blockers, verification: state.verification, next_action: state.next_action });
    expect(rebuilt).not.toBe(base);
    expect(rebuilt.constraints).not.toBe(pack.constraints);
  });

  it("redige sempre e ignora tentativa de desligar a redação", () => {
    const secret = "api_key=super-secret-value";
    const sensitiveState = { ...state, goal: secret, constraints: [secret], facts: [secret], decisions: [secret], promises: [secret], completed: [secret], pending: [secret], artifacts: [secret], errors: [secret], blockers: [secret], verification: [secret], next_action: secret };
    const callerAttempt = { ...input, redacted: false } as unknown as Parameters<typeof createHandoffPack>[1];
    const pack = createHandoffPack(sensitiveState, callerAttempt);
    const json = JSON.stringify(pack);
    expect(pack.redacted).toBe(true);
    expect(json).not.toContain("super-secret-value");
    expect(pack.normalized_goal).toContain("[REDACTED]");
    for (const value of [...pack.constraints, ...pack.source_refs, ...pack.evidence_refs]) expect(value).not.toContain("super-secret-value");
  });

  it("redige email, telefone e CPF em todos os campos de handoff", () => {
    const pii = "ana@example.com +351 912 345 678 CPF 123.456.789-09";
    const pack = createHandoffPack({ ...state, goal: pii, constraints: [pii], facts: [pii] }, input);
    const json = JSON.stringify(pack);
    expect(json).not.toContain("ana@example.com");
    expect(json).not.toContain("+351 912 345 678");
    expect(json).not.toContain("123.456.789-09");
    expect(pack.normalized_goal).toContain("[EMAIL_REDACTED]");
    expect(pack.normalized_goal).toContain("[PHONE_REDACTED]");
    expect(pack.normalized_goal).toContain("[CPF_REDACTED]");
  });

  it("rejeita sessão ou epoch de origem incompatíveis", () => {
    const pack = createHandoffPack(state, input);
    expect(() => reconstructSessionState({ ...state, session_id: "other" }, pack)).toThrow("handoff_session_or_epoch_mismatch");
    expect(() => reconstructSessionState({ ...state, execution_epoch: 2 }, pack)).toThrow("handoff_session_or_epoch_mismatch");
  });
});
