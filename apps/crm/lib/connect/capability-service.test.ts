import { describe, expect, it } from "vitest";
import { resolveConnectCapability } from "./capability-service";

describe("Connect capability resolution", () => {
  const base = {
    provider: "nuvemshop",
    capability: "getOrders" as const,
    providerSupports: true,
    connectionAuthenticated: true,
    countryDecision: { status: "ALLOW" as const, evidenceRefs: ["country"] },
    health: { provider: "nuvemshop", status: "healthy" as const, checkedAt: "2026-09-13T00:00:00Z", evidenceRefs: ["health"], retryable: false },
  };

  it("allows only when provider, auth, country and health all permit", () => {
    expect(resolveConnectCapability(base).available).toBe(true);
  });

  it.each(["UNKNOWN", "DENY", "REVIEW_REQUIRED"] as const)("never advertises %s country status as executable", (status) => {
    const result = resolveConnectCapability({ ...base, countryDecision: { status, evidenceRefs: [status] } });
    expect(result.available).toBe(false);
  });

  it("blocks when authentication is missing even if provider declares the verb", () => {
    expect(resolveConnectCapability({ ...base, connectionAuthenticated: false }).available).toBe(false);
  });
});
