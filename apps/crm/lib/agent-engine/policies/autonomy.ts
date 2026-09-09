import type { AgentAutonomyLevel } from './engine';

export interface AutonomyControlInput {
  autonomyLevel: AgentAutonomyLevel;
  globalEnabled: boolean;
  tenantEnabled: boolean;
  agentEnabled: boolean;
  capabilityEnabled: boolean;
  toolHasSideEffect: boolean;
}

export type AutonomyControlDecision =
  | {
      kind: 'disabled';
      reason:
        | 'global_kill_switch'
        | 'tenant_kill_switch'
        | 'agent_kill_switch'
        | 'capability_kill_switch'
        | 'autonomy_off';
      canRunModel: boolean;
      canExecuteSideEffects: false;
    }
  | {
      kind: 'shadow';
      canRunModel: true;
      canExecuteSideEffects: boolean;
    }
  | {
      kind: 'active';
      canRunModel: true;
      canExecuteSideEffects: true;
    };

export function evaluateAutonomyControls(
  input: AutonomyControlInput,
): AutonomyControlDecision {
  if (!input.globalEnabled) {
    return {
      kind: 'disabled',
      reason: 'global_kill_switch',
      canRunModel: false,
      canExecuteSideEffects: false,
    };
  }

  if (!input.tenantEnabled) {
    return {
      kind: 'disabled',
      reason: 'tenant_kill_switch',
      canRunModel: false,
      canExecuteSideEffects: false,
    };
  }

  if (!input.agentEnabled) {
    return {
      kind: 'disabled',
      reason: 'agent_kill_switch',
      canRunModel: false,
      canExecuteSideEffects: false,
    };
  }

  if (!input.capabilityEnabled) {
    return {
      kind: 'disabled',
      reason: 'capability_kill_switch',
      canRunModel: true,
      canExecuteSideEffects: false,
    };
  }

  if (input.autonomyLevel === 'off') {
    return {
      kind: 'disabled',
      reason: 'autonomy_off',
      canRunModel: false,
      canExecuteSideEffects: false,
    };
  }

  if (input.autonomyLevel === 'shadow') {
    return {
      kind: 'shadow',
      canRunModel: true,
      canExecuteSideEffects: !input.toolHasSideEffect,
    };
  }

  return {
    kind: 'active',
    canRunModel: true,
    canExecuteSideEffects: true,
  };
}
