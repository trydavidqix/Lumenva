import { describe, expect, it } from 'vitest';

import { evaluateDurableBenchmarkHardGates } from '@/lib/agent-engine/durable-benchmark/hard-gates';
import type { DurableBenchmarkRunResult } from '@/lib/agent-engine/durable-benchmark/contracts';

const base: DurableBenchmarkRunResult = {
  engineId: 'current',
  scenarioId: 'happy_path',
  scenarioVersion: '7.0.0',
  organizationId: 'bench-org-a',
  runId: 'run-1',
  terminalState: 'completed',
  lifecycle: [{ seq: 1, kind: 'completed', atMs: 0, evidence: 'complete evidence' }],
  retryCount: 0,
  approvalRequired: false,
  approvalSatisfied: false,
  resumedFromExpectedStep: true,
  effectAttempts: 1,
  committedEffects: 1,
  recoveredAfterCrash: false,
  crossTenantViolation: false,
  durationMs: 0,
};

describe('durable benchmark hard gates', () => {
  it('fails one bad run even when other runs pass', () => {
    const decision = evaluateDurableBenchmarkHardGates([
      base,
      { ...base, runId: 'run-2', committedEffects: 2, effectAttempts: 2 },
    ]);
    expect(decision.passed).toBe(false);
    expect(decision.failures.some((failure) => failure.gate === 'exactly_once_effect')).toBe(true);
  });

  it('rejects tenant violations and missing reconstructable evidence', () => {
    const decision = evaluateDurableBenchmarkHardGates([
      { ...base, crossTenantViolation: true, lifecycle: [] },
    ]);
    expect(decision.failures.map((failure) => failure.gate)).toEqual(
      expect.arrayContaining(['tenant_isolation', 'reconstructable_evidence']),
    );
  });

  it('requires crash recovery and approval resume semantics for the matching scenarios', () => {
    const decision = evaluateDurableBenchmarkHardGates([
      {
        ...base,
        scenarioId: 'process_crash_recovery',
        approvalRequired: true,
        approvalSatisfied: true,
        recoveredAfterCrash: false,
        resumedFromExpectedStep: false,
      },
    ]);
    expect(decision.failures.map((failure) => failure.gate)).toEqual(
      expect.arrayContaining(['crash_recovery', 'resume_position']),
    );
  });
});
