import { describe, expect, it } from "vitest";
import { detectRevenueAnomalies } from "./anomalies";

describe("revenue anomaly detection", () => {
  it("detects refund spikes, reversals, revenue drops, payout mismatches and attribution gaps", () => {
    const findings = detectRevenueAnomalies({
      organizationId: "org-a",
      grossRevenueMinor: 100_000,
      previousGrossRevenueMinor: 200_000,
      refundsMinor: 30_000,
      commissionReversalsMinor: 15_000,
      expectedPayoutMinor: 50_000,
      observedPayoutMinor: 40_000,
      attributedRevenueMinor: 60_000,
      thresholds: { refundRateBps: 2000, revenueDropBps: 3000, commissionReversalBps: 1000, payoutMismatchMinor: 5000, attributionGapBps: 2000 },
    });
    expect(findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining(["refund_spike", "commission_reversal_spike", "revenue_drop", "payout_mismatch", "attribution_gap"]));
    expect(findings.every((finding) => finding.evidence.length > 0)).toBe(true);
  });

  it("never mutates financial truth and returns no finding below thresholds", () => {
    const input = {
      organizationId: "org-a", grossRevenueMinor: 100_000, previousGrossRevenueMinor: 105_000, refundsMinor: 1000,
      commissionReversalsMinor: 0, expectedPayoutMinor: 10_000, observedPayoutMinor: 10_000, attributedRevenueMinor: 99_000,
      thresholds: { refundRateBps: 2000, revenueDropBps: 3000, commissionReversalBps: 1000, payoutMismatchMinor: 5000, attributionGapBps: 2000 },
    };
    expect(detectRevenueAnomalies(input)).toEqual([]);
    expect(input.grossRevenueMinor).toBe(100_000);
  });
});
