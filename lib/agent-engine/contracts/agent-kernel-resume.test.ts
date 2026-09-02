import { describe, expect, it, vi } from 'vitest';
import { deriveToolIdempotencyKey, type AgentDefinition } from './agent-os';
import { createAgentKernel } from '../kernel/agent-kernel';
import type { AgentKernelDependencies, KernelExecutionState } from '../kernel/ports';
import type { AgentToolDefinition } from '../tools/registry';

const tool: AgentToolDefinition = {
  id: 'update_lead_state', owner: 'agent-engine.lead-state', source: 'internal',
  schema: { kind: 'inline', value: {} }, risk: 'r1_reversible_write', hasSideEffect: true,
  idempotencyRequired: true, timeoutMs: 1_000, maxRetries: 0,
};

const definition: AgentDefinition = {
  id: 'agent-a', version: 'v1', objective: 'Resume safely', autonomyLevel: 'assisted',
  allowedSkills: [], allowedTools: [tool.id],
  loop: { goal: 'Resume safely', maxSteps: 4, maxToolCalls: 4, maxTokens: 1_000, maxCostCents: 20, maxRuntimeMs: 30_000, repeatedToolLimit: 3, noProgressLimit: 3 },
  requiredModelCapabilities: ['structured_output'],
};

const execution = {
  runId: 'run-a', organizationId: 'org-a', agentId: 'agent-a', agentVersion: 'v1',
  traceId: 'trace-a', correlationId: 'corr-a', goal: 'Resume safely',
  trigger: { kind: 'test', sourceId: 'lead-a' }, definition, resume: true,
};

const completedKey = deriveToolIdempotencyKey({
  runId: execution.runId,
  stepId: 'step-1',
  tool: tool.id,
  businessTarget: { leadId: 'lead-a' },
});

function harness() {
  const restored: KernelExecutionState = {
    status: 'running',
    checkpointStepId: 'step-1',
    completedSideEffectKeys: [completedKey],
  };
  const runtimeStep = vi.fn()
    .mockResolvedValueOnce({
      kind: 'tool_call', stepId: 'step-1', toolId: tool.id,
      args: { stage: 'qualified' }, businessTarget: { leadId: 'lead-a' },
      progressFingerprint: 'already-done', usage: { tokens: 5, costCents: 1, latencyMs: 2 },
    })
    .mockResolvedValueOnce({
      kind: 'final', output: { resumed: true }, progressFingerprint: 'done',
      usage: { tokens: 5, costCents: 1, latencyMs: 2 },
    });

  const dependencies: AgentKernelDependencies = {
    resolveAgent: vi.fn().mockResolvedValue({ organizationId: 'org-a', enabled: true, definition }),
    createIdentity: vi.fn().mockResolvedValue(execution),
    loadContext: vi.fn().mockResolvedValue({ authoritative: {}, derivedMemory: {}, sources: ['crm'] }),
    loadSkills: vi.fn().mockResolvedValue({ activatedSkillVersions: [], index: '', bodies: '' }),
    resolveTools: vi.fn().mockResolvedValue({ definitions: new Map([[tool.id, tool]]) }),
    selectModel: vi.fn().mockResolvedValue({ id: 'test:model', provider: 'test', capabilities: ['structured_output'], certified: true, enabled: true }),
    runtime: { step: runtimeStep },
    toolGateway: { execute: vi.fn().mockResolvedValue({ kind: 'executed', result: { duplicated: true } }) },
    execution: {
      start: vi.fn().mockResolvedValue(restored),
      resume: vi.fn().mockResolvedValue(restored),
      checkpoint: vi.fn().mockImplementation(async (current) => current),
      pause: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'waiting_approval' as const })),
      complete: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'completed' as const })),
      stop: vi.fn().mockImplementation(async (current, status) => ({ ...current, status })),
      fail: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'permanent_failure' as const })),
    },
    verification: { verify: vi.fn().mockResolvedValue({ passed: true, evidence: 'ok' }) },
    evidence: { record: vi.fn() }, memory: { write: vi.fn() }, events: { emit: vi.fn() },
  };

  return dependencies;
}

describe('AgentKernel durable resume', () => {
  it('does not replay an already completed side effect after resume', async () => {
    const dependencies = harness();
    const result = await createAgentKernel(dependencies).run({
      organizationId: 'org-a', agentId: 'agent-a', goal: 'Resume safely',
      trigger: { kind: 'test', sourceId: 'lead-a' }, runId: 'run-a', traceId: 'trace-a', correlationId: 'corr-a', resume: true,
    });

    expect(result.status).toBe('completed');
    expect(dependencies.execution.resume).toHaveBeenCalledOnce();
    expect(dependencies.toolGateway.execute).not.toHaveBeenCalled();
    expect(dependencies.runtime.step).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ runId: 'run-a', traceId: 'trace-a', correlationId: 'corr-a' });
  });
});
