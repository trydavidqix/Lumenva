import { describe, expect, it } from 'vitest';

import { validateDurableBenchmarkRunResult } from '@/lib/agent-engine/durable-benchmark/contracts';

const validResult = {
  engineId: 'current',
  scenarioId: 'happy_path',
  scenarioVersion: '7.0.0',
  organizationId: 'bench-org-a',
  runId: 'run-1',
  terminalState: 'completed',
  lifecycle: [
    { seq: 1, kind: 'started', atMs: 0, evidence: 'synthetic benchmark started' },
    { seq: 2, kind: 'completed', atMs: 10, evidence: 'synthetic benchmark completed' },
  ],
  retryCount: 0,
  approvalRequired: false,
  approvalSatisfied: false,
  resumedFromExpectedStep: true,
  effectAttempts: 1,
  committedEffects: 1,
  recoveredAfterCrash: false,
  crossTenantViolation: false,
  durationMs: 10,
};

describe('Phase 7 durable benchmark contracts', () => {
  it('accepts a valid normalized benchmark result', () => {
    expect(validateDurableBenchmarkRunResult(validResult)).toBe(true);
  });

  it('rejects unknown engine and scenario IDs', () => {
    expect(validateDurableBenchmarkRunResult({ ...validResult, engineId: 'other' })).toBe(false);
    expect(validateDurableBenchmarkRunResult({ ...validResult, scenarioId: 'other' })).toBe(false);
  });

  it('rejects blank run and organization identity', () => {
    expect(validateDurableBenchmarkRunResult({ ...validResult, runId: ' ' })).toBe(false);
    expect(validateDurableBenchmarkRunResult({ ...validResult, organizationId: '' })).toBe(false);
  });

  it('rejects negative counts and impossible committed effect counts', () => {
    expect(validateDurableBenchmarkRunResult({ ...validResult, retryCount: -1 })).toBe(false);
    expect(validateDurableBenchmarkRunResult({ ...validResult, effectAttempts: 0, committedEffects: 1 })).toBe(false);
  });

  it('rejects non-monotonic lifecycle sequence and malformed evidence', () => {
    expect(
      validateDurableBenchmarkRunResult({
        ...validResult,
        lifecycle: [
          { seq: 2, kind: 'started', atMs: 0, evidence: 'started' },
          { seq: 1, kind: 'completed', atMs: 1, evidence: 'completed' },
        ],
      }),
    ).toBe(false);

    expect(
      validateDurableBenchmarkRunResult({
        ...validResult,
        lifecycle: [{ seq: 1, kind: 'started', atMs: 0, evidence: ' ' }],
      }),
    ).toBe(false);
  });
});
