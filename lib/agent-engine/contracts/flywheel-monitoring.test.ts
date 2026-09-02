import { describe, expect, it } from 'vitest';
import { comparePromotionWindows, determineRollbackAction } from '../flywheel/monitoring';
import type { CandidateMetrics } from '../flywheel/validator';

const baseline: CandidateMetrics = { accuracy: 0.8, policyCompliance: 1, escalationCorrectness: 0.9, failureRate: 0.1, loopStopRate: 1, costCents: 10, latencyMs: 1000 };

describe('Phase 6 promotion monitoring', () => {
  it('returns insufficient sample without a rollback conclusion', () => {
    const comparison = comparePromotionWindows(baseline, baseline, 4, 10);
    expect(comparison.verdict).toBe('insufficient_sample');
    expect(determineRollbackAction(comparison)).toBe('none');
  });

  it('requires immediate safe rollback for critical safety regression', () => {
    const current = { ...baseline, policyCompliance: 0.9 };
    const comparison = comparePromotionWindows(baseline, current, 20, 10);
    expect(comparison.criticalSafetyRegression).toBe(true);
    expect(determineRollbackAction(comparison)).toBe('immediate_safe_rollback');
  });

  it('recommends rollback for non-critical quality/cost/latency degradation', () => {
    const current = { ...baseline, accuracy: 0.75, costCents: 15, latencyMs: 1500 };
    const comparison = comparePromotionWindows(baseline, current, 20, 10);
    expect(comparison.verdict).toBe('regressed');
    expect(determineRollbackAction(comparison)).toBe('recommend_rollback');
  });

  it('keeps stable or better candidates', () => {
    const comparison = comparePromotionWindows(baseline, { ...baseline, accuracy: 0.85, costCents: 9 }, 20, 10);
    expect(['better', 'neutral']).toContain(comparison.verdict);
    expect(determineRollbackAction(comparison)).toBe('none');
  });
});
