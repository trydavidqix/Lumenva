import { describe, expect, it, vi } from 'vitest';

import { runPhase4HistoricalReplay, type HistoricalReplayRunner } from '@/lib/agent-engine/evals/historical-replay-command';

describe('Phase 4 historical replay command', () => {
  it('fails closed unless mode is SHADOW', async () => {
    await expect(
      runPhase4HistoricalReplay({
        mode: 'ASSISTED',
        organizationId: 'org-1',
        minimumHistoricalSamplesPerAgent: 20,
        sampler: { sample: vi.fn() },
        runner: { runHistoricalCase: vi.fn() },
      }),
    ).rejects.toThrow('phase4_replay_requires_shadow_mode');
  });

  it('samples historical cases, runs them, and returns a sanitized gate report', async () => {
    const sampler = {
      sample: vi.fn(async () => [
        {
          id: 'case-1',
          organizationId: 'org-1',
          bucket: 'sales',
          input: { request: 'Quero proposta', email: 'person@example.test' },
          humanReference: { disposition: 'qualified', phone: '+351912345678' },
        },
      ]),
    };

    const runner = {
      runHistoricalCase: vi.fn(async () => ({
        caseId: 'case-1',
        caseVersion: 'historical-v1',
        agentId: 'sales' as const,
        source: 'historical_replay' as const,
        assertions: [
          { kind: 'structured_output', severity: 'hard_gate', passed: true, evidence: 'ok' },
          { kind: 'shadow_zero_side_effects', severity: 'hard_gate', passed: true, evidence: '0' },
          { kind: 'quality', severity: 'quality', passed: true, evidence: 'good' },
        ],
      })),
    };

    const report = await runPhase4HistoricalReplay({
      mode: 'SHADOW',
      organizationId: 'org-1',
      minimumHistoricalSamplesPerAgent: 20,
      sampler,
      runner: runner as unknown as HistoricalReplayRunner,
    });

    expect(sampler.sample).toHaveBeenCalledWith({ organizationId: 'org-1', perBucket: 20 });
    expect(runner.runHistoricalCase).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(report)).not.toContain('person@example.test');
    expect(JSON.stringify(report)).not.toContain('+351912345678');
    expect(report.decision).toBe('INCOMPLETE');
    expect(report.historicalSamplesByAgent.sales).toBe(1);
  });
});
