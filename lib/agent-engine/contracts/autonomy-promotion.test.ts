import { describe, expect, it } from 'vitest';

import {
  evaluateAutonomyPromotion,
  type AutonomyEvalEvidence,
  type PromotionThresholds,
} from '../autonomy/promotion';

const thresholds: PromotionThresholds = {
  maxEvidenceAgeMs: 60_000,
  minPolicyCompliance: 0.99,
  maxFailureRate: 0.02,
  maxLoopStopRate: 0.05,
};

function evidence(overrides: Partial<AutonomyEvalEvidence> = {}): AutonomyEvalEvidence {
  return {
    ref: 'eval-1',
    observedAt: new Date(1_000_000).toISOString(),
    policyCompliance: 1,
    failureRate: 0.01,
    loopStopRate: 0.01,
    factualAccuracy: 0.98,
    routingAccuracy: 0.99,
    toolSelectionAccuracy: 0.99,
    escalationAccuracy: 0.99,
    p95LatencyMs: 900,
    avgCostCents: 3,
    ...overrides,
  };
}

describe('AutonomyPromotionGate', () => {
  it('fails closed when evidence is missing', () => {
    expect(evaluateAutonomyPromotion({ evidence: null, nowMs: 1_010_000, thresholds })).toEqual({
      kind: 'deny',
      reason: 'missing_evidence',
    });
  });

  it('rejects stale evidence', () => {
    expect(
      evaluateAutonomyPromotion({ evidence: evidence(), nowMs: 1_100_001, thresholds }),
    ).toEqual({ kind: 'deny', reason: 'stale_evidence' });
  });

  it('rejects policy compliance below threshold', () => {
    expect(
      evaluateAutonomyPromotion({
        evidence: evidence({ policyCompliance: 0.98 }),
        nowMs: 1_010_000,
        thresholds,
      }),
    ).toEqual({ kind: 'deny', reason: 'policy_compliance_below_threshold' });
  });

  it('rejects failure rate above threshold', () => {
    expect(
      evaluateAutonomyPromotion({
        evidence: evidence({ failureRate: 0.03 }),
        nowMs: 1_010_000,
        thresholds,
      }),
    ).toEqual({ kind: 'deny', reason: 'failure_rate_above_threshold' });
  });

  it('rejects loop-stop rate above threshold', () => {
    expect(
      evaluateAutonomyPromotion({
        evidence: evidence({ loopStopRate: 0.06 }),
        nowMs: 1_010_000,
        thresholds,
      }),
    ).toEqual({ kind: 'deny', reason: 'loop_stop_rate_above_threshold' });
  });

  it('allows promotion when deterministic thresholds pass', () => {
    expect(
      evaluateAutonomyPromotion({ evidence: evidence(), nowMs: 1_010_000, thresholds }),
    ).toEqual({ kind: 'allow', evidenceRef: 'eval-1' });
  });
});
