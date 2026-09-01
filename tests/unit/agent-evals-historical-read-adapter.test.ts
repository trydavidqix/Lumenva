import { describe, expect, it, vi } from 'vitest';

import { createHistoricalReplayReadAdapter, type ReadOnlyQueryable } from '@/lib/agent-engine/evals/historical-read-adapter';

describe('Phase 4 historical replay read adapter', () => {
  it('uses a read-only query scoped to one organization and maps sanitized replay candidates', async () => {
    const query = vi.fn(async (text: string, values?: readonly unknown[]) => {
      expect(text.toLowerCase()).not.toMatch(/\b(insert|update|delete|merge|truncate|alter|drop|create)\b/);
      expect(values?.[0]).toBe('org-1');

      return {
        rows: [
          {
            id: 'case-1',
            organization_id: 'org-1',
            bucket: 'escalation',
            input: { request: 'Preciso falar com uma pessoa', email: 'raw@example.test' },
            human_reference: { disposition: 'escalated', phone: '+351912345678' },
          },
        ],
        rowCount: 1,
      };
    });

    const adapter = createHistoricalReplayReadAdapter({ query } as unknown as ReadOnlyQueryable);
    const result = await adapter.listCandidates({ organizationId: 'org-1', limit: 20 });

    expect(query).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: 'case-1',
        organizationId: 'org-1',
        bucket: 'escalation',
        input: { request: 'Preciso falar com uma pessoa' },
        humanReference: { disposition: 'escalated' },
      },
    ]);
  });

  it('fails closed for blank organizations or invalid limits without querying the database', async () => {
    const query = vi.fn();
    const adapter = createHistoricalReplayReadAdapter({ query } as unknown as ReadOnlyQueryable);

    await expect(adapter.listCandidates({ organizationId: '   ', limit: 20 })).resolves.toEqual([]);
    await expect(adapter.listCandidates({ organizationId: 'org-1', limit: 0 })).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('drops cross-tenant and malformed rows returned by the database boundary', async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: 'case-ok',
          organization_id: 'org-1',
          bucket: 'sales',
          input: { request: 'Quero uma proposta' },
          human_reference: { disposition: 'qualified' },
        },
        {
          id: 'case-cross',
          organization_id: 'org-2',
          bucket: 'sales',
          input: { request: 'cross tenant' },
          human_reference: { disposition: 'qualified' },
        },
        {
          id: '',
          organization_id: 'org-1',
          bucket: 'sales',
          input: {},
          human_reference: {},
        },
      ],
      rowCount: 3,
    }));

    const adapter = createHistoricalReplayReadAdapter({ query } as unknown as ReadOnlyQueryable);
    const result = await adapter.listCandidates({ organizationId: 'org-1', limit: 20 });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('case-ok');
  });
});
