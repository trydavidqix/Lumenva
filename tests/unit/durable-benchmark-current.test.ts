import { describe, expect, it } from 'vitest';

import { createInMemoryBenchmarkEffectStore } from '@/lib/agent-engine/durable-benchmark/effect-store';
import { createCurrentDurableBenchmarkAdapter } from '@/lib/agent-engine/durable-benchmark/adapters/current';
import { getPhase7Scenarios, PHASE_7_SCENARIO_VERSION } from '@/lib/agent-engine/durable-benchmark/scenarios';

function inputFor(scenarioId: ReturnType<typeof getPhase7Scenarios>[number]['id']) {
  const scenario = getPhase7Scenarios().find((candidate) => candidate.id === scenarioId);
  if (!scenario) throw new Error(`missing_scenario:${scenarioId}`);
  return {
    scenarioId,
    scenarioVersion: PHASE_7_SCENARIO_VERSION,
    organizationId: scenario.organizationId,
    runId: `current-${scenarioId}`,
  };
}

describe('current durable benchmark adapter', () => {
  it('retries a transient failure and commits exactly one synthetic effect', async () => {
    const adapter = createCurrentDurableBenchmarkAdapter({ effectStore: createInMemoryBenchmarkEffectStore() });
    const result = await adapter.run(inputFor('transient_retry'));

    expect(result.terminalState).toBe('completed');
    expect(result.retryCount).toBe(1);
    expect(result.effectAttempts).toBe(1);
    expect(result.committedEffects).toBe(1);
  });

  it('fails after the configured retry limit without committing an effect', async () => {
    const adapter = createCurrentDurableBenchmarkAdapter({ effectStore: createInMemoryBenchmarkEffectStore() });
    const result = await adapter.run(inputFor('retry_exhausted'));

    expect(result.terminalState).toBe('failed');
    expect(result.retryCount).toBe(2);
    expect(result.committedEffects).toBe(0);
  });

  it('pauses and resumes approval from the expected checkpoint', async () => {
    const adapter = createCurrentDurableBenchmarkAdapter({ effectStore: createInMemoryBenchmarkEffectStore() });
    const result = await adapter.run(inputFor('approval_pause_resume'));

    expect(result.approvalRequired).toBe(true);
    expect(result.approvalSatisfied).toBe(true);
    expect(result.resumedFromExpectedStep).toBe(true);
    expect(result.terminalState).toBe('completed');
  });

  it('recovers after a synthetic process crash without replaying completed effects', async () => {
    const adapter = createCurrentDurableBenchmarkAdapter({ effectStore: createInMemoryBenchmarkEffectStore() });
    const result = await adapter.run(inputFor('process_crash_recovery'));

    expect(result.recoveredAfterCrash).toBe(true);
    expect(result.resumedFromExpectedStep).toBe(true);
    expect(result.committedEffects).toBe(1);
  });

  it('suppresses a duplicate delivery at the synthetic effect boundary', async () => {
    const adapter = createCurrentDurableBenchmarkAdapter({ effectStore: createInMemoryBenchmarkEffectStore() });
    const result = await adapter.run(inputFor('duplicate_delivery_idempotency'));

    expect(result.effectAttempts).toBe(2);
    expect(result.committedEffects).toBe(1);
    expect(result.terminalState).toBe('completed');
  });

  it('fails a cross-tenant attempt without committing any effect', async () => {
    const adapter = createCurrentDurableBenchmarkAdapter({ effectStore: createInMemoryBenchmarkEffectStore() });
    const result = await adapter.run(inputFor('tenant_isolation'));

    expect(result.terminalState).toBe('failed');
    expect(result.crossTenantViolation).toBe(false);
    expect(result.committedEffects).toBe(0);
    expect(result.lifecycle.some((event) => event.kind === 'tenant_attempt_blocked')).toBe(true);
  });
});
