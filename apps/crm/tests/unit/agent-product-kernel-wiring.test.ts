import { describe, expect, it, vi } from 'vitest';

import { createAgentKernel } from '@/lib/agent-engine/kernel/agent-kernel';
import type { AgentKernelInput } from '@/lib/agent-engine/kernel/contracts';
import type { AgentKernelDependencies, KernelExecutionState } from '@/lib/agent-engine/kernel/ports';
import { createProductAgentResolver } from '@/lib/agent-engine/product-agents/resolver';
import { createProductAgentVerificationPort } from '@/lib/agent-engine/product-agents/verification';

const input: AgentKernelInput = {
  organizationId: 'org-a',
  agentId: 'supervisor',
  goal: 'Route this request safely.',
  trigger: { kind: 'test', sourceId: 'conversation-a', eventId: 'event-a' },
  runId: 'run-a',
  traceId: 'trace-a',
  correlationId: 'corr-a',
};

function kernelHarness(output: unknown, bindingOverrides: Partial<{ organizationId: string; agentId: string; version: string; enabled: boolean }> = {}) {
  const resolveAgent = createProductAgentResolver(async () => ({
    organizationId: 'org-a',
    agentId: 'supervisor',
    version: '1.0.0',
    enabled: true,
    ...bindingOverrides,
  }));
  const state: KernelExecutionState = { status: 'running', completedSideEffectKeys: [] };
  const memoryWrite = vi.fn();
  const runtimeStep = vi.fn().mockResolvedValue({
    kind: 'final',
    output,
    progressFingerprint: 'final',
    usage: { tokens: 10, costCents: 1, latencyMs: 5 },
  });

  const dependencies: AgentKernelDependencies = {
    resolveAgent,
    createIdentity: vi.fn().mockImplementation(async (kernelInput, agent) => ({
      runId: kernelInput.runId ?? 'run-generated',
      organizationId: kernelInput.organizationId,
      agentId: agent.definition.id,
      agentVersion: agent.definition.version,
      triggerEventId: kernelInput.trigger.eventId,
      traceId: kernelInput.traceId ?? 'trace-generated',
      correlationId: kernelInput.correlationId ?? 'corr-generated',
      goal: kernelInput.goal,
      trigger: kernelInput.trigger,
      definition: agent.definition,
      resume: kernelInput.resume === true,
    })),
    loadContext: vi.fn().mockResolvedValue({ authoritative: {}, derivedMemory: {}, sources: ['crm'] }),
    loadSkills: vi.fn().mockResolvedValue({ activatedSkillVersions: [], index: '', bodies: '' }),
    resolveTools: vi.fn().mockResolvedValue({ definitions: new Map() }),
    selectModel: vi.fn().mockResolvedValue({
      id: 'test-model',
      provider: 'test-provider',
      capabilities: ['structured_output'],
      certified: true,
      enabled: true,
    }),
    runtime: { step: runtimeStep },
    toolGateway: { execute: vi.fn() },
    execution: {
      start: vi.fn().mockResolvedValue(state),
      resume: vi.fn().mockResolvedValue(state),
      checkpoint: vi.fn().mockResolvedValue(state),
      pause: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'waiting_approval' as const })),
      complete: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'completed' as const })),
      stop: vi.fn().mockImplementation(async (current, status) => ({ ...current, status })),
      fail: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'permanent_failure' as const })),
    },
    verification: createProductAgentVerificationPort(),
    evidence: { record: vi.fn() },
    memory: { write: memoryWrite },
    events: { emit: vi.fn() },
  };

  return { dependencies, runtimeStep, memoryWrite };
}

describe('Product-agent Kernel wiring', () => {
  it('resolves the exact versioned product definition through the Kernel resolver port', async () => {
    const resolver = createProductAgentResolver(async () => ({
      organizationId: 'org-a', agentId: 'sales', version: '1.0.0', enabled: true,
    }));

    const resolved = await resolver({ ...input, agentId: 'sales' });
    expect(resolved?.organizationId).toBe('org-a');
    expect(resolved?.enabled).toBe(true);
    expect(resolved?.definition.id).toBe('sales');
    expect(resolved?.definition.version).toBe('1.0.0');
    expect(resolved?.definition.autonomyLevel).toBe('shadow');
  });

  it('fails closed when the binding points at an unknown or mismatched product version', async () => {
    const wrongVersion = createProductAgentResolver(async () => ({
      organizationId: 'org-a', agentId: 'sales', version: '2.0.0', enabled: true,
    }));
    const unknown = createProductAgentResolver(async () => null);

    expect(await wrongVersion({ ...input, agentId: 'sales' })).toBeNull();
    expect(await unknown({ ...input, agentId: 'unknown_agent' })).toBeNull();
  });

  it('completes a valid Supervisor SHADOW result through the canonical AgentKernel', async () => {
    const { dependencies, memoryWrite } = kernelHarness({
      targetAgent: 'atendimento',
      reason: 'support_request',
      confidence: 0.9,
      requiresHumanEscalation: false,
    });

    const result = await createAgentKernel(dependencies).run(input);
    expect(result.status).toBe('completed');
    expect(result.stopReason).toBe('completed');
    expect(memoryWrite).not.toHaveBeenCalled();
  });

  it('blocks malformed Supervisor output at the Kernel verification boundary', async () => {
    const { dependencies, memoryWrite } = kernelHarness({ targetAgent: 'unknown' });

    const result = await createAgentKernel(dependencies).run(input);
    expect(result.status).toBe('blocked');
    expect(result.stopReason).toBe('verification_failed');
    expect(memoryWrite).not.toHaveBeenCalled();
  });

  it('preserves tenant mismatch and disabled-agent fail-closed behavior', async () => {
    const crossTenant = kernelHarness({ targetAgent: 'escalation' }, { organizationId: 'org-b' });
    const disabled = kernelHarness({ targetAgent: 'escalation' }, { enabled: false });

    const crossTenantResult = await createAgentKernel(crossTenant.dependencies).run(input);
    const disabledResult = await createAgentKernel(disabled.dependencies).run(input);

    expect(crossTenantResult).toMatchObject({ status: 'blocked', stopReason: 'tenant_mismatch' });
    expect(disabledResult).toMatchObject({ status: 'blocked', stopReason: 'agent_disabled' });
    expect(crossTenant.runtimeStep).not.toHaveBeenCalled();
    expect(disabled.runtimeStep).not.toHaveBeenCalled();
  });
});
