import { describe, expect, it } from 'vitest';
import { validateCandidate, type CandidateMetrics } from '../flywheel/validator';

const baseline: CandidateMetrics = { accuracy: 0.8, policyCompliance: 1, escalationCorrectness: 0.9, failureRate: 0.1, loopStopRate: 1, costCents: 10, latencyMs: 1000 };
const better: CandidateMetrics = { accuracy: 0.9, policyCompliance: 1, escalationCorrectness: 0.95, failureRate: 0.05, loopStopRate: 1, costCents: 9, latencyMs: 900 };

function ports(candidateMetrics: CandidateMetrics, overrides: Partial<Record<'regression' | 'golden' | 'safety' | 'shadow', boolean>> = {}) {
  return {
    async runRegression() { return { passed: overrides.regression ?? true, evidenceRef: 'reg:1' }; },
    async runGolden() { return { passed: overrides.golden ?? true, evidenceRef: 'golden:1' }; },
    async evaluateMetrics(_ref: string, isBaseline: boolean) { return isBaseline ? baseline : candidateMetrics; },
    async checkSafety() { return { passed: overrides.safety ?? true, evidenceRef: 'safe:1' }; },
    async runShadow() { return { passed: overrides.shadow ?? true, evidenceRef: 'shadow:1' }; },
  };
}

describe('Phase 6 layered validator', () => {
  it('passes a better candidate with no safety regression', async () => {
    expect((await validateCandidate('candidate:1', ports(better))).passed).toBe(true);
  });

  it('fails a cheaper but less accurate candidate', async () => {
    const result = await validateCandidate('candidate:1', ports({ ...better, accuracy: 0.7, costCents: 5 }));
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('accuracy_regression');
  });

  it('fails safety or golden regressions even when other metrics improve', async () => {
    expect((await validateCandidate('candidate:1', ports(better, { safety: false }))).passed).toBe(false);
    expect((await validateCandidate('candidate:1', ports(better, { golden: false }))).passed).toBe(false);
  });

  it('fails deterministic regression even when metrics improve', async () => {
    expect((await validateCandidate('candidate:1', ports(better, { regression: false }))).passed).toBe(false);
  });
});
