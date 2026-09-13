import { describe, expect, it } from "vitest";
import { normalizeProviderHealth } from "./health";

describe("provider health", () => {
  it("keeps auth expiry distinct from generic unavailability", () => {
    expect(normalizeProviderHealth({ provider: "x", reachable: true, authenticated: false, degraded: false, evidenceRefs: ["auth"] }).status).toBe("auth_expired");
  });
  it("returns unknown when no observation is available", () => {
    expect(normalizeProviderHealth({ provider: "x", reachable: null, authenticated: null, degraded: null, evidenceRefs: [] }).status).toBe("unknown");
  });
});
