import { describe, expect, it } from 'vitest';

import { createVercelWorkflowDurableBenchmarkAdapter } from '@/lib/agent-engine/durable-benchmark/adapters/vercel-workflow/adapter';
import { createInMemoryBenchmarkEffectStore } from '@/lib/agent-engine/durable-benchmark/effect-store';

const input = {
  scenarioId: 'happy_path' as const,
  scenarioVersion: '7.0.0',
  organizationId: 'bench-org-a',
  runId: 'workflow-happy-path',
};

describe('Vercel Workflow durable benchmark adapter', () => {
  it('normalizes provider evidence into the shared benchmark result', async () => {
    const adapter = createVercelWorkflowDurableBenchmarkAdapter({
      effectStore: createInMemoryBenchmarkEffectStore(),
      invoke: async () => ({
        terminalState: 'completed',
        lifecycle: [{ seq: 1, kind: 'completed', atMs: 1, evidence: 'workflow completed' }],
        retryCount: 0,
        approvalRequired: false,
        approvalSatisfied: false,
        resumedFromExpectedStep: true,
        effectAttempts: 1,
        committedEffects: 1,
        recoveredAfterCrash: false,
        crossTenantViolation: false,
        durationMs: 1,
        engineVersion: 'workflow-test',
      }),
    });

    await expect(adapter.run(input)).resolves.toMatchObject({
      engineId: 'vercel_workflow',
      terminalState: 'completed',
      scenarioId: 'happy_path',
      runId: 'workflow-happy-path',
    });
  });

  it('fails closed on malformed provider evidence', async () => {
    const adapter = createVercelWorkflowDurableBenchmarkAdapter({
      effectStore: createInMemoryBenchmarkEffectStore(),
      invoke: async () => ({
        terminalState: 'completed',
        lifecycle: [],
        retryCount: 0,
        approvalRequired: false,
        approvalSatisfied: false,
        resumedFromExpectedStep: true,
        effectAttempts: 0,
        committedEffects: 1,
        recoveredAfterCrash: false,
        crossTenantViolation: false,
        durationMs: 0,
      }),
    });

    await expect(adapter.run(input)).rejects.toThrow('invalid_vercel_workflow_benchmark_result');
  });
});
