import { describe, expect, it, vi } from 'vitest';

import { executeThroughToolGateway } from '../tools/gateway';
import type { AgentToolDefinition } from '../tools/registry';

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

describe('Phase 5 runtime autonomy rollback', () => {
  it.each([
    ['global', { level: 'assisted' as const, globalEnabled: false, tenantEnabled: true, agentEnabled: true, capabilityEnabled: true }, 'global_kill_switch'],
    ['tenant', { level: 'assisted' as const, globalEnabled: true, tenantEnabled: false, agentEnabled: true, capabilityEnabled: true }, 'tenant_kill_switch'],
    ['agent', { level: 'assisted' as const, globalEnabled: true, tenantEnabled: true, agentEnabled: false, capabilityEnabled: true }, 'agent_kill_switch'],
    ['capability', { level: 'assisted' as const, globalEnabled: true, tenantEnabled: true, agentEnabled: true, capabilityEnabled: false }, 'capability_kill_switch'],
  ])('blocks a %s kill switch immediately before a side effect', async (_scope, state, reason) => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const runtimeAutonomyResolver = { resolve: vi.fn().mockResolvedValue(state) };

    const result = await executeThroughToolGateway({
      organizationId: 'org-a',
      agentId: 'agent-a',
      runId: 'run-a',
      autonomyLevel: 'assisted',
      promotionDecision,
      runtimeAutonomyResolver,
      tool: reversibleTool,
      args: { name: 'A' },
      idempotencyKey: 'idem-1',
      execute,
      approvalStore: null,
    });

    expect(runtimeAutonomyResolver.resolve).toHaveBeenCalledWith({
      organizationId: 'org-a',
      agentId: 'agent-a',
      capabilityId: 'crm.contact.update',
    });
    expect(result).toEqual({ kind: 'denied', reason });
    expect(execute).not.toHaveBeenCalled();
  });

  it('applies a runtime rollback from assisted to draft before executing', async () => {
    const execute = vi.fn();
    const runtimeAutonomyResolver = { resolve: vi.fn().mockResolvedValue({
      level: 'draft' as const,
      globalEnabled: true,
      tenantEnabled: true,
      agentEnabled: true,
      capabilityEnabled: true,
    }) };

    const result = await executeThroughToolGateway({
      organizationId: 'org-a',
      agentId: 'agent-a',
      autonomyLevel: 'assisted',
      promotionDecision,
      runtimeAutonomyResolver,
      tool: reversibleTool,
      args: { name: 'Draft' },
      idempotencyKey: 'idem-3',
      execute,
      approvalStore: null,
    });

    expect(result.kind).toBe('draft');
    expect(execute).not.toHaveBeenCalled();
  });
});
