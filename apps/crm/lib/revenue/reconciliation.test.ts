import { describe, expect, it } from "vitest";
import { reconcileProviderFacts } from "./reconciliation";
import type { FinancialFact } from "./contracts";

const fact = (externalId: string, amountMinor = 1000): FinancialFact => ({
  id: externalId,
  organizationId: "org-a",
  provider: "nuvemshop",
  externalId,
  kind: "sale",
  amountMinor,
  currency: "EUR",
  occurredAt: "2026-09-13T00:00:00Z",
  evidence: {},
});

describe("provider reconciliation", () => {
  it("is replay safe for duplicate provider facts", () => {
    const result = reconcileProviderFacts({ organizationId: "org-a", providerFacts: [fact("1"), fact("1")] , existingFacts: [fact("1")] });
    expect(result.toInsert).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it("turns unknown side effect outcome into a reconciliation finding", () => {
    const result = reconcileProviderFacts({ organizationId: "org-a", providerFacts: [], existingFacts: [], unknownOutcomes: ["order-7"] });
    expect(result.findings[0]).toMatchObject({ kind: "unknown_outcome", externalId: "order-7", requiresReview: true });
  });

  it("does not overwrite provider corrections", () => {
    const result = reconcileProviderFacts({ organizationId: "org-a", providerFacts: [fact("1", 900)], existingFacts: [fact("1", 1000)] });
    expect(result.findings[0]?.kind).toBe("provider_correction");
    expect(result.toInsert[0]?.externalId).toContain("correction:");
  });
});
