import { describe, expect, it } from "vitest";

import { evaluateCommercialCompliance } from "./compliance";

const base = {
  editorial: { passed: true, evidenceRefs: ["editorial:gate:1"] },
  capability: {
    status: "ALLOW" as const,
    evidenceRefs: ["provider:terms:v4"],
  },
  prohibitedClaims: [] as string[],
  commercialDisclosurePresent: true,
  aiDisclosureRequired: false,
  aiDisclosurePresent: false,
  identityLikenessAuthorized: true,
  evidenceRefs: ["asset:rights:1"],
};

describe("commercial compliance gate", () => {
  it.each([
    ["failed editorial quality", { editorial: { passed: false, evidenceRefs: ["editorial:failed"] } }],
    ["prohibited claim", { prohibitedClaims: ["guaranteed cure"] }],
    ["missing commercial disclosure", { commercialDisclosurePresent: false }],
    ["identity restriction", { identityLikenessAuthorized: false }],
    ["country/provider denial", { capability: { status: "DENY" as const, evidenceRefs: ["country:deny"] } }],
  ])("blocks %s", (_label, patch) => {
    const result = evaluateCommercialCompliance({ ...base, ...patch });
    expect(result.status).toBe("BLOCK");
    expect(result.ruleIds.length).toBeGreaterThan(0);
    expect(result.evidenceRefs.length).toBeGreaterThan(0);
  });

  it("requires review for unresolved country/provider capability", () => {
    expect(
      evaluateCommercialCompliance({
        ...base,
        capability: { status: "UNKNOWN", evidenceRefs: ["capability:unknown"] },
      }).status,
    ).toBe("REVIEW_REQUIRED");

    expect(
      evaluateCommercialCompliance({
        ...base,
        capability: { status: "REVIEW_REQUIRED", evidenceRefs: ["capability:review"] },
      }).status,
    ).toBe("REVIEW_REQUIRED");
  });

  it("requires an AI disclosure when policy says it is required", () => {
    const result = evaluateCommercialCompliance({
      ...base,
      aiDisclosureRequired: true,
      aiDisclosurePresent: false,
    });

    expect(result.status).toBe("BLOCK");
    expect(result.ruleIds).toContain("commerce_compliance.ai_disclosure_missing");
  });

  it("passes only when all deterministic gates pass", () => {
    const result = evaluateCommercialCompliance(base);

    expect(result.status).toBe("PASS");
    expect(result.ruleIds).toContain("commerce_compliance.passed");
    expect(result.evidenceRefs).toEqual(
      expect.arrayContaining(["editorial:gate:1", "provider:terms:v4", "asset:rights:1"]),
    );
  });

  it("does not allow a model override to bypass a hard block", () => {
    const result = evaluateCommercialCompliance({
      ...base,
      prohibitedClaims: ["unsupported performance claim"],
      modelRecommendation: "PASS",
    });

    expect(result.status).toBe("BLOCK");
  });
});
