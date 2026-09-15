import { describe, expect, it, vi } from 'vitest';

import { executeThroughToolGateway } from '../tools/gateway';
import type { AgentToolDefinition } from '../tools/registry';
import type { AuthorizeModuleInput, ModuleRiskTier } from '../../entitlements/authorize-module';

function entitlementFor(toolDefinition: AgentToolDefinition, requestId: string): AuthorizeModuleInput {
  const risk: ModuleRiskTier = { r0_read: 'P0', r1_reversible_write: 'P1', r2_external_communication: 'P2', r3_sensitive_commercial: 'P3', r4_destructive_admin: 'P4' }[toolDefinition.risk];
  return {
    requestId, policyVersion: 'entitlements.v1',
    module: { id: toolDefinition.id, version: '1.0.0', dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ['agent'], risk, requiresApproval: false },
    tenant: { organizationId: 'org-a', rlsOrganizationId: 'org-a', rlsAllowed: true, plan: 'test', entitledModules: [toolDefinition.id] },
    actor: { actorId: 'agent-a', organizationId: 'org-a', role: 'agent', capabilities: [] }, enabledModules: [], maxRisk: 'P4', approval: { required: false, approved: false },
  };
}

function tool(risk: AgentToolDefinition['risk']): AgentToolDefinition {
  const hasSideEffect = risk !== 'r0_read';
  return {
    id: `tool.${risk}`,
    owner: 'agent-engine.test',
    source: 'internal',
    schema: { kind: 'inline', value: {} },
    risk,
    hasSideEffect,
    idempotencyRequired: hasSideEffect,
    timeoutMs: 1_000,
    maxRetries: 0,
  };
}

function gatewayInput(
  autonomyLevel: 'shadow' | 'draft',
  risk: AgentToolDefinition['risk'],
  execute: () => Promise<unknown>,
) {
  return {
    organizationId: 'org-a',
    agentId: 'agent-a',
    runId: 'run-a',
    autonomyLevel,
    tool: tool(risk),
    args: { value: 1 },
    idempotencyKey: `idem-${risk}`,
    execute,
    approvalStore: null,
    entitlement: entitlementFor(tool(risk), `idem-${risk}`),
  } as const;
}

describe('SHADOW and DRAFT autonomy', () => {
  it('SHADOW never executes a side-effecting capability', async () => {
    const execute = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
    const result = await executeThroughToolGateway(
      gatewayInput('shadow', 'r1_reversible_write', execute),
    );

    expect(result).toEqual({ kind: 'denied', reason: 'shadow_side_effects_disabled' });
    expect(execute).not.toHaveBeenCalled();
  });

  for (const risk of [
    'r1_reversible_write',
    'r2_external_communication',
    'r3_sensitive_commercial',
  ] as const) {
    it(`DRAFT returns a proposal and executes zero side effects for ${risk}`, async () => {
      const execute = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
      const result = await executeThroughToolGateway(gatewayInput('draft', risk, execute));

      expect(result).toEqual({
        kind: 'draft',
        proposal: {
          toolId: `tool.${risk}`,
          args: { value: 1 },
          idempotencyKey: `idem-${risk}`,
        },
      });
      expect(execute).not.toHaveBeenCalled();
    });
  }

  it('DRAFT can execute an R0 read when policy permits', async () => {
    const execute = vi.fn<() => Promise<unknown>>().mockResolvedValue({ leadId: 'lead-a' });
    const result = await executeThroughToolGateway(gatewayInput('draft', 'r0_read', execute));

    expect(result).toEqual({ kind: 'executed', result: { leadId: 'lead-a' } });
    expect(execute).toHaveBeenCalledOnce();
  });
});
