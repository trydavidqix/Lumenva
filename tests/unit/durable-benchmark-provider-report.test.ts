import { describe, expect, it } from 'vitest';

import {
  blockedPhase7ProviderReport,
  buildPhase7ProviderReport,
  PHASE_7_PROFILE_COUNTS,
} from '@/lib/agent-engine/durable-benchmark/provider-report';
import type { DurableBenchmarkRunResult } from '@/lib/agent-engine/durable-benchmark/contracts';

const dimensions = {
  reliability: 100,
  durability: 100,
  observability: 100,
  operationalSimplicity: 50,
  performance: 50,
  cost: 50,
  maintainability: 50,
};

function makeRun(index: number): DurableBenchmarkRunResult {
  return {
    engineId: 'current',
    scenarioId: 'happy_path',
    scenarioVersion: '7.0.0',
    organizationId: 'bench-org-a',
    runId: `run-${index}`,
    terminalState: 'completed',
    lifecycle: [{ seq: 1, kind: 'completed', atMs: 0, evidence: 'synthetic' }],
    retryCount: 0,
    approvalRequired: false,
    approvalSatisfied: false,
    resumedFromExpectedStep: true,
    effectAttempts: 1,
    committedEffects: 1,
    recoveredAfterCrash: false,
    crossTenantViolation: false,
    durationMs: 1,
    engineVersion: 'test',
  };
}

describe('Phase 7 provider report', () => {
  it('enforces the canonical profile counts before reporting PASS', () => {
    expect(PHASE_7_PROFILE_COUNTS).toEqual({ small: 8, medium: 40, stress: 160 });

    const runs = Array.from({ length: 208 }, (_, index) => makeRun(index));
    const report = buildPhase7ProviderReport({
      engineId: 'current',
      runs,
      suiteCounts: PHASE_7_PROFILE_COUNTS,
      realEvidence: true,
      scoreDimensions: dimensions,
    });

    expect(report.status).toBe('PASS');
    expect(report.score?.engineId).toBe('current');
    expect(report.realEvidence).toBe(true);
  });

  it('fails closed for incomplete canonical counts', () => {
    expect(() => buildPhase7ProviderReport({
      engineId: 'current',
      runs: [],
      suiteCounts: { small: 8, medium: 39, stress: 160 },
      realEvidence: true,
      scoreDimensions: dimensions,
    })).toThrow(/suite_count/i);
  });

  it('represents unavailable providers as BLOCKED without fabricated evidence', () => {
    const report = blockedPhase7ProviderReport({
      engineId: 'vercel_workflow',
      reason: 'real_vercel_workflow_runtime_unavailable',
    });

    expect(report.status).toBe('BLOCKED');
    expect(report.realEvidence).toBe(false);
    expect(report.runs).toHaveLength(0);
    expect(report.score).toBeUndefined();
    expect(report.reason).toBe('real_vercel_workflow_runtime_unavailable');
  });
});
