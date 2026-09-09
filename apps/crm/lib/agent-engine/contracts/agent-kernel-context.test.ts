import { describe, expect, it, vi } from 'vitest';
import { createKernelContextLoader, createKernelSkillLoader } from '../kernel/context-loader';

const execution = {
  runId: 'run-a', organizationId: 'org-a', agentId: 'agent-a', agentVersion: 'v1',
  traceId: 'trace-a', correlationId: 'corr-a', goal: 'Classify',
  trigger: { kind: 'event', sourceId: 'lead-a', eventId: 'event-a' },
  definition: { id: 'agent-a', version: 'v1', objective: 'Classify', autonomyLevel: 'assisted', allowedSkills: ['lead-qualification'], allowedTools: [], loop: { goal: 'Classify', maxSteps: 3, maxToolCalls: 2, maxTokens: 1000, maxCostCents: 20, maxRuntimeMs: 30000, repeatedToolLimit: 2, noProgressLimit: 2 }, requiredModelCapabilities: ['structured_output'] },
  resume: false,
} as const;

describe('AgentKernel context loader', () => {
  it('keeps authoritative CRM state separate from conflicting derived memory', async () => {
    const loader = createKernelContextLoader({
      loadAuthoritative: vi.fn().mockResolvedValue({ leadId: 'lead-a', stage: 'won' }),
      loadDerivedMemory: vi.fn().mockResolvedValue({ leadId: 'wrong', stage: 'lost', hint: 'warm' }),
    });
    await expect(loader(execution)).resolves.toEqual({
      authoritative: { leadId: 'lead-a', stage: 'won' },
      derivedMemory: { leadId: 'wrong', stage: 'lost', hint: 'warm' },
      sources: ['crm:lead-a'],
    });
  });

  it('passes tenant identity to every context source', async () => {
    const loadAuthoritative = vi.fn().mockResolvedValue({});
    const loadDerivedMemory = vi.fn().mockResolvedValue({});
    const loader = createKernelContextLoader({ loadAuthoritative, loadDerivedMemory });
    await loader(execution);
    expect(loadAuthoritative).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-a' }));
    expect(loadDerivedMemory).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-a' }));
  });

  it('loads only tenant-visible ACTIVE agent-allowed skills with progressive disclosure bounds', async () => {
    const loader = createKernelSkillLoader({
      load: vi.fn().mockResolvedValue({
        activatedSkillVersions: ['lead-qualification@2'],
        index: '- lead-qualification: qualify leads',
        bodies: '### lead-qualification\nqualification rules',
      }),
    });

    await expect(loader(execution, { authoritative: {}, derivedMemory: {}, sources: ['crm:lead-a'] })).resolves.toEqual({
      activatedSkillVersions: ['lead-qualification@2'],
      index: '- lead-qualification: qualify leads',
      bodies: '### lead-qualification\nqualification rules',
    });
  });
});
