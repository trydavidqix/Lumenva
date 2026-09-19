import { describe, expect, it } from 'vitest';

import { runAutonomyPromotionWorkflow } from './promotion';

const evidence = {
  ref: 'eval-green',
  observedAt: '2026-09-10T10:00:00.000Z',
  policyCompliance: 1,
  failureRate: 0,
  loopStopRate: 0,
  p95LatencyMs: 500,
  avgCostCents: 1,
};
const thresholds = {
  maxEvidenceAgeMs: 86_400_000,
  minPolicyCompliance: 0.99,
  maxFailureRate: 0.01,
  maxLoopStopRate: 0.01,
};
const base = {
  evidence,
  nowMs: Date.parse('2026-09-10T10:30:00.000Z'),
  thresholds,
  actor: 'human' as const,
  currentLevel: 'shadow' as const,
  desiredLevel: 'draft' as const,
};

describe('F5-AUTONOMY-001', () => {
  it('allows one evidence-backed step and is deterministic', () => {
    const first = runAutonomyPromotionWorkflow(base);
    expect(first).toEqual({
      decision: { kind: 'allow', evidenceRef: 'eval-green' },
      authorization: { kind: 'allow', evidenceRef: 'eval-green' },
    });
    expect(runAutonomyPromotionWorkflow(base)).toEqual(first);
  });

  it.each([
    ['model actor', { actor: 'model' as const }, 'model_cannot_promote'],
    ['skip level', { currentLevel: 'shadow' as const, desiredLevel: 'assisted' as const }, 'invalid_promotion_transition'],
    ['autopilot', { currentLevel: 'assisted' as const, desiredLevel: 'autopilot_low_risk' as const }, 'phase5_autopilot_disabled'],
    ['stale evidence', { nowMs: Date.parse('2026-09-12T10:30:00.000Z') }, 'promotion_gate_denied'],
  ])('denies %s explicitly', (_name, override, reason) => {
    const result = runAutonomyPromotionWorkflow({ ...base, ...override });
    expect(result.authorization.kind).toBe('deny');
    expect(result.authorization).toMatchObject({ reason });
  });
});
