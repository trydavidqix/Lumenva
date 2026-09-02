import { describe, expect, it, vi } from 'vitest';
import type { AgentDefinition } from './agent-os';
import { createAgentKernel } from '../kernel/agent-kernel';
import type { AgentKernelInput, ResolvedKernelAgent } from '../kernel/contracts';
import type { AgentKernelDependencies, KernelExecutionState } from '../kernel/ports';
import { executeThroughToolGateway } from '../tools/gateway';
import type { AgentToolDefinition } from '../tools/registry';

const definition: AgentDefinition = {
  id: 'agent-a',
  version: 'v1',
  objective: 'Act safely',
  autonomyLevel: 'assisted',
  allowedSkills: [],
  allowedTools: ['update_lead_state'],
  loop: {
    goal: 'Update safely',
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
  goal: 'Update safely',
  trigger: { kind: 'test', sourceId: 'lead-a', eventId: 'event-a' },
  runId: 'run-a',
  traceId: 'trace-a',
  correlationId: 'corr-a',
};

const tool: AgentToolDefinition = {
  id: 'update_lead_state',
  owner: 'agent-engine.lead-state',
  source: 'internal',
  schema: { kind: 'inline', value: {} },
  risk: 'r1_reversible_write',
  hasSideEffect: true,
  idempotencyRequired: true,
  timeoutMs: 1_000,
  maxRetries: 1,
};

function harness(gatewayResult: { kind: 'executed'; result: unknown } | { kind: 'denied'; reason: string } | { kind: 'approval_required'; approvalId: string; reason: string }) {
  const resolved: ResolvedKernelAgent = { organizationId: 'org-a', enabled: true, definition };
  const state: KernelExecutionState = { status: 'running', completedSideEffectKeys: [] };
  const runtimeStep = vi.fn()
    .mockResolvedValueOnce({
      kind: 'tool_call',
      stepId: 'step-1',
      toolId: tool.id,
      args: { stage: 'qualified' },
      businessTarget: { leadId: 'lead-a' },
      progressFingerprint: 'tool:update',
      usage: { tokens: 10, costCents: 1, latencyMs: 5 },
    })
    .mockResolvedValueOnce({
      kind: 'final',
      output: { ok: true },
      progressFingerprint: 'final',
      usage: { tokens: 5, costCents: 1, latencyMs: 3 },
    });

  const dependencies: AgentKernelDependencies = {
    resolveAgent: vi.fn().mockResolvedValue(resolved),
    createIdentity: vi.fn().mockResolvedValue({
      runId: 'run-a', organizationId: 'org-a', agentId: 'agent-a', agentVersion: 'v1',
      traceId: 'trace-a', correlationId: 'corr-a', goal: input.goal, trigger: input.trigger,
      definition, resume: false,
    }),
    loadContext: vi.fn().mockResolvedValue({ authoritative: {}, derivedMemory: {}, sources: ['crm'] }),
    loadSkills: vi.fn().mockResolvedValue({ activatedSkillVersions: [], index: '', bodies: '' }),
    resolveTools: vi.fn().mockResolvedValue({ definitions: new Map([[tool.id, tool]]) }),
    selectModel: vi.fn().mockResolvedValue({ id: 'test:model', provider: 'test', capabilities: ['structured_output'], certified: true, enabled: true }),
    runtime: { step: runtimeStep },
    toolGateway: { execute: vi.fn().mockResolvedValue(gatewayResult) },
    execution: {
      start: vi.fn().mockResolvedValue(state),
      resume: vi.fn().mockResolvedValue(state),
      checkpoint: vi.fn().mockImplementation(async (current, checkpoint) => ({ ...current, checkpointStepId: checkpoint.stepId })),
      pause: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'waiting_approval' as const })),
      complete: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'completed' as const })),
      stop: vi.fn().mockImplementation(async (current, status) => ({ ...current, status })),
      fail: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'permanent_failure' as const })),
    },
    verification: { verify: vi.fn().mockResolvedValue({ passed: true, evidence: 'ok' }) },
    evidence: { record: vi.fn() },
    memory: { write: vi.fn() },
    events: { emit: vi.fn() },
  };

  return { dependencies, runtimeStep };
}

function withRealGatewayPolicy(
  autonomyLevel: AgentDefinition['autonomyLevel'],
  selectedTool: AgentToolDefinition,
  sideEffect: () => Promise<unknown>,
): AgentKernelDependencies {
  const { dependencies } = harness({ kind: 'executed', result: { unused: true } });
  const scopedDefinition: AgentDefinition = {
    ...definition,
    autonomyLevel,
    allowedTools: [selectedTool.id],
  };
  dependencies.resolveAgent = vi.fn().mockResolvedValue({ organizationId: 'org-a', enabled: true, definition: scopedDefinition });
  dependencies.createIdentity = vi.fn().mockResolvedValue({
    runId: 'run-a', organizationId: 'org-a', agentId: 'agent-a', agentVersion: 'v1',
    traceId: 'trace-a', correlationId: 'corr-a', goal: input.goal, trigger: input.trigger,
    definition: scopedDefinition, resume: false,
  });
  dependencies.resolveTools = vi.fn().mockResolvedValue({ definitions: new Map([[selectedTool.id, selectedTool]]) });
  dependencies.runtime.step = vi.fn().mockResolvedValue({
    kind: 'tool_call',
    stepId: 'step-1',
    toolId: selectedTool.id,
    args: { stage: 'qualified' },
    businessTarget: { leadId: 'lead-a' },
    progressFingerprint: `tool:${selectedTool.id}`,
    usage: { tokens: 10, costCents: 1, latencyMs: 5 },
  });
  dependencies.toolGateway.execute = vi.fn().mockImplementation(async ({ execution, tool: gatewayTool, args, idempotencyKey }) =>
    executeThroughToolGateway({
      organizationId: execution.organizationId,
      agentId: execution.agentId,
      runId: execution.runId,
      autonomyLevel: execution.definition.autonomyLevel,
      tool: gatewayTool,
      args,
      idempotencyKey,
      approvalStore: null,
      execute: sideEffect,
    }));
  return dependencies;
}

describe('AgentKernel policy and tool gateway integration', () => {
  it('executes resolved tools only through the gateway and continues to completion', async () => {
    const { dependencies, runtimeStep } = harness({ kind: 'executed', result: { updated: true } });
    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('completed');
    expect(dependencies.toolGateway.execute).toHaveBeenCalledOnce();
    expect(dependencies.toolGateway.execute).toHaveBeenCalledWith(expect.objectContaining({
      tool,
      idempotencyKey: expect.stringContaining('run-a'),
    }));
    expect(runtimeStep).toHaveBeenCalledTimes(2);
  });

  it('pauses the same run when the gateway requires approval', async () => {
    const { dependencies, runtimeStep } = harness({ kind: 'approval_required', approvalId: 'approval-1', reason: 'approval_required' });
    const result = await createAgentKernel(dependencies).run(input);

    expect(result).toMatchObject({
      status: 'waiting_approval',
      stopReason: 'approval_required',
      approvalId: 'approval-1',
      runId: 'run-a',
      traceId: 'trace-a',
    });
    expect(dependencies.execution.pause).toHaveBeenCalledOnce();
    expect(runtimeStep).toHaveBeenCalledOnce();
  });

  it('fails closed when the gateway denies the call', async () => {
    const { dependencies, runtimeStep } = harness({ kind: 'denied', reason: 'policy_denied' });
    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('policy_denied');
    expect(result.stopReason).toBe('policy_denied');
    expect(runtimeStep).toHaveBeenCalledOnce();
  });

  it('keeps SHADOW side effects at exactly zero through the real policy gateway', async () => {
    const sideEffect = vi.fn(async () => ({ updated: true }));
    const dependencies = withRealGatewayPolicy('shadow', tool, sideEffect);

    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('policy_denied');
    expect(result.stopReason).toBe('autonomy_side_effect_blocked');
    expect(sideEffect).not.toHaveBeenCalled();
  });

  it('never autonomously executes an R4 tool through the real policy gateway', async () => {
    const r4Tool: AgentToolDefinition = {
      ...tool,
      id: 'delete_tenant',
      risk: 'r4_destructive_admin',
      maxRetries: 0,
    };
    const sideEffect = vi.fn(async () => ({ deleted: true }));
    const dependencies = withRealGatewayPolicy('autopilot_expanded', r4Tool, sideEffect);

    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('policy_denied');
    expect(result.stopReason).toBe('r4_non_autonomous');
    expect(sideEffect).not.toHaveBeenCalled();
  });
});
