import { describe, expect, it, vi } from 'vitest';

import { runPhase7InngestBatch } from '@/lib/agent-engine/durable-benchmark/adapters/inngest/batch-runner';

function providerResult(durationMs = 10) {
  return {
    terminalState: 'completed' as const,
    lifecycle: [{ seq: 1, kind: 'completed', atMs: 0, evidence: 'synthetic provider evidence' }],
    retryCount: 0,
    approvalRequired: false,
    approvalSatisfied: false,
    resumedFromExpectedStep: true,
    effectAttempts: 1,
    committedEffects: 1,
    recoveredAfterCrash: false,
    crossTenantViolation: false,
    durationMs,
    engineVersion: 'inngest-test',
  };
}

describe('Phase 7 Inngest batch runner', () => {
  it('dispatches every Phase 7 scenario for the requested profile using synthetic organizations only', async () => {
    const dispatch = vi.fn().mockResolvedValue(providerResult());

    const report = await runPhase7InngestBatch({
      profile: 'small',
      dispatch,
      timestamp: () => 123456,
    });

    expect(dispatch).toHaveBeenCalledTimes(8);
    expect(report.profile).toBe('small');
    expect(report.runs).toHaveLength(8);
    expect(report.runs.every((run) => run.organizationId.startsWith('bench-org-'))).toBe(true);
    expect(new Set(report.runs.map((run) => run.scenarioId)).size).toBe(8);
  });

  it('uses the canonical medium and stress concurrency multipliers', async () => {
    const dispatch = vi.fn().mockResolvedValue(providerResult(1));

    const medium = await runPhase7InngestBatch({ profile: 'medium', dispatch, timestamp: () => 1 });
    expect(medium.runs).toHaveLength(40);

    dispatch.mockClear();
    const stress = await runPhase7InngestBatch({ profile: 'stress', dispatch, timestamp: () => 2 });
    expect(stress.runs).toHaveLength(160);
  });

  it('returns only canonical run evidence from the provider boundary', async () => {
    const dispatch = vi.fn().mockResolvedValue(providerResult(7));

    const report = await runPhase7InngestBatch({ profile: 'small', dispatch, timestamp: () => 9 });
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain('authorization');
    expect(report.runs.every((run) => run.engineId === 'inngest')).toBe(true);
    expect(report.runs.every((run) => run.lifecycle.length > 0)).toBe(true);
  });
});
