import type { AgentAutonomyLevel } from '../policies/engine';

export interface CapabilityAutonomyKey {
  organizationId: string;
  agentId: string;
  capabilityId: string;
}

export interface CapabilityAutonomyRecord extends CapabilityAutonomyKey {
  currentLevel: AgentAutonomyLevel;
  desiredLevel: AgentAutonomyLevel;
  evidenceRef: string;
  evidenceObservedAt: string;
  requestedBy: string;
  approvedBy: string;
  reason: string;
  rollbackLevel: AgentAutonomyLevel;
  status: 'active' | 'rolled_back' | 'disabled';
}

export interface AutonomyStateStore {
  load(key: CapabilityAutonomyKey): Promise<CapabilityAutonomyRecord | null>;
  save(record: CapabilityAutonomyRecord): Promise<void>;
}

function serializeKey(key: CapabilityAutonomyKey): string {
  return JSON.stringify([key.organizationId, key.agentId, key.capabilityId]);
}

export function createMemoryAutonomyStateStore(): AutonomyStateStore {
  const records = new Map<string, CapabilityAutonomyRecord>();

  return {
    async load(key) {
      const record = records.get(serializeKey(key));
      return record === undefined ? null : { ...record };
    },
    async save(record) {
      records.set(serializeKey(record), { ...record });
    },
  };
}
