import { describe, expect, it } from 'vitest';

import type { AgentToolDefinition } from '../tools/registry';
import { evaluateToolPolicy } from '../policies/engine';

function tool(
  risk: AgentToolDefinition['risk'],
  overrides: Partial<AgentToolDefinition> = {},
): AgentToolDefinition {
  const hasSideEffect = risk !== 'r0_read';
  return {
    id: `tool.${risk}`,
    owner: 'agent-engine.test',
    source: 'internal',
    schema: { kind: 'inline', value: {} },
    risk,
    hasSideEffect,
    idempotencyRequired: hasSideEffect,
    timeoutMs: 10_000,
    maxRetries: 1,
    ...overrides,
  };
}

const base = {
  organizationId: 'org-1',
  agentId: 'agent-1',
  autonomyLevel: 'autopilot_low_risk' as const,
  tenantPolicy: {},
  agentPolicy: {},
};

describe('Agent OS policy engine', () => {
  it('ALLOW: libera leitura e escrita reversível em autopilot_low_risk', () => {
    expect(evaluateToolPolicy({ ...base, tool: tool('r0_read') })).toEqual({ kind: 'allow' });
    expect(evaluateToolPolicy({ ...base, tool: tool('r1_reversible_write') })).toEqual({
      kind: 'allow',
    });
  });

  it('REQUIRE_APPROVAL: comunicação externa não roda autonomamente em autopilot_low_risk', () => {
    expect(evaluateToolPolicy({ ...base, tool: tool('r2_external_communication') })).toEqual({
      kind: 'require_approval',
      reason: 'autonomy_level_requires_approval',
      approvalType: 'external_communication',
    });
  });

  it('REQUIRE_APPROVAL: R3 sempre exige aprovação explícita antes de executar', () => {
    expect(
      evaluateToolPolicy({
        ...base,
        autonomyLevel: 'autopilot_expanded',
        tool: tool('r3_sensitive_commercial'),
      }),
    ).toEqual({
      kind: 'require_approval',
      reason: 'sensitive_commercial_requires_approval',
      approvalType: 'sensitive_commercial',
    });
  });

  it('DENY: R4 nunca pode ser executada autonomamente, mesmo no maior nível', () => {
    expect(
      evaluateToolPolicy({
        ...base,
        autonomyLevel: 'autopilot_expanded',
        tool: tool('r4_destructive_admin'),
      }),
    ).toEqual({ kind: 'deny', reason: 'r4_requires_human' });
  });

  it('DENY vence ALLOW quando tenant ou agente bloqueia explicitamente a capability', () => {
    const candidate = tool('r1_reversible_write', { id: 'crm.assign' });

    expect(
      evaluateToolPolicy({
        ...base,
        tool: candidate,
        tenantPolicy: { deniedToolIds: ['crm.assign'] },
      }),
    ).toEqual({ kind: 'deny', reason: 'tool_denied_by_tenant_policy' });

    expect(
      evaluateToolPolicy({
        ...base,
        tool: candidate,
        agentPolicy: { deniedToolIds: ['crm.assign'] },
      }),
    ).toEqual({ kind: 'deny', reason: 'tool_denied_by_agent_policy' });
  });

  it('policy explícita de aprovação vence o nível de autonomia', () => {
    const candidate = tool('r1_reversible_write', { id: 'crm.update' });

    expect(
      evaluateToolPolicy({
        ...base,
        autonomyLevel: 'autopilot_expanded',
        tool: candidate,
        agentPolicy: { approvalToolIds: ['crm.update'] },
      }),
    ).toEqual({
      kind: 'require_approval',
      reason: 'tool_requires_explicit_approval',
      approvalType: 'tool_execution',
    });
  });
});
