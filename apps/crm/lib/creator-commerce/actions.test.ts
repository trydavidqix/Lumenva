import { describe, expect, it } from "vitest";
import { classifyCreatorCommerceAction, decideCreatorCommerceAction } from "./actions";

describe("Creator Commerce action governance", () => {
  it("classifies reversible local writes as r1", () => {
    expect(classifyCreatorCommerceAction("creator.upsert")).toBe("r1_reversible_write");
    expect(classifyCreatorCommerceAction("experiment.create")).toBe("r1_reversible_write");
  });

  it("classifies commercial publication as sensitive commercial", () => {
    expect(classifyCreatorCommerceAction("publication.request_commercial")).toBe("r3_sensitive_commercial");
  });

  it("requires approval for r3/r4 and never lets compliance block be bypassed", () => {
    expect(decideCreatorCommerceAction({ action: "publication.request_commercial", complianceStatus: "PASS", capabilityAvailable: true })).toMatchObject({ kind: "require_approval" });
    expect(decideCreatorCommerceAction({ action: "publication.request_commercial", complianceStatus: "BLOCK", capabilityAvailable: true })).toEqual({ kind: "deny", reason: "commerce_compliance_blocked" });
  });

  it("allows local r1 action only when capability is available", () => {
    expect(decideCreatorCommerceAction({ action: "creator.upsert", complianceStatus: "PASS", capabilityAvailable: true })).toEqual({ kind: "allow" });
    expect(decideCreatorCommerceAction({ action: "creator.upsert", complianceStatus: "PASS", capabilityAvailable: false })).toEqual({ kind: "deny", reason: "commerce_capability_unavailable" });
  });
});
