import { describe, expect, it, vi } from 'vitest';

import { executeThroughToolGateway } from '../tools/gateway';
import type { AgentToolDefinition } from '../tools/registry';

const reversibleTool: AgentToolDefinition = {
  id: 'crm.contact.update',
  description: 'Update contact',
  risk: 'r1_reversible_write',
  hasSideEffect: true,
  idempotencyRequired: true,
  maxRetries: 0,
};

const promotionDecision = { kind: 'allow', evidenceRef: 'eval-7' } as const;

describe('Phase 5 runtime autonomy rollback', () => {
  it('rechecks a global kill switch immediately before a side effect', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const resolver = { resolve: vi.fn().mockResolvedValue({
      level: 'assisted' as const,
      globalEnabled: false,
      tenantEnabled: true,
      agentEnabled: true,
      capabilityEnabled: true,
    }) };

    const result = await executeThroughToolGateway({
      organizationId: 'org-a',
      agentId: 'agent-a',
      runId: 'run-a',
      autonomyLevel: 'assisted',
      promotionDecision,
      runtimeAutonomyResolver: resolver,
      tool: reversibleTool,
      args: { name: 'A' },
      idempotencyKey: 'idem-1',
      execute,
      approvalStore: null,
    });

    expect(resolver.resolve).toHaveBeenCalledWith({
      organizationId: 'org-a',
      agentId: 'agent-a',
      capabilityId: 'crm.contact.update',
    });
    expect(result).toEqual({ kind: 'denied', reason: 'global_kill_switch' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('applies a capability kill switch without restart or deploy', async () => {
    const execute = vi.fn();
    const resolver = { resolve: vi.fn().mockResolvedValue({
      level: 'assisted' as const,
      globalEnabled: true,
      tenantEnabled: true,
      agentEnabled: true,
      capabilityEnabled: false,
    }) };

    const result = await executeThroughToolGateway({
      organizationId: 'org-a', agentId: 'agent-a', autonomyLevel: 'assisted', promotionDecision,
      runtimeAutonomyResolver: resolver, tool: reversibleTool, args: {}, idempotencyKey: 'idem-2', execute, approvalStore: null,
    });

    expect(result).toEqual({ kind: 'denied', reason: 'capability_kill_switch' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('applies a runtime rollback from assisted to draft before executing', async () => {
    const execute = vi.fn();
    const resolver = { resolve: vi.fn().mockResolvedValue({
      level: 'draft' as const,
      globalEnabled: true,
      tenantEnabled: true,
      agentEnabled: true,
      capabilityEnabled: true,
    }) };

    const result = await executeThroughToolGateway({
      organizationId: 'org-a', agentId: 'agent-a', autonomyLevel: 'assisted', promotionDecision,
      runtimeAutonomyResolver: resolver, tool: reversibleTool, args: { name: 'Draft' }, idempotencyKey: 'idem-3', execute, approvalStore: null,
    });

    expect(result.kind).toBe('draft');
    expect(execute).not.toHaveBeenCalled();
  });
});
