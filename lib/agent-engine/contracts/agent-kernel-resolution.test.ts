import { describe, expect, it, vi } from 'vitest';
import type { AgentDefinition } from './agent-os';
import { resolveKernelExecution } from '../kernel/resolution';

const definition: AgentDefinition = {
  id: 'agent-a', version: 'v1', objective: 'Classify', autonomyLevel: 'assisted',
  allowedSkills: [], allowedTools: [],
  loop: { goal: 'Classify', maxSteps: 3, maxToolCalls: 2, maxTokens: 1000, maxCostCents: 20, maxRuntimeMs: 30000, repeatedToolLimit: 2, noProgressLimit: 2 },
  requiredModelCapabilities: ['structured_output'],
};

const input = {
  organizationId: 'org-a', agentId: 'agent-a', goal: 'Classify',
  trigger: { kind: 'event', sourceId: 'lead-a', eventId: 'event-a', jobId: 'job-a' },
  runId: 'run-a', traceId: 'trace-a', correlationId: 'corr-a',
};

function createIdentity(kernelInput = input, agent = { organizationId: 'org-a', enabled: true, definition }) {
  return {
    runId: kernelInput.runId,
    organizationId: kernelInput.organizationId,
    agentId: agent.definition.id,
    agentVersion: agent.definition.version,
    triggerEventId: kernelInput.trigger.eventId,
    traceId: kernelInput.traceId,
    correlationId: kernelInput.correlationId,
    goal: kernelInput.goal,
    trigger: kernelInput.trigger,
    definition: agent.definition,
    resume: false,
  };
}

describe('AgentKernel resolution', () => {
  it('fails closed on cross-tenant agent resolution before identity creation', async () => {
    const resolveAgent = vi.fn().mockResolvedValue({ organizationId: 'org-b', enabled: true, definition });
    const identity = vi.fn();
    await expect(resolveKernelExecution(input, { resolveAgent, createIdentity: identity })).resolves.toEqual({ kind: 'blocked', reason: 'tenant_mismatch' });
    expect(identity).not.toHaveBeenCalled();
  });

  it('fails closed on disabled agents before identity creation', async () => {
    const resolveAgent = vi.fn().mockResolvedValue({ organizationId: 'org-a', enabled: false, definition });
    const identity = vi.fn();
    await expect(resolveKernelExecution(input, { resolveAgent, createIdentity: identity })).resolves.toEqual({ kind: 'blocked', reason: 'agent_disabled' });
    expect(identity).not.toHaveBeenCalled();
  });

  it('rejects an invalid effective version before identity creation', async () => {
    const resolveAgent = vi.fn().mockResolvedValue({ organizationId: 'org-a', enabled: true, definition: { ...definition, version: ' ' } });
    const identity = vi.fn();
    await expect(resolveKernelExecution(input, { resolveAgent, createIdentity: identity })).resolves.toEqual({ kind: 'blocked', reason: 'invalid_agent_version' });
    expect(identity).not.toHaveBeenCalled();
  });

  it('uses the canonical identity port and preserves supplied run, trace and correlation identity', async () => {
    const agent = { organizationId: 'org-a', enabled: true, definition };
    const resolveAgent = vi.fn().mockResolvedValue(agent);
    const identity = vi.fn().mockResolvedValue(createIdentity(input, agent));
    const result = await resolveKernelExecution(input, { resolveAgent, createIdentity: identity });
    expect(identity).toHaveBeenCalledWith(input, agent);
    expect(result).toMatchObject({ kind: 'resolved', execution: { runId: 'run-a', traceId: 'trace-a', correlationId: 'corr-a', organizationId: 'org-a', agentId: 'agent-a', agentVersion: 'v1' } });
  });
});
