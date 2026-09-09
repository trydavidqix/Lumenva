import { describe, expect, it } from 'vitest';

import {
  loadRuntimeAutonomyControls,
  type RuntimeAutonomyStore,
} from '../policies/runtime-controls';

function memoryStore(initial: {
  globalEnabled?: boolean;
  tenantEnabled?: boolean;
  agentEnabled?: boolean;
  capabilityEnabled?: boolean;
} = {}): RuntimeAutonomyStore & { set: (next: Partial<typeof initial>) => void } {
  let state = {
    globalEnabled: true,
    tenantEnabled: true,
    agentEnabled: true,
    capabilityEnabled: true,
    ...initial,
  };

  return {
    async load() {
      return state;
    },
    set(next) {
      state = { ...state, ...next };
    },
  };
}

describe('Agent OS runtime autonomy wiring', () => {
  it('recarrega kill switches a cada run para funcionar sem deploy', async () => {
    const store = memoryStore();

    const first = await loadRuntimeAutonomyControls(store, {
      organizationId: 'org-1',
      agentId: 'agent-1',
      capabilityId: 'send_message',
      autonomyLevel: 'autopilot_low_risk',
      toolHasSideEffect: true,
    });
    expect(first.kind).toBe('active');

    store.set({ tenantEnabled: false });

    const second = await loadRuntimeAutonomyControls(store, {
      organizationId: 'org-1',
      agentId: 'agent-1',
      capabilityId: 'send_message',
      autonomyLevel: 'autopilot_low_risk',
      toolHasSideEffect: true,
    });

    expect(second).toEqual({
      kind: 'disabled',
      reason: 'tenant_kill_switch',
      canRunModel: false,
      canExecuteSideEffects: false,
    });
  });
});
