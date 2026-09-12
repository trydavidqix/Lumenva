import { describe, expect, it } from "vitest";

import { resolveSupersession, type MemoryEvent } from "./supersession";

const record = (overrides: Partial<MemoryEvent> = {}): MemoryEvent => ({
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
  content: "canal_preferido=email",
  ...overrides,
});

describe("resolveSupersession", () => {
  it("faz r2 mais recente e mais confiante prevalecer, preservando r1 como superseded", () => {
    const r1 = record();
    const r2 = record({
      recordId: "r2",
      confidence: 0.97,
      observedAt: "2026-09-12T11:00:00.000Z",
      content: "canal_preferido=whatsapp",
    });

    const result = resolveSupersession(r1, r2);

    expect(result.current).toMatchObject({
      recordId: "r2",
      content: "canal_preferido=whatsapp",
      supersedes: "r1",
      lifecycle: "active",
    });
    expect(result.superseded).toMatchObject({
      recordId: "r1",
      lifecycle: "superseded",
    });
    expect(r1.lifecycle).toBe("active");
    expect(r2.lifecycle).toBe("active");
  });
});
