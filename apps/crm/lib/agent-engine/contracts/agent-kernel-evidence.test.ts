import { describe, expect, it, vi } from 'vitest';
import type { AgentDefinition } from './agent-os';
import { createAgentKernel } from '../kernel/agent-kernel';
import type { AgentKernelDependencies, KernelExecutionState } from '../kernel/ports';

const definition: AgentDefinition = {
  id: 'agent-a', version: 'v1', objective: 'Classify safely', autonomyLevel: 'assisted',
  allowedSkills: ['lead-qualification'], allowedTools: [],
  loop: { goal: 'Classify', maxSteps: 3, maxToolCalls: 2, maxTokens: 1_000, maxCostCents: 20, maxRuntimeMs: 30_000, repeatedToolLimit: 2, noProgressLimit: 2 },
  requiredModelCapabilities: ['structured_output'],
};

function harness(verificationPassed = true) {
  const state: KernelExecutionState = { status: 'running', completedSideEffectKeys: [] };
  const dependencies: AgentKernelDependencies = {
    resolveAgent: vi.fn().mockResolvedValue({ organizationId: 'org-a', enabled: true, definition }),
    createIdentity: vi.fn().mockResolvedValue({
      runId: 'run-a', organizationId: 'org-a', agentId: 'agent-a', agentVersion: 'v1',
      traceId: 'trace-a', correlationId: 'corr-a', goal: 'Classify',
      trigger: { kind: 'event', sourceId: 'lead-a', eventId: 'event-a', jobId: 'job-a' }, definition, resume: false,
    }),
    loadContext: vi.fn().mockResolvedValue({ authoritative: { leadId: 'lead-a' }, derivedMemory: { hint: 'warm' }, sources: ['crm:lead-a'] }),
    loadSkills: vi.fn().mockResolvedValue({ activatedSkillVersions: ['lead-qualification@2'], index: 'lead-qualification', bodies: 'rules' }),
    resolveTools: vi.fn().mockResolvedValue({ definitions: new Map() }),
    selectModel: vi.fn().mockResolvedValue({ id: 'test-provider:test-model', provider: 'test-provider', capabilities: ['structured_output'], certified: true, enabled: true }),
    runtime: { step: vi.fn().mockResolvedValue({ kind: 'final', output: { classification: 'qualified' }, progressFingerprint: 'done', usage: { tokens: 12, costCents: 2, latencyMs: 7 } }) },
    toolGateway: { execute: vi.fn() },
    execution: {
      start: vi.fn().mockResolvedValue(state), resume: vi.fn().mockResolvedValue(state), checkpoint: vi.fn().mockImplementation(async (current) => current),
      pause: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'waiting_approval' as const })),
      complete: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'completed' as const })),
      stop: vi.fn().mockImplementation(async (current, status) => ({ ...current, status })),
      fail: vi.fn().mockImplementation(async (current) => ({ ...current, status: 'permanent_failure' as const })),
    },
    verification: { verify: vi.fn().mockResolvedValue({ passed: verificationPassed, evidence: verificationPassed ? 'verified' : 'mismatch' }) },
    evidence: { record: vi.fn() }, memory: { write: vi.fn() }, events: { emit: vi.fn() },
  };
  return dependencies;
}

const input = {
  organizationId: 'org-a', agentId: 'agent-a', goal: 'Classify',
  trigger: { kind: 'event', sourceId: 'lead-a', eventId: 'event-a', jobId: 'job-a' },
  runId: 'run-a', traceId: 'trace-a', correlationId: 'corr-a',
};

describe('AgentKernel evidence and verification', () => {
  it('does not complete or write memory when verification fails', async () => {
    const dependencies = harness(false);
    const result = await createAgentKernel(dependencies).run(input);

    expect(result.status).toBe('blocked');
    expect(result.stopReason).toBe('verification_failed');
    expect(dependencies.execution.complete).not.toHaveBeenCalled();
    expect(dependencies.memory.write).not.toHaveBeenCalled();
  });

  it('records a complete run-start evidence envelope before runtime', async () => {
    const dependencies = harness(true);
    await createAgentKernel(dependencies).run(input);

    expect(dependencies.evidence.record).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-a', traceId: 'trace-a', kind: 'kernel_started',
      payload: expect.objectContaining({
        agentId: 'agent-a', organizationId: 'org-a', model: 'test-provider:test-model',
      }),
    }));
  });

  it('records explicit completed stop reason and usage', async () => {
    const dependencies = harness(true);
    await createAgentKernel(dependencies).run(input);

    expect(dependencies.evidence.record).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'kernel_step_final',
      payload: expect.objectContaining({
        steps: 1, tokens: 12, costCents: 2,
      }),
    }));
  });
});
