import {
  evaluateAutonomyControls,
  type AutonomyControlDecision,
} from './autonomy';
import type { AgentAutonomyLevel } from './engine';

export interface RuntimeAutonomyState {
  globalEnabled: boolean;
  tenantEnabled: boolean;
  agentEnabled: boolean;
  capabilityEnabled: boolean;
}

export interface RuntimeAutonomyLookup {
  organizationId: string;
  agentId: string;
  capabilityId: string;
}

export interface RuntimeAutonomyStore {
  load(lookup: RuntimeAutonomyLookup): Promise<Partial<RuntimeAutonomyState>>;
}

export interface LoadRuntimeAutonomyControlsInput extends RuntimeAutonomyLookup {
  autonomyLevel: AgentAutonomyLevel;
  toolHasSideEffect: boolean;
}

const DEFAULT_STATE: RuntimeAutonomyState = {
  globalEnabled: true,
  tenantEnabled: true,
  agentEnabled: true,
  capabilityEnabled: true,
};

/**
 * Loads kill-switch state for every run/tool decision instead of caching it in
 * process memory. A persisted store can therefore disable execution without a
 * deploy or worker restart.
 */
export async function loadRuntimeAutonomyControls(
  store: RuntimeAutonomyStore,
  input: LoadRuntimeAutonomyControlsInput,
): Promise<AutonomyControlDecision> {
  const persisted = await store.load({
    organizationId: input.organizationId,
    agentId: input.agentId,
    capabilityId: input.capabilityId,
  });

  const state: RuntimeAutonomyState = {
    ...DEFAULT_STATE,
    ...persisted,
  };

  return evaluateAutonomyControls({
    autonomyLevel: input.autonomyLevel,
    globalEnabled: state.globalEnabled,
    tenantEnabled: state.tenantEnabled,
    agentEnabled: state.agentEnabled,
    capabilityEnabled: state.capabilityEnabled,
    toolHasSideEffect: input.toolHasSideEffect,
  });
}
