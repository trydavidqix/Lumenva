import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { redactMemoryEvent, type PiiHash } from "./redaction";
import type { MemoryEvent } from "./context-compiler";

const event: MemoryEvent = {
  recordId: "pii-1",
  kind: "EPISODIC",
  organizationId: "org-a",
  subject: "contact:ana",
  scope: "company:org-a",
  authority: 2,
  confidence: 0.9,
  observedAt: "2026-09-12T10:00:00.000Z",
  validUntil: null,
  lifecycle: "active",
  content: "Ana: ana.silva@example.com, +351 912 345 678, CPF 529.982.247-25",
};

describe("redação de PII antes da gravação", () => {
  it("mascara email, telefone e CPF e mantém hashes originais para auditoria", () => {
    const result = redactMemoryEvent(event);

    expect(result.content).not.toContain("ana.silva@example.com");
    expect(result.content).not.toContain("+351 912 345 678");
    expect(result.content).not.toContain("529.982.247-25");
    expect(result.content).toContain("[EMAIL_REDACTED]");
    expect(result.content).toContain("[PHONE_REDACTED]");
    expect(result.content).toContain("[CPF_REDACTED]");

    expect(result.piiHashes).toEqual(expect.arrayContaining([
      { type: "email", hash: createHash("sha256").update("ana.silva@example.com").digest("hex") },
      { type: "phone", hash: createHash("sha256").update("+351 912 345 678").digest("hex") },
      { type: "cpf", hash: createHash("sha256").update("529.982.247-25").digest("hex") },
    ] satisfies PiiHash[]));
    expect(event.content).toContain("ana.silva@example.com");
  });
});
