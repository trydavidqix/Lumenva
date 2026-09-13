import { describe, expect, it } from 'vitest';

import { combineEvidenceStates, evidenceStatePasses } from '../hermes/evidence-state';
import {
  transferredEvidenceRequiresRetest,
  validateCandidateWithEvidence,
  type CandidateMetrics,
  type CandidateEvalEvidence,
} from '../flywheel/validator';

const baseline: CandidateMetrics = {
  accuracy: 0.8,
  policyCompliance: 1,
  escalationCorrectness: 0.9,
  failureRate: 0.1,
  loopStopRate: 1,
  costCents: 10,
  latencyMs: 1000,
};
const better: CandidateMetrics = {
  accuracy: 0.9,
  policyCompliance: 1,
  escalationCorrectness: 0.95,
  failureRate: 0.05,
  loopStopRate: 1,
  costCents: 9,
  latencyMs: 900,
};

function ports(overrides?: { safety?: boolean; safetyRef?: string }) {
  return {
    async runRegression() { return { passed: true, evidenceRef: 'reg:current' }; },
    async runGolden() { return { passed: true, evidenceRef: 'golden:current' }; },
    async evaluateMetrics(_ref: string, isBaseline: boolean) { return isBaseline ? baseline : better; },
    async checkSafety() { return { passed: overrides?.safety ?? true, evidenceRef: overrides?.safetyRef ?? 'safe:current' }; },
    async runShadow() { return { passed: true, evidenceRef: 'shadow:current' }; },
    async runBusiness() { return { passed: true, evidenceRef: 'business:kpi-up' }; },
    async runCostLatency() { return { passed: true, evidenceRef: 'cost:current' }; },
  };
}

describe('Hermes explicit evidence states', () => {
  it('treats only explicit PASS as pass', () => {
    expect(evidenceStatePasses('PASS')).toBe(true);
    expect(evidenceStatePasses('FAIL')).toBe(false);
    expect(evidenceStatePasses('NOT_EXECUTED')).toBe(false);
    expect(evidenceStatePasses('NOT_PROVEN')).toBe(false);
    expect(evidenceStatePasses('BLOCKED')).toBe(false);
  });

  it('never upgrades missing or blocked evidence to PASS', () => {
    expect(combineEvidenceStates(['PASS', 'NOT_PROVEN'])).toBe('NOT_PROVEN');
    expect(combineEvidenceStates(['PASS', 'BLOCKED'])).toBe('BLOCKED');
    expect(combineEvidenceStates(['PASS', 'FAIL'])).toBe('FAIL');
    expect(combineEvidenceStates([])).toBe('NOT_EXECUTED');
  });

  it('downgrades transferred PASS to NOT_PROVEN until the new candidate is retested', () => {
    const transferred: CandidateEvalEvidence = {
      suite: 'safety',
      state: 'PASS',
      evidenceRef: 'old-candidate:safety',
      reason: null,
    };
    expect(transferredEvidenceRequiresRetest(transferred)).toEqual({
      ...transferred,
      state: 'NOT_PROVEN',
      reason: 'transferred_evidence_requires_retest',
    });
  });

  it('requires a current evidence ref even when a suite says it passed', async () => {
    const result = await validateCandidateWithEvidence(
      'candidate:new',
      ports({ safety: true, safetyRef: '' }),
      ['regression', 'golden', 'safety'],
    );
    expect(result.passed).toBe(false);
    expect(result.evidence.find((item) => item.suite === 'safety')?.state).toBe('NOT_PROVEN');
  });

  it('does not let business KPI evidence bypass a safety failure', async () => {
    const result = await validateCandidateWithEvidence(
      'candidate:new',
      ports({ safety: false }),
      ['regression', 'golden', 'safety', 'business'],
    );
    expect(result.evidence.find((item) => item.suite === 'business')?.state).toBe('PASS');
    expect(result.evidence.find((item) => item.suite === 'safety')?.state).toBe('FAIL');
    expect(result.passed).toBe(false);
  });
});
