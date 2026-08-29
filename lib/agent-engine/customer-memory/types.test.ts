import { describe, expect, it } from "vitest";

import { CustomerQuickMemorySchema } from "./types";

const base = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  contactId: "22222222-2222-4222-8222-222222222222",
  identity: {
    displayName: "Ana",
    primaryPhone: "+351910000000",
  },
  addresses: [],
  preferences: [],
  habitualOrders: [],
  recentOrderRefs: [],
  relationshipSummary: null,
  channelFacts: [],
  importantEvents: [],
  updatedAt: "2026-08-24T12:00:00.000Z",
};

describe("CustomerQuickMemorySchema", () => {
  it("exige organizationId e contactId válidos", () => {
    expect(CustomerQuickMemorySchema.safeParse(base).success).toBe(true);
    expect(CustomerQuickMemorySchema.safeParse({ ...base, organizationId: "org-a" }).success).toBe(
      false,
    );
  });

  it("limita coleções para impedir quick memory sem teto", () => {
    const tooManyPreferences = Array.from({ length: 21 }, (_, index) => ({
      value: `pref-${index}`,
      source: "conversation_derived",
      confidence: 0.9,
      confirmed: false,
      conflicted: false,
      actionable: true,
      validFrom: "2026-08-24T00:00:00.000Z",
      validUntil: null,
      sourceRef: null,
    }));

    expect(
      CustomerQuickMemorySchema.safeParse({ ...base, preferences: tooManyPreferences }).success,
    ).toBe(false);
  });

  it("rejeita confidence fora de 0..1 e resumo excessivo", () => {
    const invalidFact = {
      value: "sem glúten",
      source: "conversation_derived",
      confidence: 2,
      confirmed: false,
      conflicted: false,
      actionable: false,
      validFrom: "2026-08-24T00:00:00.000Z",
      validUntil: null,
      sourceRef: null,
    };
    expect(CustomerQuickMemorySchema.safeParse({ ...base, preferences: [invalidFact] }).success).toBe(
      false,
    );
    expect(
      CustomerQuickMemorySchema.safeParse({ ...base, relationshipSummary: "x".repeat(2001) }).success,
    ).toBe(false);
  });
});
