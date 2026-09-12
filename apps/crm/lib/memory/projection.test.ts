import { describe, expect, it } from "vitest";

import { rebuildMemoryProjection } from "./projection";
import type { MemoryEvent } from "./context-compiler";

const event = (overrides: Partial<MemoryEvent> = {}): MemoryEvent => ({
  recordId: "r1",
  kind: "SEMANTIC",
  organizationId: "org-a",
  subject: "contact:ana",
  scope: "company:org-a",
  authority: 2,
  confidence: 0.8,
  observedAt: "2026-09-12T09:00:00.000Z",
  validUntil: null,
  lifecycle: "active",
  content: "canal=email",
  ...overrides,
});

describe("reconstrução de projeção", () => {
  it("reproduz o estado atual aplicando writes em ordem e respeitando supersession", () => {
    const result = rebuildMemoryProjection([
      event({ recordId: "r3", createdAt: "2026-09-12T11:00:00.000Z", supersedes: "r2", content: "canal=whatsapp" }),
      event({ recordId: "r1", createdAt: "2026-09-12T09:00:00.000Z" }),
      event({ recordId: "r2", createdAt: "2026-09-12T10:00:00.000Z", supersedes: "r1", content: "canal=telefone" }),
      event({ recordId: "other", subject: "contact:bia", createdAt: "2026-09-12T12:00:00.000Z" }),
      event({ recordId: "home", scope: "home:david", createdAt: "2026-09-12T12:00:00.000Z" }),
    ], { organizationId: "org-a", subject: "contact:ana", scope: "company:org-a" });

    expect(result.map((item) => item.recordId)).toEqual(["r3"]);
    expect(result[0]?.content).toBe("canal=whatsapp");
  });

  it("não muta o ledger e ignora writes rejeitados/redacted", () => {
    const ledger = [
      event({ recordId: "current" }),
      event({ recordId: "rejected", lifecycle: "rejected" }),
      event({ recordId: "redacted", lifecycle: "redacted" }),
    ];
    const result = rebuildMemoryProjection(ledger, {
      organizationId: "org-a", subject: "contact:ana", scope: "company:org-a",
    });

    expect(result.map((item) => item.recordId)).toEqual(["current"]);
    expect(ledger.map((item) => item.lifecycle)).toEqual(["active", "rejected", "redacted"]);
  });
});
