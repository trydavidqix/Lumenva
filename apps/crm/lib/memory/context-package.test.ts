import { describe, expect, it } from "vitest";

import { compileContextPackage, type MemoryEvent } from "./context-compiler";

const event = (overrides: Partial<MemoryEvent> = {}): MemoryEvent => ({
  recordId: "memory-1",
  kind: "SEMANTIC",
  organizationId: "org-a",
  subject: "agent:sales",
  scope: "company:org-a",
  authority: 3,
  confidence: 0.9,
  observedAt: "2026-09-12T10:00:00.000Z",
  validUntil: null,
  lifecycle: "active",
  content: "cliente aguarda proposta",
  ...overrides,
});

describe("ContextPackage canônico", () => {
  it("junta identity, goal, memory, knowledge, session e tool state com trust metadata", () => {
    const result = compileContextPackage(
      [event({ kind: "KNOWLEDGE", recordId: "knowledge-1", content: "política de follow-up" }), event()],
      {
        organizationId: "org-a",
        subject: "agent:sales",
        scope: "company:org-a",
        budgetTokens: 100,
        now: "2026-09-12T12:00:00.000Z",
        identity: { agentId: "agent:sales", version: "1.0.0" },
        goal: { id: "goal-1", text: "fechar proposta" },
        session: { id: "session-1", stateVersion: 2 },
        toolState: { allowed: ["crm.read"], pending: [] },
      },
    );

    expect(result.identity).toEqual({ agentId: "agent:sales", version: "1.0.0" });
    expect(result.goal).toEqual({ id: "goal-1", text: "fechar proposta" });
    expect(result.memory).toHaveLength(2);
    expect(result.knowledge.map((item) => item.recordId)).toEqual(["knowledge-1"]);
    expect(result.session).toEqual({ id: "session-1", stateVersion: 2 });
    expect(result.toolState).toEqual({ allowed: ["crm.read"], pending: [] });
    expect(result.trustMetadata).toMatchObject({
      organizationId: "org-a",
      scope: "company:org-a",
      omittedRecordIds: [],
    });
    expect(result.budget.maxTokens).toBe(100);
    expect(result.budget.usedTokens).toBeLessThanOrEqual(100);
    expect(result.expiresAt).toBe("2026-09-12T12:00:00.000Z");
  });
});
