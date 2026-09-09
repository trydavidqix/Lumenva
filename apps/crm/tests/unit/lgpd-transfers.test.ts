import { describe, expect, it } from "vitest";
import { evaluateTransfer, transferGateMode } from "@/lib/lgpd/transfer-gate";
describe("RGPD J5 transfer gate", () => {
  it("is off by default and does not block cataloging", () => { expect(transferGateMode("invalid")).toBe("off"); expect(evaluateTransfer({ eee: false, safeguards: "unknown" }).blocked).toBe(false); });
  it("allows EEE and valid SCC/BCR", () => { expect(evaluateTransfer({ eee: true, safeguards: "none", mode: "block" }).blocked).toBe(false); expect(evaluateTransfer({ eee: false, safeguards: "scc", mode: "block" }).compliant).toBe(true); });
  it("alerts in observe and blocks only in block mode", () => { expect(evaluateTransfer({ eee: false, safeguards: "none", mode: "observe" })).toMatchObject({ alert: true, blocked: false }); expect(evaluateTransfer({ eee: false, safeguards: "none", mode: "block" }).blocked).toBe(true); });
});
