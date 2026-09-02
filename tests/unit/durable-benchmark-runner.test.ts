import { describe, expect, it } from 'vitest';

import type { DurableBenchmarkAdapter } from '@/lib/agent-engine/durable-benchmark/contracts';
import { createDurableBenchmarkRunner, DURABLE_BENCHMARK_PROFILES } from '@/lib/agent-engine/durable-benchmark/runner';

function fakeAdapter(engineId: DurableBenchmarkAdapter['engineId'], calls: string[]): DurableBenchmarkAdapter {
  return {
    engineId,
    async run(input) {
      calls.push(`${input.scenarioId}:${input.scenarioVersion}:${input.organizationId}`);
      return {
        ...input,
        engineId,
        terminalState: input.scenarioId === 'retry_exhausted' || input.scenarioId === 'tenant_isolation' ? 'failed' : input.scenarioId === 'approval_denied_or_expired' ? 'rejected' : 'completed',
        lifecycle: [{ seq: 1, kind: 'done', atMs: 0, evidence: 'fake normalized result' }],
        retryCount: 0,
        approvalRequired: input.scenarioId.includes('approval') || input.scenarioId === 'process_crash_recovery',
        approvalSatisfied: input.scenarioId === 'approval_pause_resume' || input.scenarioId === 'process_crash_recovery',
        resumedFromExpectedStep: true,
        effectAttempts: 0,
        committedEffects: 0,
        recoveredAfterCrash: input.scenarioId === 'process_crash_recovery',
        crossTenantViolation: false,
        durationMs: 0,
      };
    },
  };
}

describe('durable benchmark runner', () => {
  it('freezes the approved load profiles', () => {
    expect(DURABLE_BENCHMARK_PROFILES).toEqual({ small: 1, medium: 5, stress: 20 });
  });

  it('runs every scenario for every requested repetition with stable identities', async () => {
    const calls: string[] = [];
    const adapter = fakeAdapter('current', calls);
    const runner = createDurableBenchmarkRunner({ adapters: new Map([['current', adapter]]) });
    const suite = await runner.runSuite({ engineId: 'current', profile: 'small', repetitions: 3 });

    expect(suite.results).toHaveLength(24);
    expect(calls).toHaveLength(24);
    expect(new Set(suite.results.map((result) => result.scenarioVersion))).toEqual(new Set(['7.0.0']));
    expect(suite.results.every((result) => result.organizationId.startsWith('bench-org-'))).toBe(true);
  });
});
