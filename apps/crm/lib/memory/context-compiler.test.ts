import { describe, expect, it } from "vitest";

import { compileContextPackage, type MemoryEvent } from "./context-compiler";

const base = (overrides: Partial<MemoryEvent> = {}): MemoryEvent => ({
  recordId: "r-1",
  kind: "SEMANTIC",
  organizationId: "org-a",
  subject: "agent:sales",
  scope: "company:org-a",
  authority: 2,
  confidence: 0.8,
  observedAt: "2026-09-12T10:00:00.000Z",
  validUntil: null,
  lifecycle: "active",
  content: "fact about the customer",
  ...overrides,
});

describe("Context Compiler mínimo", () => {
  it("seleciona somente eventos do tenant, subject e namespace pedidos", () => {
    const result = compileContextPackage(
      [
        base({ recordId: "company", content: "company memory" }),
        base({ recordId: "other-org", organizationId: "org-b" }),
        base({ recordId: "home", scope: "home:david" }),
        base({ recordId: "other-subject", subject: "agent:support" }),
      ],
      { organizationId: "org-a", subject: "agent:sales", scope: "company:org-a", budgetTokens: 100 },
    );

    expect(result.memory.map((event) => event.recordId)).toEqual(["company"]);
    expect(result.trustMetadata.omittedRecordIds.sort()).toEqual(["home", "other-org", "other-subject"]);
  });

  it("respeita o budget, priorizando autoridade/confiança e reportando omissões", () => {
    const result = compileContextPackage(
      [
        base({ recordId: "low", authority: 1, confidence: 0.5, content: "one two three four" }),
        base({ recordId: "high", authority: 4, confidence: 0.99, content: "one two" }),
      ],
      { organizationId: "org-a", subject: "agent:sales", scope: "company:org-a", budgetTokens: 2 },
    );

    expect(result.memory.map((event) => event.recordId)).toEqual(["high"]);
    expect(result.budget).toEqual({ maxTokens: 2, usedTokens: 2 });
    expect(result.trustMetadata.omittedRecordIds).toContain("low");
  });

  it("exclui eventos expirados, superseded e redacted sem mutar a entrada", () => {
    const events = [
      base({ recordId: "current", content: "current" }),
      base({ recordId: "expired", validUntil: "2026-09-11T00:00:00.000Z" }),
      base({ recordId: "old", lifecycle: "superseded" }),
      base({ recordId: "secret", lifecycle: "redacted" }),
    ];
    const result = compileContextPackage(events, {
      organizationId: "org-a", subject: "agent:sales", scope: "company:org-a", budgetTokens: 100,
      now: "2026-09-12T12:00:00.000Z",
    });

    expect(result.memory.map((event) => event.recordId)).toEqual(["current"]);
    expect(events.map((event) => event.lifecycle)).toEqual(["active", "active", "superseded", "redacted"]);
  });
});
