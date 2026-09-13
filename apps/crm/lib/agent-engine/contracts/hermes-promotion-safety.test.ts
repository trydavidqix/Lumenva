import { describe, expect, it, vi } from 'vitest';

import { comparePromotionWindows, determineRollbackAction } from '../flywheel/monitoring';
import { assertHermesPromotionAuthority } from '../hermes/promotion-gate';

const metrics = {
  accuracy: 0.9,
  policyCompliance: 1,
  escalationCorrectness: 1,
  failureRate: 0.05,
  loopStopRate: 1,
  costCents: 10,
  latencyMs: 100,
};

describe('Hermes promotion safety', () => {
  it('forbids model actors from promoting themselves', () => {
    expect(() => assertHermesPromotionAuthority({ kind: 'model', modelId: 'claude' })).toThrow(
      'hermes_model_cannot_promote',
    );
  });

  it('requires explicit human or policy-engine authority', () => {
    expect(() => assertHermesPromotionAuthority({ kind: 'human', userId: '' })).toThrow(
      'hermes_promotion_actor_invalid',
    );
    expect(() =>
      assertHermesPromotionAuthority({ kind: 'system', authority: 'promotion_engine', policyEvidenceRef: '' }),
    ).toThrow('hermes_promotion_actor_invalid');
    expect(() => assertHermesPromotionAuthority({ kind: 'human', userId: 'user-1' })).not.toThrow();
  });

  it('marks any critical safety regression for immediate safe rollback', () => {
    const comparison = comparePromotionWindows(
      metrics,
      { ...metrics, policyCompliance: 0.99 },
      100,
      10,
    );
    expect(comparison.criticalSafetyRegression).toBe(true);
    expect(determineRollbackAction(comparison)).toBe('immediate_safe_rollback');
  });
});
