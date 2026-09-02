import { describe, expect, it } from 'vitest';

import { createInngestDurableBenchmarkAdapter } from '@/lib/agent-engine/durable-benchmark/adapters/inngest/adapter';
import { createInMemoryBenchmarkEffectStore } from '@/lib/agent-engine/durable-benchmark/effect-store';

const input = {
  scenarioId: 'happy_path' as const,
  scenarioVersion: '7.0.0',
  organizationId: 'bench-org-a',
  runId: 'inngest-happy-path',
};

describe('Inngest durable benchmark adapter', () => {
  it('normalizes a provider invocation result into the shared contract', async () => {
    const adapter = createInngestDurableBenchmarkAdapter({
      effectStore: createInMemoryBenchmarkEffectStore(),
      invoke: async () => ({
        terminalState: 'completed',
        lifecycle: [{ seq: 1, kind: 'completed', atMs: 1, evidence: 'provider completed' }],
        retryCount: 1,
        approvalRequired: false,
        approvalSatisfied: false,
        resumedFromExpectedStep: true,
        effectAttempts: 1,
        committedEffects: 1,
        recoveredAfterCrash: false,
        crossTenantViolation: false,
        durationMs: 1,
        engineVersion: 'inngest-test',
      }),
    });

    await expect(adapter.run(input)).resolves.toMatchObject({
      engineId: 'inngest',
      scenarioId: 'happy_path',
      organizationId: 'bench-org-a',
      runId: 'inngest-happy-path',
      terminalState: 'completed',
    });
  });

  it('fails closed when the invocation port returns invalid normalized evidence', async () => {
    const adapter = createInngestDurableBenchmarkAdapter({
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

    await expect(adapter.run(input)).rejects.toThrow('invalid_inngest_benchmark_result');
  });
});
