import type { AgentToolDefinition, AgentToolRisk } from '../tools/registry';

export type CapabilityRiskTier = AgentToolRisk;

export interface CapabilityRiskDefinition {
  capabilityId: string;
  risk: CapabilityRiskTier;
  hasSideEffect: boolean;
}

export interface CapabilityRiskRegistry {
  get(capabilityId: string): CapabilityRiskDefinition | null;
}

export function createCapabilityRiskRegistry(
  definitions: ReadonlyArray<AgentToolDefinition>,
): CapabilityRiskRegistry {
  const values = new Map<string, CapabilityRiskDefinition>();

  for (const definition of definitions) {
    if (values.has(definition.id)) {
      throw new Error(`duplicate_capability_id:${definition.id}`);
    }
    values.set(definition.id, {
      capabilityId: definition.id,
      risk: definition.risk,
      hasSideEffect: definition.hasSideEffect,
    });
  }

  return {
    get(capabilityId) {
      const definition = values.get(capabilityId);
      return definition === undefined ? null : { ...definition };
    },
  };
}

export function requireCapabilityRisk(
  registry: CapabilityRiskRegistry,
  capabilityId: string,
): CapabilityRiskDefinition {
  const definition = registry.get(capabilityId);
  if (definition === null) {
    throw new Error(`unknown_capability:${capabilityId}`);
  }
  return definition;
}
