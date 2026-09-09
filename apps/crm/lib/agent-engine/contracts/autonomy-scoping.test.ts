import { describe, expect, it } from 'vitest';

import {
  createMemoryAutonomyStateStore,
  type CapabilityAutonomyRecord,
} from '../autonomy/store';
import { resolveEffectiveAutonomy } from '../autonomy/decision';

function record(overrides: Partial<CapabilityAutonomyRecord> = {}): CapabilityAutonomyRecord {
  return {
    organizationId: 'org-a',
    agentId: 'agent-a',
    capabilityId: 'crm.lead.update',
    currentLevel: 'assisted',
    desiredLevel: 'assisted',
    evidenceRef: 'eval-1',
    evidenceObservedAt: new Date(1_000_000).toISOString(),
    requestedBy: 'user-a',
    approvedBy: 'user-b',
    reason: 'phase-5-test',
    rollbackLevel: 'draft',
    status: 'active',
    ...overrides,
  };
}

describe('scoped autonomy state', () => {
  it('does not bleed records across organization agent or capability keys', async () => {
    const store = createMemoryAutonomyStateStore();
    await store.save(record());

    await expect(
      store.load({ organizationId: 'org-a', agentId: 'agent-a', capabilityId: 'crm.lead.update' }),
    ).resolves.toMatchObject({ currentLevel: 'assisted' });
    await expect(
      store.load({ organizationId: 'org-b', agentId: 'agent-a', capabilityId: 'crm.lead.update' }),
    ).resolves.toBeNull();
    await expect(
      store.load({ organizationId: 'org-a', agentId: 'agent-b', capabilityId: 'crm.lead.update' }),
    ).resolves.toBeNull();
    await expect(
      store.load({ organizationId: 'org-a', agentId: 'agent-a', capabilityId: 'crm.contact.update' }),
    ).resolves.toBeNull();
  });

  it('uses the most restrictive level between requested and capability state', () => {
    expect(
      resolveEffectiveAutonomy({
        requestedLevel: 'autopilot_low_risk',
        globalEnabled: true,
        tenantEnabled: true,
        agentEnabled: true,
        capability: record({ currentLevel: 'draft' }),
      }),
    ).toEqual({ level: 'draft', enabled: true });
  });

  it('fails closed when a higher-level kill switch is disabled', () => {
    expect(
      resolveEffectiveAutonomy({
        requestedLevel: 'assisted',
        globalEnabled: false,
        tenantEnabled: true,
        agentEnabled: true,
        capability: record(),
      }),
    ).toEqual({ level: 'off', enabled: false, reason: 'global_kill_switch' });

    expect(
      resolveEffectiveAutonomy({
        requestedLevel: 'assisted',
        globalEnabled: true,
        tenantEnabled: false,
        agentEnabled: true,
        capability: record(),
      }),
    ).toEqual({ level: 'off', enabled: false, reason: 'tenant_kill_switch' });

    expect(
      resolveEffectiveAutonomy({
        requestedLevel: 'assisted',
        globalEnabled: true,
        tenantEnabled: true,
        agentEnabled: false,
        capability: record(),
      }),
    ).toEqual({ level: 'off', enabled: false, reason: 'agent_kill_switch' });
  });

  it('treats disabled capability state as non-executable without disabling model globally', () => {
    expect(
      resolveEffectiveAutonomy({
        requestedLevel: 'assisted',
        globalEnabled: true,
        tenantEnabled: true,
        agentEnabled: true,
        capability: record({ status: 'disabled' }),
      }),
    ).toEqual({ level: 'off', enabled: false, reason: 'capability_kill_switch' });
  });
});
