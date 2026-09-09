import { describe, expect, it, vi } from 'vitest';

import { runPhase7InngestLocalCommand } from '@/lib/agent-engine/durable-benchmark/adapters/inngest/local-command';

function providerResult() {
  return {
    terminalState: 'completed' as const,
    lifecycle: [{ seq: 1, kind: 'completed', atMs: 0, evidence: 'synthetic evidence' }],
    retryCount: 0,
    approvalRequired: false,
    approvalSatisfied: false,
    resumedFromExpectedStep: true,
    effectAttempts: 1,
    committedEffects: 1,
    recoveredAfterCrash: false,
    crossTenantViolation: false,
    durationMs: 5,
    engineVersion: 'inngest-test',
  };
}

describe('Phase 7 Inngest local command', () => {
  it('runs the requested local profile through the provided dispatcher and returns canonical evidence', async () => {
    const dispatch = vi.fn().mockResolvedValue(providerResult());

    const report = await runPhase7InngestLocalCommand({
      profile: 'small',
      dispatch,
      timestamp: () => 123,
    });

    expect(dispatch).toHaveBeenCalledTimes(8);
    expect(report.profile).toBe('small');
    expect(report.runs).toHaveLength(8);
    expect(report.runs.every((run) => run.engineId === 'inngest')).toBe(true);
  });

  it('rejects unsupported profiles before dispatch', async () => {
    const dispatch = vi.fn();

    await expect(
      runPhase7InngestLocalCommand({
        profile: 'invalid' as never,
        dispatch,
        timestamp: () => 1,
      }),
    ).rejects.toThrow(/profile/i);

    expect(dispatch).not.toHaveBeenCalled();
  });
});
