import { describe, expect, it, vi } from 'vitest';
import type { AgentDefinition } from './agent-os';
import { createAgentKernel } from '../kernel/agent-kernel';
import type { AgentKernelInput, ResolvedKernelAgent } from '../kernel/contracts';
import type { AgentKernelDependencies, KernelExecutionState } from '../kernel/ports';

const definition: AgentDefinition = {
  id: 'agent-a',
  version: 'v1',
  objective: 'Classify leads safely',
  autonomyLevel: 'assisted',
  allowedSkills: [],
  allowedTools: [],
  loop: {
    goal: 'Classify the lead',
    maxSteps: 4,
    maxToolCalls: 3,
    maxTokens: 1_000,
    maxCostCents: 20,
    maxRuntimeMs: 30_000,
    repeatedToolLimit: 2,
    noProgressLimit: 2,
  },
  requiredModelCapabilities: ['structured_output'],
};

const input: AgentKernelInput = {
  organizationId: 'org-a',
  agentId: 'agent-a',
  goal: 'Classify the lead',
  trigger: { kind: 'test', sourceId: 'lead-a', eventId: 'event-a', jobId: 'job-a' },
  runId: 'run-a',
  traceId: 'trace-a',
  correlationId: 'corr-a',
};

function harness(overrides: Partial<AgentKernelDependencies> = {}) {
  const state: KernelExecutionState = {
    status: 'running',
    completedSideEffectKeys: [],
  };
  const runtimeStep = vi.fn().mockResolvedValue({
    kind: 'final',
    output: { classification: 'qualified' },
    progressFingerprint: 'qualified',
    usage: { tokens: 10, costCents: 1, latencyMs: 5 },
  });
  const resolved: ResolvedKernelAgent = {
    organizationId: 'org-a',
    enabled: true,
    definition,
  };

  const dependencies: AgentKernelDependencies = {
    resolveAgent: vi.fn().mockResolvedValue(resolved),
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
    selectModel: vi.fn().mockResolvedValue({ id: 'test-provider:test-model', provider: 'test-provider', capabilities: ['structured_output'], certified: true, enabled: true }),
    runtime: { step: runtimeStep },
    toolGateway: { execute: vi.fn() },
    execution: {
      start: vi.fn().mockResolvedValue(state),
      resume: vi.fn().mockResolvedValue(state),
      checkpoint: vi.fn().mockImplementation(async (current, checkpoint) => ({
        ...current,
        checkpointStepId: checkpoint.stepId,
        completedSideEffectKeys: [
          ...current.completedSideEffectKeys,
          ...(checkpoint.completedSideEffectKeys ?? []),
        ],
      })),
      pause: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'waiting_approval' as const })),
      complete: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'completed' as const })),
      stop: vi.fn().mockImplementation(async (current, status) => ({ ...current, status })),
      fail: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'permanent_failure' as const })),
    },
    verification: { verify: vi.fn().mockResolvedValue({ passed: true, evidence: 'verified' }) },
    evidence: { record: vi.fn() },
    memory: { write: vi.fn() },
    events: { emit: vi.fn() },
    ...overrides,
  };

  return { dependencies, runtimeStep };
}

describe('AgentKernel integration contract', () => {
  it('completes a verified provider-agnostic happy path with explicit evidence', async () => {
    const { dependencies } = harness();
    const result = await createAgentKernel(dependencies).run(input);

    expect(result).toMatchObject({
      status: 'completed',
      stopReason: 'completed',
      runId: 'run-a',
      traceId: 'trace-a',
    });
    expect(dependencies.verification.verify).toHaveBeenCalledOnce();
    expect(dependencies.memory.write).toHaveBeenCalledOnce();
    expect(dependencies.events.emit).toHaveBeenCalled();
  });

  it('fails closed on cross-tenant resolution before runtime work', async () => {
    const { dependencies, runtimeStep } = harness({
      resolveAgent: vi.fn().mockResolvedValue({
        organizationId: 'org-b',
        enabled: true,
        definition,
      }),
    });

    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('blocked');
    expect(result.stopReason).toBe('tenant_mismatch');
    expect(runtimeStep).not.toHaveBeenCalled();
    expect(dependencies.loadContext).not.toHaveBeenCalled();
  });

  it('fails closed on invalid effective version before identity, context or model runtime work', async () => {
    const invalidDefinition = { ...definition, version: '   ' };
    const { dependencies, runtimeStep } = harness({
      resolveAgent: vi.fn().mockResolvedValue({ organizationId: 'org-a', enabled: true, definition: invalidDefinition }),
    });

    const result = await createAgentKernel(dependencies).run(input);

    expect(result).toMatchObject({ status: 'blocked', stopReason: 'invalid_agent_version' });
    expect(dependencies.createIdentity).not.toHaveBeenCalled();
    expect(dependencies.loadContext).not.toHaveBeenCalled();
    expect(runtimeStep).not.toHaveBeenCalled();
  });

  it('rejects execution when no certified compatible model exists', async () => {
    const { dependencies, runtimeStep } = harness({ selectModel: vi.fn().mockResolvedValue(null) });
    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('blocked');
    expect(result.stopReason).toBe('model_unavailable');
    expect(runtimeStep).not.toHaveBeenCalled();
  });
});
