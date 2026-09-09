import { describe, expect, it, vi } from 'vitest';

import { createHistoricalReplaySampler } from '@/lib/agent-engine/evals/historical-sampler';

describe('Phase 4 historical replay sampler', () => {
  it('keeps tenant scope and deterministic per-bucket limits', async () => {
    const listCandidates = vi.fn().mockResolvedValue([
      { id: 'a2', organizationId: 'org-1', bucket: 'support', input: {} },
      { id: 'a1', organizationId: 'org-1', bucket: 'support', input: {} },
      { id: 'a3', organizationId: 'org-1', bucket: 'support', input: {} },
      { id: 'b1', organizationId: 'org-1', bucket: 'sales', input: {} },
      { id: 'evil', organizationId: 'org-2', bucket: 'support', input: {} },
    ]);

    const sampler = createHistoricalReplaySampler({ listCandidates });
    const result = await sampler.sample({ organizationId: 'org-1', perBucket: 2 });

    expect(result.every((item) => item.organizationId === 'org-1')).toBe(true);
    expect(result.filter((item) => item.bucket === 'support').map((item) => item.id)).toEqual(['a1', 'a2']);
    expect(result.filter((item) => item.bucket === 'sales')).toHaveLength(1);
  });

  it('removes direct raw email and phone fields before replay artifacts leave the sampler', async () => {
    const sampler = createHistoricalReplaySampler({
      listCandidates: async () => [
        {
          id: 'pii-case',
          organizationId: 'org-1',
          bucket: 'support',
          input: { email: 'customer@example.com', phone: '+351910000000', request: 'Need help' },
          humanReference: { whatsapp: '+351920000000', disposition: 'resolved' },
        },
      ],
    });

    const result = (await sampler.sample({ organizationId: 'org-1', perBucket: 1 }))[0];
    expect(result).toBeDefined();
    if (!result) throw new Error('expected_historical_replay_sample');

    expect(result.input).toEqual({ request: 'Need help' });
    expect(result.humanReference).toEqual({ disposition: 'resolved' });
  });
});
