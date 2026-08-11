import { describe, expect, it } from "vitest";

import { NullMemoryPort } from "./port";
import type { SemanticMemoryRecord } from "./types";

const validRecord: SemanticMemoryRecord = {
  id: "memory-1",
  organizationId: "org-1",
  contactId: "contact-1",
  sourceId: "event-1",
  sourceVersion: "1",
  type: "preference",
  authorityDomain: "customer_preference",
  risk: "low",
  actionable: true,
  confidence: 0.9,
  validFrom: null,
  validUntil: null,
  text: "Prefere receber novidades por WhatsApp.",
};

describe("NullMemoryPort", () => {
  it("accepts a canonical memory record without retaining it", async () => {
    const port = new NullMemoryPort();

    await expect(port.upsert(validRecord, "memory:event-1:1")).resolves.toBeUndefined();
    await expect(port.deleteContact({ organizationId: "org-1", contactId: "contact-1" })).resolves.toBeUndefined();
    await expect(port.search({ organizationId: "org-1", contactId: "contact-1", query: "preferência", topK: 5 }))
      .resolves.toEqual([]);
  });

  it.each([
    ["confidence below zero", { confidence: -0.01 }],
    ["confidence above one", { confidence: 1.01 }],
    ["empty organization ID", { organizationId: "" }],
    ["empty contact ID", { contactId: "" }],
    ["empty source ID", { sourceId: "" }],
    ["unsupported memory type", { type: "payment_authorization" }],
  ])("rejects a record with %s", async (_caseName, overrides) => {
    const port = new NullMemoryPort();
    const invalidRecord = { ...validRecord, ...overrides } as unknown as SemanticMemoryRecord;

    await expect(port.upsert(invalidRecord, "memory:event-1:1")).rejects.toThrow();
  });

  it("reports that the disabled adapter is healthy without claiming provider health", async () => {
    const port = new NullMemoryPort();

    await expect(port.health()).resolves.toEqual({ ok: true, latencyMs: 0 });
  });
});
