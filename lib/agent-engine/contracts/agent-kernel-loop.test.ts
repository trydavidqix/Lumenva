import { describe, expect, it, vi } from 'vitest';
import type { AgentDefinition } from './agent-os';
import { createAgentKernel } from '../kernel/agent-kernel';
import type { AgentKernelDependencies, KernelExecutionState, KernelRuntimeStep } from '../kernel/ports';
import type { AgentToolDefinition } from '../tools/registry';

const tool: AgentToolDefinition = {
  id: 'update_lead_state',
  owner: 'agent-engine.lead-state',
  source: 'internal',
  schema: { kind: 'inline', value: {} },
  risk: 'r1_reversible_write',
  hasSideEffect: true,
  idempotencyRequired: true,
  timeoutMs: 1_000,
  maxRetries: 0,
};

function definition(overrides: Partial<AgentDefinition['loop']> = {}): AgentDefinition {
  return {
    id: 'agent-a',
    version: 'v1',
    objective: 'Act safely',
    autonomyLevel: 'assisted',
    allowedSkills: [],
    allowedTools: [tool.id],
    loop: {
      goal: 'Act safely',
      maxSteps: 8,
      maxToolCalls: 8,
      maxTokens: 10_000,
      maxCostCents: 1_000,
      maxRuntimeMs: 60_000,
      repeatedToolLimit: 2,
      noProgressLimit: 3,
      ...overrides,
    },
    requiredModelCapabilities: ['structured_output'],
  };
}

function harness(
  runtimeStep: (call: number) => KernelRuntimeStep,
  def = definition(),
  toolDefinition: AgentToolDefinition = tool,
) {
  let calls = 0;
  const step = vi.fn().mockImplementation(async () => runtimeStep(++calls));
  const state: KernelExecutionState = { status: 'running', completedSideEffectKeys: [] };

  const dependencies: AgentKernelDependencies = {
    resolveAgent: vi.fn().mockResolvedValue({ organizationId: 'org-a', enabled: true, definition: def }),
    createIdentity: vi.fn().mockResolvedValue({
      runId: 'run-a', organizationId: 'org-a', agentId: 'agent-a', agentVersion: 'v1',
      traceId: 'trace-a', correlationId: 'corr-a', goal: 'Act safely',
      trigger: { kind: 'test', sourceId: 'lead-a' }, definition: def, resume: false,
    }),
    loadContext: vi.fn().mockResolvedValue({ authoritative: {}, derivedMemory: {}, sources: ['crm'] }),
    loadSkills: vi.fn().mockResolvedValue({ activatedSkillVersions: [], index: '', bodies: '' }),
    resolveTools: vi.fn().mockResolvedValue({ definitions: new Map([[toolDefinition.id, toolDefinition]]) }),
    selectModel: vi.fn().mockResolvedValue({ id: 'test:model', provider: 'test', capabilities: ['structured_output'], certified: true, enabled: true }),
    runtime: { step },
    toolGateway: { execute: vi.fn().mockResolvedValue({ kind: 'executed', result: { ok: true } }) },
    execution: {
      start: vi.fn().mockResolvedValue(state),
      resume: vi.fn().mockResolvedValue(state),
      checkpoint: vi.fn().mockImplementation(async (current) => current),
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

  return dependencies;
}

const input = {
  organizationId: 'org-a', agentId: 'agent-a', goal: 'Act safely',
  trigger: { kind: 'test', sourceId: 'lead-a' }, runId: 'run-a', traceId: 'trace-a', correlationId: 'corr-a',
};

function toolStep(call: number, progressFingerprint: string, args: unknown = { stage: 'qualified' }): KernelRuntimeStep {
  return {
    kind: 'tool_call',
    stepId: `step-${call}`,
    toolId: tool.id,
    args,
    businessTarget: { leadId: 'lead-a' },
    progressFingerprint,
    usage: { tokens: 10, costCents: 1, latencyMs: 5 },
  };
}

function finalStep(): KernelRuntimeStep {
  return {
    kind: 'final',
    output: { ok: true },
    progressFingerprint: 'done',
    usage: { tokens: 1, costCents: 1, latencyMs: 1 },
  };
}

describe('AgentKernel bounded loop', () => {
  it('stops repeated identical tool calls deterministically', async () => {
    const dependencies = harness((call) => toolStep(call, 'same-progress'));
    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('blocked');
    expect(result.stopReason).toBe('repeated_tool_exhausted');
    expect(dependencies.toolGateway.execute).toHaveBeenCalledTimes(1);
  });

  it('stops a no-progress loop even when tool invocations differ', async () => {
    const dependencies = harness(
      (call) => toolStep(call, 'stalled', { stage: `stage-${call}` }),
      definition({ repeatedToolLimit: 8, noProgressLimit: 3 }),
    );
    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('blocked');
    expect(result.stopReason).toBe('no_progress_exhausted');
    expect(dependencies.toolGateway.execute).toHaveBeenCalledTimes(2);
  });

  it('stops on token budget before another runtime step', async () => {
    const dependencies = harness(
      (call) => toolStep(call, `progress-${call}`),
      definition({ maxTokens: 10, repeatedToolLimit: 8, noProgressLimit: 8 }),
    );
    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('budget_exhausted');
    expect(result.stopReason).toBe('max_tokens_exhausted');
    expect(dependencies.runtime.step).toHaveBeenCalledOnce();
  });

  it('retries a retryable tool failure with the same idempotency identity', async () => {
    const retryTool = { ...tool, maxRetries: 1 };
    const dependencies = harness((call) => call === 1 ? toolStep(call, 'progress-1') : finalStep(), definition({ repeatedToolLimit: 8, noProgressLimit: 8 }), retryTool);
    dependencies.toolGateway.execute = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('temporary'), { retryable: true }))
      .mockResolvedValueOnce({ kind: 'executed', result: { ok: true } });

    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('permanent_failure');
    expect(result.stopReason).toBe('runtime_error');
    expect(dependencies.toolGateway.execute).toHaveBeenCalledTimes(1);
  });

  it('returns retryable_failure when retryable tool failures exhaust retries', async () => {
    const retryTool = { ...tool, maxRetries: 1 };
    const dependencies = harness(() => toolStep(1, 'progress-1'), definition({ repeatedToolLimit: 8, noProgressLimit: 8 }), retryTool);
    dependencies.toolGateway.execute = vi.fn().mockRejectedValue(Object.assign(new Error('temporary'), { retryable: true }));

    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('permanent_failure');
    expect(result.stopReason).toBe('runtime_error');
    expect(dependencies.toolGateway.execute).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a permanent tool failure without retrying', async () => {
    const retryTool = { ...tool, maxRetries: 2 };
    const dependencies = harness(() => toolStep(1, 'progress-1'), definition({ repeatedToolLimit: 8, noProgressLimit: 8 }), retryTool);
    dependencies.toolGateway.execute = vi.fn().mockRejectedValue(Object.assign(new Error('permanent'), { retryable: false }));

    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('permanent_failure');
    expect(result.stopReason).toBe('runtime_error');
    expect(dependencies.toolGateway.execute).toHaveBeenCalledOnce();
  });
});
