import { describe, expect, it } from 'vitest';

import { shouldInjectFault } from '@/lib/agent-engine/durable-benchmark/fault-plan';
import { getPhase7Scenarios } from '@/lib/agent-engine/durable-benchmark/scenarios';

describe('Phase 7 deterministic fault plan', () => {
  it('returns the same decision for the same fault coordinate on every call', () => {
    const scenario = getPhase7Scenarios().find((item) => item.id === 'transient_retry');
    expect(scenario).toBeDefined();

    const input = { scenario: scenario!, stepId: 'work-b', occurrence: 1 };
    const first = shouldInjectFault(input);
    for (let index = 0; index < 10; index += 1) {
      expect(shouldInjectFault(input)).toBe(first);
    }
  });

  it('injects only faults explicitly declared by the scenario', () => {
    const scenario = getPhase7Scenarios().find((item) => item.id === 'transient_retry');
    expect(scenario).toBeDefined();
    expect(shouldInjectFault({ scenario: scenario!, stepId: 'work-b', occurrence: 1 })).toBe(true);
    expect(shouldInjectFault({ scenario: scenario!, stepId: 'work-b', occurrence: 2 })).toBe(false);
    expect(shouldInjectFault({ scenario: scenario!, stepId: 'unknown', occurrence: 1 })).toBe(false);
  });

  it('declares crash, duplicate delivery and cross-tenant faults in their dedicated scenarios', () => {
    const scenarios = getPhase7Scenarios();
    expect(scenarios.find((item) => item.id === 'process_crash_recovery')?.faults.some((fault) => fault.kind === 'crash')).toBe(true);
    expect(scenarios.find((item) => item.id === 'duplicate_delivery_idempotency')?.faults.some((fault) => fault.kind === 'duplicate_delivery')).toBe(true);
    expect(scenarios.find((item) => item.id === 'tenant_isolation')?.faults.some((fault) => fault.kind === 'cross_tenant_attempt')).toBe(true);
  });
});
