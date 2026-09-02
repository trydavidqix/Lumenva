import { describe, expect, it, vi } from 'vitest';

import { runInngestPhase7Provider } from '@/lib/agent-engine/durable-benchmark/providers/inngest-provider';

const providerResult = {
  terminalState: 'completed' as const,
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
  engineVersion: 'inngest-test',
};

describe('Phase 7 Inngest provider', () => {
  it('combines the canonical profiles into one 208-run provider report', async () => {
    const dispatch = vi.fn().mockResolvedValue(providerResult);
    const report = await runInngestPhase7Provider({ dispatch });

    expect(dispatch).toHaveBeenCalledTimes(208);
    expect(report.engineId).toBe('inngest');
    expect(report.suiteCounts).toEqual({ small: 8, medium: 40, stress: 160 });
    expect(report.runs).toHaveLength(208);
    expect(report.realEvidence).toBe(true);
  });

  it('returns BLOCKED when the real local dispatcher is unavailable', async () => {
    const report = await runInngestPhase7Provider({ blocker: 'inngest_dev_server_unreachable' });
    expect(report.status).toBe('BLOCKED');
    expect(report.realEvidence).toBe(false);
  });
});
