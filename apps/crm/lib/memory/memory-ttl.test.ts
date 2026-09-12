import { describe, expect, it } from "vitest";

import { applyMemoryTtl, type MemoryTtlOptions } from "./memory-ttl";
import type { MemoryEvent } from "./context-compiler";

const event = (kind: MemoryEvent["kind"], observedAt: string): MemoryEvent => ({
  recordId: kind,
  kind,
  organizationId: "org-a",
  subject: "agent:sales",
  scope: "company:org-a",
  authority: 2,
  confidence: 0.8,
  observedAt,
  validUntil: null,
  lifecycle: "active",
  content: kind,
});

const options: MemoryTtlOptions = {
  now: "2026-09-12T12:00:00.000Z",
  workingTtlMs: 60 * 60 * 1000,
  episodicTtlDays: 7,
};

describe("política de expiração de memória", () => {
  it("WORKING expira rapidamente conforme TTL configurável", () => {
    const [expired, fresh] = applyMemoryTtl([
      event("WORKING", "2026-09-12T10:00:00.000Z"),
      event("WORKING", "2026-09-12T11:30:00.000Z"),
    ], options);

    expect(expired.lifecycle).toBe("expired");
    expect(expired.validUntil).toBe("2026-09-12T11:00:00.000Z");
    expect(fresh.lifecycle).toBe("active");
    expect(fresh.validUntil).toBe("2026-09-12T12:30:00.000Z");
  });

  it("SEMANTIC e PROCEDURAL não expiram por idade", () => {
    const result = applyMemoryTtl([
      event("SEMANTIC", "2020-01-01T00:00:00.000Z"),
      event("PROCEDURAL", "2020-01-01T00:00:00.000Z"),
    ], options);

    expect(result.map((item) => item.lifecycle)).toEqual(["active", "active"]);
    expect(result.map((item) => item.validUntil)).toEqual([null, null]);
  });

  it("EPISODIC expira em X dias configurável", () => {
    const [expired, fresh] = applyMemoryTtl([
      event("EPISODIC", "2026-09-05T12:00:00.000Z"),
      event("EPISODIC", "2026-09-06T12:00:00.000Z"),
    ], options);

    expect(expired.lifecycle).toBe("expired");
    expect(expired.validUntil).toBe("2026-09-12T12:00:00.000Z");
    expect(fresh.lifecycle).toBe("active");
    expect(fresh.validUntil).toBe("2026-09-13T12:00:00.000Z");
  });

  it("não muta os registros de entrada", () => {
    const input = [event("WORKING", "2026-09-12T10:00:00.000Z")];
    applyMemoryTtl(input, options);
    expect(input[0]?.lifecycle).toBe("active");
    expect(input[0]?.validUntil).toBeNull();
  });
});
