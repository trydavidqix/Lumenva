import { describe, expect, it, vi } from 'vitest';

import type { AgentAutonomyLevel } from '../policies/engine';
import { executeThroughToolGateway } from '../tools/gateway';
import type { AgentToolDefinition } from '../tools/registry';
import type { AuthorizeModuleInput } from '../../entitlements/authorize-module';

function entitlementFor(toolDefinition: AgentToolDefinition, requestId: string): AuthorizeModuleInput {
  return {
    requestId, policyVersion: 'entitlements.v1',
    module: { id: toolDefinition.id, version: '1.0.0', dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ['agent'], risk: 'P1', requiresApproval: false },
    tenant: { organizationId: 'org-a', rlsOrganizationId: 'org-a', rlsAllowed: true, plan: 'test', entitledModules: [toolDefinition.id] },
    actor: { actorId: 'agent-a', organizationId: 'org-a', role: 'agent', capabilities: [] }, enabledModules: [], maxRisk: 'P4', approval: { required: false, approved: false },
  };
}
import type { AuthorizeModuleInput } from '../../entitlements/authorize-module';

function entitlementFor(toolDefinition: AgentToolDefinition, requestId: string): AuthorizeModuleInput {
  return {
    requestId, policyVersion: 'entitlements.v1',
    module: { id: toolDefinition.id, version: '1.0.0', dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ['agent'], risk: 'P1', requiresApproval: false },
    tenant: { organizationId: 'org-a', rlsOrganizationId: 'org-a', rlsAllowed: true, plan: 'test', entitledModules: [toolDefinition.id] },
    actor: { actorId: 'agent-a', organizationId: 'org-a', role: 'agent', capabilities: [] }, enabledModules: [], maxRisk: 'P4', approval: { required: false, approved: false },
  };
}

const reversibleTool: AgentToolDefinition = {
  id: 'crm.contact.update',
  owner: 'agent-engine.crm',
  source: 'internal',
  schema: { kind: 'inline', value: {} },
  risk: 'r1_reversible_write',
  hasSideEffect: true,
  idempotencyRequired: true,
  timeoutMs: 10_000,
  maxRetries: 0,
};

const promotionDecision = { kind: 'allow', evidenceRef: 'eval-7' } as const;

type RuntimeState = {
  level: AgentAutonomyLevel;
  globalEnabled: boolean;
  tenantEnabled: boolean;
  agentEnabled: boolean;
  capabilityEnabled: boolean;
};

async function run(runtimeState: RuntimeState) {
  const execute = vi.fn().mockResolvedValue({ ok: true });
  const runtimeAutonomyResolver = { resolve: vi.fn().mockResolvedValue(runtimeState) };
  const result = await executeThroughToolGateway({
    organizationId: 'org-a', agentId: 'agent-a', runId: 'run-a', autonomyLevel: 'assisted', promotionDecision,
    runtimeAutonomyResolver, tool: reversibleTool, args: { name: 'A' }, idempotencyKey: 'idem-1', execute, approvalStore: null,
    entitlement: entitlementFor(reversibleTool, 'idem-1'),
    entitlement: entitlementFor(reversibleTool, 'idem-1'),
  });
  return { result, execute, runtimeAutonomyResolver };
}

describe('Phase 5 runtime autonomy rollback', () => {
  it('rechecks the global kill switch immediately before a side effect', async () => {
    const { result, execute, runtimeAutonomyResolver } = await run({
      level: 'assisted', globalEnabled: false, tenantEnabled: true, agentEnabled: true, capabilityEnabled: true,
    });
    expect(runtimeAutonomyResolver.resolve).toHaveBeenCalledWith({ organizationId: 'org-a', agentId: 'agent-a', capabilityId: 'crm.contact.update' });
    expect(result).toEqual({ kind: 'denied', reason: 'global_kill_switch' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('rechecks tenant, agent and capability kill switches before a side effect', async () => {
    const cases: Array<[RuntimeState, string]> = [
      [{ level: 'assisted', globalEnabled: true, tenantEnabled: false, agentEnabled: true, capabilityEnabled: true }, 'tenant_kill_switch'],
      [{ level: 'assisted', globalEnabled: true, tenantEnabled: true, agentEnabled: false, capabilityEnabled: true }, 'agent_kill_switch'],
      [{ level: 'assisted', globalEnabled: true, tenantEnabled: true, agentEnabled: true, capabilityEnabled: false }, 'capability_kill_switch'],
    ];
    for (const [state, reason] of cases) {
      const { result, execute } = await run(state);
      expect(result).toEqual({ kind: 'denied', reason });
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it('applies a runtime rollback from assisted to draft without restarting the run', async () => {
    const { result, execute } = await run({
      level: 'draft', globalEnabled: true, tenantEnabled: true, agentEnabled: true, capabilityEnabled: true,
    });
    expect(result.kind).toBe('draft');
    expect(execute).not.toHaveBeenCalled();
  });
});
