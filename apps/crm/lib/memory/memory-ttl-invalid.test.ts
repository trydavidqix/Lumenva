import { describe, expect, it } from "vitest";

import { applyMemoryTtl, type MemoryTtlOptions } from "./memory-ttl";
import type { MemoryEvent } from "./context-compiler";

const working = (overrides: Partial<MemoryEvent> = {}): MemoryEvent => ({
  recordId: "working-1",
  kind: "WORKING",
  organizationId: "org-a",
  subject: "agent:sales",
  scope: "company:org-a",
  authority: 2,
  confidence: 0.8,
  observedAt: "2026-09-12T10:00:00.000Z",
  validUntil: null,
  lifecycle: "active",
  content: "pending",
  ...overrides,
});

describe("TTL fail-closed", () => {
  it("trata options.now inválido como expirado", () => {
    const result = applyMemoryTtl([working()], {
      now: "not-a-timestamp",
      workingTtlMs: 60 * 60 * 1000,
      episodicTtlDays: 7,
    });

    expect(result[0]?.lifecycle).toBe("expired");
  });

  it("trata overflow do TTL como expirado", () => {
    const result = applyMemoryTtl([working({ observedAt: "9999-12-31T23:59:59.999Z" })], {
      now: "2026-09-12T12:00:00.000Z",
      workingTtlMs: Number.MAX_VALUE,
      episodicTtlDays: 7,
    });

    expect(result[0]?.lifecycle).toBe("expired");
  });
});
