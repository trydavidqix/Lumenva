import { describe, expect, it } from "vitest";

import { evaluateCountryCapability, type ProviderCountryCapabilityEvidence } from "./country-capabilities";

const NOW = new Date("2026-09-13T12:00:00.000Z");

function evidence(
  status: ProviderCountryCapabilityEvidence["status"],
  overrides: Partial<ProviderCountryCapabilityEvidence> = {},
): ProviderCountryCapabilityEvidence {
  return {
    provider: "tiktok",
    country: "PT",
    capability: "publish_video",
    status,
    requirements: [],
    termsVersion: "2026-09",
    lastVerifiedAt: "2026-09-13T10:00:00.000Z",
    source: "provider_docs",
    evidenceRefs: ["docs:tiktok:publish"],
    ...overrides,
  };
}

describe("country capability gate", () => {
  it("never upgrades unknown evidence to ALLOW", () => {
    expect(evaluateCountryCapability({ records: [], now: NOW }).status).toBe("UNKNOWN");
    expect(evaluateCountryCapability({ records: [evidence("UNKNOWN")], now: NOW }).status).toBe(
      "UNKNOWN",
    );
  });

  it("gives DENY precedence over review and allow evidence", () => {
    const decision = evaluateCountryCapability({
      records: [evidence("ALLOW"), evidence("REVIEW_REQUIRED"), evidence("DENY")],
      now: NOW,
    });

    expect(decision.status).toBe("DENY");
    expect(decision.ruleIds).toContain("country_capability.explicit_deny");
  });

  it("gives REVIEW_REQUIRED precedence over ALLOW", () => {
    expect(
      evaluateCountryCapability({ records: [evidence("ALLOW"), evidence("REVIEW_REQUIRED")], now: NOW })
        .status,
    ).toBe("REVIEW_REQUIRED");
  });

  it("degrades stale allow evidence according to policy", () => {
    const stale = evidence("ALLOW", { lastVerifiedAt: "2026-01-01T00:00:00.000Z" });

    expect(
      evaluateCountryCapability({
        records: [stale],
        now: NOW,
        maxAgeMs: 24 * 60 * 60 * 1000,
        staleDecision: "UNKNOWN",
      }).status,
    ).toBe("UNKNOWN");

    expect(
      evaluateCountryCapability({
        records: [stale],
        now: NOW,
        maxAgeMs: 24 * 60 * 60 * 1000,
        staleDecision: "REVIEW_REQUIRED",
      }).status,
    ).toBe("REVIEW_REQUIRED");
  });

  it("retains evidence refs and requirements in the decision", () => {
    const decision = evaluateCountryCapability({
      records: [evidence("ALLOW", { requirements: ["business_account"], evidenceRefs: ["terms:v4"] })],
      now: NOW,
    });

    expect(decision.status).toBe("ALLOW");
    expect(decision.requirements).toEqual(["business_account"]);
    expect(decision.evidenceRefs).toEqual(["terms:v4"]);
  });
});
