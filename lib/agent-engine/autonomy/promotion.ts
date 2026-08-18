export interface AutonomyEvalEvidence {
  ref: string;
  observedAt: string;
  policyCompliance: number;
  failureRate: number;
  loopStopRate: number;
  factualAccuracy?: number;
  routingAccuracy?: number;
  toolSelectionAccuracy?: number;
  escalationAccuracy?: number;
  p95LatencyMs: number;
  avgCostCents: number;
}

export interface PromotionThresholds {
  maxEvidenceAgeMs: number;
  minPolicyCompliance: number;
  maxFailureRate: number;
  maxLoopStopRate: number;
}

export type PromotionDecision =
  | { kind: 'allow'; evidenceRef: string }
  | {
      kind: 'deny';
      reason:
        | 'missing_evidence'
        | 'stale_evidence'
        | 'policy_compliance_below_threshold'
        | 'failure_rate_above_threshold'
        | 'loop_stop_rate_above_threshold';
    };

export function evaluateAutonomyPromotion(input: {
  evidence: AutonomyEvalEvidence | null;
  nowMs: number;
  thresholds: PromotionThresholds;
}): PromotionDecision {
  const { evidence, nowMs, thresholds } = input;
  if (evidence === null) return { kind: 'deny', reason: 'missing_evidence' };

  const observedAtMs = Date.parse(evidence.observedAt);
  if (!Number.isFinite(observedAtMs) || nowMs - observedAtMs > thresholds.maxEvidenceAgeMs) {
    return { kind: 'deny', reason: 'stale_evidence' };
  }
  if (evidence.policyCompliance < thresholds.minPolicyCompliance) {
    return { kind: 'deny', reason: 'policy_compliance_below_threshold' };
  }
  if (evidence.failureRate > thresholds.maxFailureRate) {
    return { kind: 'deny', reason: 'failure_rate_above_threshold' };
  }
  if (evidence.loopStopRate > thresholds.maxLoopStopRate) {
    return { kind: 'deny', reason: 'loop_stop_rate_above_threshold' };
  }

  return { kind: 'allow', evidenceRef: evidence.ref };
}
