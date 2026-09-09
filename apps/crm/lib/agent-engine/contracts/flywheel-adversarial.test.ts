import { describe, expect, it } from 'vitest';
import { clusterLearningSignals } from '../flywheel/clustering';
import { buildRoutingCandidate } from '../flywheel/candidates';
import { validateCandidate } from '../flywheel/validator';
import { comparePromotionWindows, determineRollbackAction } from '../flywheel/monitoring';
import type { CandidateMetrics } from '../flywheel/validator';

const scope = { organizationId: 'org-1', agentId: 'agent-1', capabilityId: 'cap-1' };
const signal = (id: string, organizationId = 'org-1') => ({ id, scope: { ...scope, organizationId }, kind: 'eval_failure' as const, fingerprint: 'failure-a', confidence: 0.9, impact: 0.9, observedAt: '2026-08-18T10:00:00.000Z', evidenceRef: `evidence:${id}`, redactedSummary: null });
const thresholds = { minOccurrences: 2, minConfidence: 0.5, minImpact: 0.5, windowMs: 60_000 };
const metrics: CandidateMetrics = { accuracy: 0.8, policyCompliance: 1, escalationCorrectness: 1, failureRate: 0.1, loopStopRate: 1, costCents: 10, latencyMs: 1000 };

describe('Phase 6 adversarial invariants', () => {
  it('filters one-off evidence and cross-tenant contamination', () => {
    expect(clusterLearningSignals([signal('1')], thresholds, Date.parse('2026-08-18T10:00:10.000Z'))).toHaveLength(0);
    expect(clusterLearningSignals([signal('1'), signal('2', 'org-2')], thresholds, Date.parse('2026-08-18T10:00:10.000Z'))).toHaveLength(0);
  });

  it('denies uncertified routing', () => {
    const lookup = { assertCertified() { throw new Error('flywheel_routing_not_certified'); } };
    expect(() => buildRoutingCandidate({ provider: 'x', model: 'y', skillVersionId: null, lookup })).toThrow('flywheel_routing_not_certified');
  });

  it('does not trade safety for quality', async () => {
    const ports = {
      async runRegression() { return { passed: true, evidenceRef: 'r' }; }, async runGolden() { return { passed: true, evidenceRef: 'g' }; },
      async evaluateMetrics(_r: string, baseline: boolean) { return baseline ? metrics : { ...metrics, accuracy: 0.95, policyCompliance: 0.9 }; },
      async checkSafety() { return { passed: false, evidenceRef: 's' }; }, async runShadow() { return { passed: true, evidenceRef: 'sh' }; },
    };
    expect((await validateCandidate('candidate:1', ports)).passed).toBe(false);
  });

  it('distinguishes critical rollback from non-critical recommendation', () => {
    const critical = comparePromotionWindows(metrics, { ...metrics, policyCompliance: 0.9 }, 20, 10);
    const quality = comparePromotionWindows(metrics, { ...metrics, accuracy: 0.7 }, 20, 10);
    expect(determineRollbackAction(critical)).toBe('immediate_safe_rollback');
    expect(determineRollbackAction(quality)).toBe('recommend_rollback');
  });
});
