import type { AgentAutonomyLevel } from '../policies/engine';
import type { CapabilityAutonomyKey, CapabilityAutonomyRecord } from './store';

export interface RuntimeAutonomyResolver {
  resolve(key: CapabilityAutonomyKey): Promise<{
    level: AgentAutonomyLevel;
    globalEnabled: boolean;
    tenantEnabled: boolean;
    agentEnabled: boolean;
    capabilityEnabled: boolean;
  }>;
}

const LEVEL_ORDER: readonly AgentAutonomyLevel[] = [
  'off',
  'shadow',
  'draft',
  'assisted',
  'autopilot_low_risk',
  'autopilot_expanded',
];

export function mostRestrictiveAutonomyLevel(
  left: AgentAutonomyLevel,
  right: AgentAutonomyLevel,
): AgentAutonomyLevel {
  const leftIndex = LEVEL_ORDER.indexOf(left);
  const rightIndex = LEVEL_ORDER.indexOf(right);
  return leftIndex <= rightIndex ? left : right;
}

export function resolveEffectiveAutonomy(input: {
  requestedLevel: AgentAutonomyLevel;
  globalEnabled: boolean;
  tenantEnabled: boolean;
  agentEnabled: boolean;
  capability: CapabilityAutonomyRecord | null;
}): { level: AgentAutonomyLevel; enabled: boolean; reason?: string } {
  if (!input.globalEnabled) {
    return { level: 'off', enabled: false, reason: 'global_kill_switch' };
  }
  if (!input.tenantEnabled) {
    return { level: 'off', enabled: false, reason: 'tenant_kill_switch' };
  }
  if (!input.agentEnabled) {
    return { level: 'off', enabled: false, reason: 'agent_kill_switch' };
  }
  if (input.capability?.status === 'disabled') {
    return { level: 'off', enabled: false, reason: 'capability_kill_switch' };
  }

  const capabilityLevel =
    input.capability === null
      ? input.requestedLevel
      : input.capability.status === 'rolled_back'
        ? input.capability.rollbackLevel
        : input.capability.currentLevel;

  const level = mostRestrictiveAutonomyLevel(input.requestedLevel, capabilityLevel);
  return { level, enabled: level !== 'off' };
}
