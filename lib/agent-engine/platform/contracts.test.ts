import { describe, expect, it } from "vitest";

import {
  authorityDomainSchema,
  featureModeSchema,
  memoryRiskSchema,
  projectionEnvelopeSchema,
} from "./contracts";

const validEnvelope = {
  eventId: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  entityType: "contact",
  entityId: "00000000-0000-4000-8000-000000000003",
  sourceType: "event_log",
  sourceId: "00000000-0000-4000-8000-000000000004",
  sourceVersion: "2",
  occurredAt: "2026-08-10T12:00:00.000Z",
  projectionType: "memory",
  projectionVersion: 1,
  idempotencyKey: "memory:contact:3:v2",
  payload: { category: "customer_preference" },
};

describe("AI Platform contracts", () => {
  it("accepts only the canonical rollout, risk and authority values", () => {
    expect(featureModeSchema.parse("shadow")).toBe("shadow");
    expect(memoryRiskSchema.parse("high")).toBe("high");
    expect(authorityDomainSchema.parse("consent")).toBe("consent");
    expect(() => featureModeSchema.parse("enabled")).toThrow();
    expect(() => memoryRiskSchema.parse("critical")).toThrow();
  });

  it("validates a projection envelope with trusted tenant identity", () => {
    expect(projectionEnvelopeSchema.parse(validEnvelope)).toMatchObject(validEnvelope);
    expect(() => projectionEnvelopeSchema.parse({ ...validEnvelope, organizationId: "" })).toThrow();
    expect(() => projectionEnvelopeSchema.parse({ ...validEnvelope, projectionType: "unknown" })).toThrow();
    expect(() => projectionEnvelopeSchema.parse({ ...validEnvelope, idempotencyKey: "" })).toThrow();
  });
});
