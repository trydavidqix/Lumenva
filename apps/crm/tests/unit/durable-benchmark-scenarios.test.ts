import { describe, expect, it } from 'vitest';

import {
  PHASE_7_SCENARIO_VERSION,
  getPhase7Scenarios,
} from '@/lib/agent-engine/durable-benchmark/scenarios';

const EXPECTED_IDS = [
  'happy_path',
  'transient_retry',
  'retry_exhausted',
  'approval_pause_resume',
  'process_crash_recovery',
  'duplicate_delivery_idempotency',
  'approval_denied_or_expired',
  'tenant_isolation',
] as const;

describe('Phase 7 synthetic durable benchmark scenarios', () => {
  it('freezes the scenario dataset at version 7.0.0', () => {
    expect(PHASE_7_SCENARIO_VERSION).toBe('7.0.0');
    expect(getPhase7Scenarios().every((scenario) => scenario.version === PHASE_7_SCENARIO_VERSION)).toBe(true);
  });

  it('contains each required scenario exactly once', () => {
    const scenarios = getPhase7Scenarios();
    expect(scenarios.map((scenario) => scenario.id).sort()).toEqual([...EXPECTED_IDS].sort());
    expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(scenarios.length);
  });

  it('makes approval behavior explicit for approval scenarios', () => {
    const scenarios = new Map(getPhase7Scenarios().map((scenario) => [scenario.id, scenario]));
    expect(scenarios.get('approval_pause_resume')).toMatchObject({ requiresApproval: true, approvalOutcome: 'approve' });
    expect(scenarios.get('approval_denied_or_expired')?.requiresApproval).toBe(true);
    expect(['reject', 'expire']).toContain(scenarios.get('approval_denied_or_expired')?.approvalOutcome);
  });

  it('commits exactly one synthetic effect only when the journey reaches the effect step', () => {
    const scenarios = getPhase7Scenarios();
    for (const scenario of scenarios) {
      expect([0, 1]).toContain(scenario.expectedCommittedEffects);
    }
    expect(scenarios.find((scenario) => scenario.id === 'happy_path')?.expectedCommittedEffects).toBe(1);
    expect(scenarios.find((scenario) => scenario.id === 'duplicate_delivery_idempotency')?.expectedCommittedEffects).toBe(1);
    expect(scenarios.find((scenario) => scenario.id === 'retry_exhausted')?.expectedCommittedEffects).toBe(0);
    expect(scenarios.find((scenario) => scenario.id === 'approval_denied_or_expired')?.expectedCommittedEffects).toBe(0);
  });

  it('uses only synthetic benchmark tenant identities', () => {
    expect(getPhase7Scenarios().every((scenario) => scenario.organizationId.startsWith('bench-org-'))).toBe(true);
  });
});
