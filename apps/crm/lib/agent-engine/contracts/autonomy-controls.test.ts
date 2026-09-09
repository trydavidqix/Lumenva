import { describe, expect, it } from 'vitest';

import {
  evaluateAutonomyControls,
  type AutonomyControlInput,
} from '../policies/autonomy';

function controls(overrides: Partial<AutonomyControlInput> = {}): AutonomyControlInput {
  return {
    autonomyLevel: 'autopilot_low_risk',
    globalEnabled: true,
    tenantEnabled: true,
    agentEnabled: true,
    capabilityEnabled: true,
    toolHasSideEffect: true,
    ...overrides,
  };
}

describe('Agent OS autonomy controls', () => {
  it('global kill switch desliga execução sem deploy', () => {
    expect(evaluateAutonomyControls(controls({ globalEnabled: false }))).toEqual({
      kind: 'disabled',
      reason: 'global_kill_switch',
      canRunModel: false,
      canExecuteSideEffects: false,
    });
  });

  it('tenant, agente e capability têm kill switches independentes', () => {
    const tenant = evaluateAutonomyControls(controls({ tenantEnabled: false }));
    const agent = evaluateAutonomyControls(controls({ agentEnabled: false }));
    const capability = evaluateAutonomyControls(controls({ capabilityEnabled: false }));

    expect(tenant.kind).toBe('disabled');
    expect(agent.kind).toBe('disabled');
    expect(capability.kind).toBe('disabled');

    if (tenant.kind !== 'disabled' || agent.kind !== 'disabled' || capability.kind !== 'disabled') {
      throw new Error('kill switches devem produzir decisão disabled');
    }

    expect(tenant.reason).toBe('tenant_kill_switch');
    expect(agent.reason).toBe('agent_kill_switch');
    expect(capability.reason).toBe('capability_kill_switch');
  });

  it('OFF não roda modelo nem side effects', () => {
    expect(evaluateAutonomyControls(controls({ autonomyLevel: 'off' }))).toEqual({
      kind: 'disabled',
      reason: 'autonomy_off',
      canRunModel: false,
      canExecuteSideEffects: false,
    });
  });

  it('SHADOW roda decisão/trace mas nunca executa side effect', () => {
    expect(evaluateAutonomyControls(controls({ autonomyLevel: 'shadow' }))).toEqual({
      kind: 'shadow',
      canRunModel: true,
      canExecuteSideEffects: false,
    });
  });

  it('SHADOW ainda permite leitura porque ela não produz side effect', () => {
    expect(
      evaluateAutonomyControls(
        controls({ autonomyLevel: 'shadow', toolHasSideEffect: false }),
      ),
    ).toEqual({
      kind: 'shadow',
      canRunModel: true,
      canExecuteSideEffects: true,
    });
  });

  it('níveis ativos mantêm modelo e execução disponíveis para a policy decidir', () => {
    for (const autonomyLevel of [
      'draft',
      'assisted',
      'autopilot_low_risk',
      'autopilot_expanded',
    ] as const) {
      expect(evaluateAutonomyControls(controls({ autonomyLevel }))).toEqual({
        kind: 'active',
        canRunModel: true,
        canExecuteSideEffects: true,
      });
    }
  });
});
