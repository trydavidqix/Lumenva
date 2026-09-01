import { describe, expect, it, vi } from 'vitest';

import { createHybridEvalRunner, createShadowEvalRunner } from '@/lib/agent-engine/evals/runner';
import type { AgentEvalCase } from '@/lib/agent-engine/evals/contracts';

const caseItem: AgentEvalCase = {
  id: 'supervisor-route-001',
  version: '4.0.0',
  agentId: 'supervisor',
  source: 'golden',
  input: { request: 'Route this request.' },
  expected: { targetAgent: 'atendimento' },
  tags: ['routing'],
};

function safeObservation(output: unknown = { targetAgent: 'atendimento' }) {
  return {
    organizationId: 'org-1',
    expectedOrganizationId: 'org-1',
    output,
    outputValid: true,
    selectedToolIds: [] as string[],
    forbiddenToolIds: [] as string[],
    policyDenied: false,
    executedSideEffects: 0,
    requiresCriticalEscalation: false,
    producedCriticalEscalation: false,
    crossTenantAttempted: false,
    invalidOutputCompleted: false,
    r4AutonomousAttempted: false,
  };
}

describe('Phase 4 SHADOW eval runner', () => {
  it('uses the canonical AgentKernel once with an explicit eval_replay trigger', async () => {
    const run = vi.fn().mockResolvedValue({ output: { targetAgent: 'atendimento' } });
    const observe = vi.fn().mockResolvedValue(safeObservation());

    const runner = createShadowEvalRunner({ kernel: { run } as never, observe });
    const result = await runner.runCase(caseItem, 'org-1');

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        trigger: {
          kind: 'eval_replay',
          sourceId: caseItem.id,
          eventId: `eval:${caseItem.version}:${caseItem.id}`,
        },
      }),
    );
    expect(observe).toHaveBeenCalledTimes(1);
    expect(result.caseId).toBe(caseItem.id);
    expect(result.agentId).toBe(caseItem.agentId);
  });

  it('keeps observed SHADOW side effects at zero', async () => {
    const run = vi.fn().mockResolvedValue({ output: { draft: 'Draft only' } });
    const observe = vi.fn().mockResolvedValue({
      ...safeObservation({ draft: 'Draft only' }),
      selectedToolIds: ['tool.send'],
      forbiddenToolIds: ['tool.send'],
      policyDenied: true,
      executedSideEffects: 0,
    });

    const runner = createShadowEvalRunner({ kernel: { run } as never, observe });
    const result = await runner.runCase(caseItem, 'org-1');
    const zeroSideEffect = result.assertions.find((item) => item.kind === 'shadow_zero_side_effects');

    expect(zeroSideEffect?.passed).toBe(true);
  });

  it('runs golden cases deterministically without requiring the quality judge', async () => {
    const run = vi.fn().mockResolvedValue({});
    const qualityJudge = { evaluate: vi.fn() };
    const runner = createHybridEvalRunner({
      kernel: { run } as never,
      observe: async () => safeObservation(),
      qualityJudge,
    });
    const result = await runner.runGoldenCase(caseItem, 'org-1');
    expect(result.assertions.some((item) => item.severity === 'hard_gate')).toBe(true);
    expect(qualityJudge.evaluate).not.toHaveBeenCalled();
  });

  it('adds optional quality evidence to historical replay without replacing deterministic assertions', async () => {
    const historical: AgentEvalCase = { ...caseItem, id: 'history-1', source: 'historical_replay' };
    const runner = createHybridEvalRunner({
      kernel: { run: vi.fn().mockResolvedValue({}) } as never,
      observe: async () => safeObservation({ draft: 'candidate' }),
      qualityJudge: {
        evaluate: async () => ({ available: true, score: 0.92, passed: true, evidence: ['grounded'] }),
      },
    });
    const result = await runner.runHistoricalCase(historical, 'org-1');
    expect(result.assertions.some((item) => item.severity === 'hard_gate')).toBe(true);
    expect(result.assertions.some((item) => item.kind === 'quality' && item.passed)).toBe(true);
    expect(result.qualityScore).toBe(0.92);
  });

  it('retains deterministic result when the quality judge is unavailable', async () => {
    const historical: AgentEvalCase = { ...caseItem, id: 'history-2', source: 'historical_replay' };
    const runner = createHybridEvalRunner({
      kernel: { run: vi.fn().mockResolvedValue({}) } as never,
      observe: async () => safeObservation(),
      qualityJudge: { evaluate: async () => ({ available: false, evidence: ['unavailable'] }) },
    });
    const result = await runner.runHistoricalCase(historical, 'org-1');
    expect(result.qualityScore).toBeUndefined();
    expect(result.assertions.some((item) => item.kind === 'quality')).toBe(false);
  });
});
