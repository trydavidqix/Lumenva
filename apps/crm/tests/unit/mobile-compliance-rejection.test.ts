import { describe, expect, it } from "vitest";
import { classifyStoreRejection } from "@/lib/product-factory/mobile-compliance";

describe("store rejection recovery", () => {
  it("chooses FIX when implementation contradicts a matched policy", () => {
    expect(classifyStoreRejection({ store: "APP_STORE", message: "account deletion missing", matchedRuleId: "APPLE.ACCOUNT.DELETE", implementationContradictsRule: true })).toBe("FIX");
  });
  it("chooses APPEAL only when evidence supports compliance", () => {
    expect(classifyStoreRejection({ store: "PLAY_STORE", message: "policy issue", matchedRuleId: "GOOGLE.DATA_SAFETY", evidenceSupportsCompliance: true })).toBe("APPEAL");
  });
  it("requests interpretation for ambiguous unmatched rejection text", () => {
    expect(classifyStoreRejection({ store: "APP_STORE", message: "unclear", messageIsAmbiguous: true })).toBe("REQUEST_INTERPRETATION");
  });
});
