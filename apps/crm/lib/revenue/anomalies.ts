export interface RevenueAnomalyThresholds {
  refundRateBps: number;
  revenueDropBps: number;
  commissionReversalBps: number;
  payoutMismatchMinor: number;
  attributionGapBps: number;
}

export interface RevenueAnomalyInput {
  organizationId: string;
  grossRevenueMinor: number;
  previousGrossRevenueMinor: number;
  refundsMinor: number;
  commissionReversalsMinor: number;
  expectedPayoutMinor: number;
  observedPayoutMinor: number;
  attributedRevenueMinor: number;
  thresholds: RevenueAnomalyThresholds;
}

export type RevenueAnomalyKind =
  | "refund_spike"
  | "commission_reversal_spike"
  | "revenue_drop"
  | "payout_mismatch"
  | "attribution_gap";

export interface RevenueAnomalyFinding {
  organizationId: string;
  kind: RevenueAnomalyKind;
  severity: "warning" | "critical";
  evidence: Array<{ key: string; value: number }>;
  autoMutationAllowed: false;
}

const bps = (part: number, whole: number): number => whole > 0 ? Math.round((part * 10_000) / whole) : 0;

export function detectRevenueAnomalies(input: RevenueAnomalyInput): RevenueAnomalyFinding[] {
  const findings: RevenueAnomalyFinding[] = [];
  const add = (kind: RevenueAnomalyKind, severity: "warning" | "critical", evidence: Array<{ key: string; value: number }>) => {
    findings.push({ organizationId: input.organizationId, kind, severity, evidence, autoMutationAllowed: false });
  };
  const refundRate = bps(input.refundsMinor, input.grossRevenueMinor);
  if (refundRate >= input.thresholds.refundRateBps) add("refund_spike", "critical", [{ key: "refund_rate_bps", value: refundRate }]);

  const reversalRate = bps(input.commissionReversalsMinor, input.grossRevenueMinor);
  if (reversalRate >= input.thresholds.commissionReversalBps) add("commission_reversal_spike", "warning", [{ key: "commission_reversal_bps", value: reversalRate }]);

  const revenueDrop = input.previousGrossRevenueMinor > input.grossRevenueMinor
    ? bps(input.previousGrossRevenueMinor - input.grossRevenueMinor, input.previousGrossRevenueMinor)
    : 0;
  if (revenueDrop >= input.thresholds.revenueDropBps) add("revenue_drop", "critical", [{ key: "revenue_drop_bps", value: revenueDrop }]);

  const payoutDelta = Math.abs(input.expectedPayoutMinor - input.observedPayoutMinor);
  if (payoutDelta >= input.thresholds.payoutMismatchMinor) add("payout_mismatch", "warning", [{ key: "payout_delta_minor", value: payoutDelta }]);

  const attributionGap = input.grossRevenueMinor > input.attributedRevenueMinor
    ? bps(input.grossRevenueMinor - input.attributedRevenueMinor, input.grossRevenueMinor)
    : 0;
  if (attributionGap >= input.thresholds.attributionGapBps) add("attribution_gap", "warning", [{ key: "attribution_gap_bps", value: attributionGap }]);

  return findings;
}
