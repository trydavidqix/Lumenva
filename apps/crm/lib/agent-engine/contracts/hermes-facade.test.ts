import { describe, expect, it, vi } from 'vitest';

import { createHermesLearningService } from '../hermes/service';

describe('Hermes facade', () => {
  it('delegates to the canonical flywheel iteration', async () => {
    const runIteration = vi.fn().mockResolvedValue({ createdProposals: 1 });
    const service = createHermesLearningService({ runIteration: runIteration as never });

    const result = await service.runIteration({ rawSignals: [] } as never);

    expect(runIteration).toHaveBeenCalledOnce();
    expect(result.createdProposals).toBe(1);
  });
});
