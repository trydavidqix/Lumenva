import { describe, expect, it, vi } from 'vitest';
import { composeKernelTools, createKernelToolResolver } from '../kernel/composition';

const execution = {
  runId: 'run-a', organizationId: 'org-a', agentId: 'agent-a', agentVersion: 'v1', traceId: 'trace-a', correlationId: 'corr-a', goal: 'test', trigger: { kind: 'test', sourceId: 'lead-a' },
  definition: { id: 'agent-a', version: 'v1', objective: 'test', autonomyLevel: 'shadow', allowedSkills: [], allowedTools: ['read_lead'], loop: { goal: 'test', maxSteps: 1, maxToolCalls: 1, maxTokens: 100, maxCostCents: 1, maxRuntimeMs: 1000, repeatedToolLimit: 1, noProgressLimit: 1 }, requiredModelCapabilities: [] }, resume: false,
} as const;

describe('AgentKernel composition', () => {
  it('composes only agent-allowed tools', () => {
    const allowed = { id: 'read_lead', risk: 'r0_read' as const, hasSideEffect: false, idempotencyRequired: false };
    const denied = { id: 'delete_tenant', risk: 'r4_destructive_admin' as const, hasSideEffect: true, idempotencyRequired: true };
    expect([...composeKernelTools(execution, { activatedSkillVersions: [], index: '', bodies: '' }, [allowed, denied]).definitions.keys()]).toEqual(['read_lead']);
  });

  it('honors skill-requested tool narrowing and loads the registry with tenant identity', async () => {
    const loadRegistry = vi.fn().mockResolvedValue([{ id: 'read_lead', risk: 'r0_read', hasSideEffect: false, idempotencyRequired: false }]);
    const result = await createKernelToolResolver({ loadRegistry })(execution, { activatedSkillVersions: [], index: '', bodies: '', requestedToolIds: ['read_lead'] });
    expect(loadRegistry).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-a' }));
    expect(result.definitions.has('read_lead')).toBe(true);
  });
});
