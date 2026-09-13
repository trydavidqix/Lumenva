import { describe, expect, it, vi } from 'vitest';

import { createHermesFlywheelAdapter } from '../hermes/scheduled-adapter';

vi.mock('../hermes/service', () => ({
  createHermesLearningService: () => ({
    runIteration: vi.fn().mockResolvedValue({ createdProposals: 0 }),
    runCycle: vi.fn(),
  }),
}));

vi.mock('../flywheel/store', () => ({
  createSupabaseLearningProposalStore: () => ({
    findOpenByFingerprint: vi.fn(),
    save: vi.fn(),
    load: vi.fn(),
    listForScope: vi.fn(),
  }),
}));

describe('Hermes scheduled Flywheel adapter', () => {
  it('derives scope through the injected trusted resolver and never accepts tenant authority from a signal payload override', async () => {
    const resolveScope = vi.fn().mockResolvedValue({
      organizationId: 'org-a',
      agentId: 'agent-a',
      capabilityId: 'memory_hygiene',
    });
    const persistSignal = vi.fn().mockResolvedValue(undefined);
    const adapter = createHermesFlywheelAdapter({
      client: {} as never,
      resolveScope,
      persistSignal,
    });

    await expect(adapter.resolveScope({ organizationId: 'org-a', jobId: 'job-1' })).resolves.toEqual({
      organizationId: 'org-a',
      agentId: 'agent-a',
      capabilityId: 'memory_hygiene',
    });

    await adapter.emitSignal({
      id: 'signal-1',
      scope: { organizationId: 'org-a', agentId: 'agent-a', capabilityId: 'memory_hygiene' },
      kind: 'verification_failure',
      fingerprint: 'fp',
      confidence: 1,
      impact: 1,
      observedAt: '2026-09-13T00:00:00.000Z',
      evidenceRef: 'job:1',
      redactedSummary: null,
    });

    expect(resolveScope).toHaveBeenCalledWith({ organizationId: 'org-a', jobId: 'job-1' });
    expect(persistSignal).toHaveBeenCalledOnce();
  });
});
