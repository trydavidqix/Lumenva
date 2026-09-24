import { describe, it, expect, vi } from 'vitest';
import { CrmLeadsDrizzleRepository } from '../../lib/db/drizzle/domains/crm/leads-repository';
import { CrmLeadNormalizer } from '../../lib/db/drizzle/domains/crm/normalizer';
import { PgDialect } from 'drizzle-orm/pg-core';

const { getDrizzleMock } = vi.hoisted(() => ({ getDrizzleMock: vi.fn() }));
vi.mock('@lumenva/db/drizzle/client', () => ({ getDrizzle: getDrizzleMock }));

const ctx = { userId: 'user-1', organizationId: '11111111-1111-4111-8111-111111111111', role: 'agent' as const, requestId: 'req-1' };

describe('CrmLeadsDrizzleRepository', () => {
  it('rejects an injected stageId before opening the tenant transaction', async () => {
    const mockDb = { transaction: vi.fn() };
    getDrizzleMock.mockReturnValue(mockDb);

    await expect(new CrmLeadsDrizzleRepository().list(ctx, { stageId: "x' OR '1'='1" }))
      .rejects.toThrow('Invalid stageId');

    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('binds tenant, UUID filters, and a bounded integer limit as SQL parameters', async () => {
    const queries: unknown[] = [];
    const tx = { execute: vi.fn(async (query: unknown) => { queries.push(query); return { rows: [] }; }) };
    getDrizzleMock.mockReturnValue({ transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx) });

    await new CrmLeadsDrizzleRepository().list(ctx, {
      stageId: '22222222-2222-4222-8222-222222222222',
      contactId: '33333333-3333-4333-8333-333333333333',
      limit: 25,
    });

    const query = queries[1] as Parameters<PgDialect['sqlToQuery']>[0];
    const compiled = new PgDialect().sqlToQuery(query);
    expect(compiled.sql).toContain('organization_id = $1');
    expect(compiled.params).toEqual([
      ctx.organizationId,
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      25,
    ]);
    expect(compiled.sql).not.toContain("x' OR '1'='1");
  });

  it.each([0, -1, 1.5, 501])('rejects out-of-range limit %s before opening a transaction', async (limit) => {
    const mockDb = { transaction: vi.fn() };
    getDrizzleMock.mockReturnValue(mockDb);

    await expect(new CrmLeadsDrizzleRepository().list(ctx, { limit })).rejects.toThrow('Invalid limit');

    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});

describe('CrmLeadNormalizer', () => {
  it('should normalize a lead properly', () => {
    const normalizer = new CrmLeadNormalizer();
    const date = new Date('2024-01-01T12:00:00Z');

    const lead = {
      id: 'lead-1',
      organization_id: 'org-1',
      contact_id: 'contact-1',
      stage_id: 'stage-1',
      pipeline_id: 'pipeline-1',
      position_in_stage: 1.5,
      value_cents: 1000,
      assigned_at: date,
      last_activity_at: null,
      closed_at: null,
      created_at: date,
      updated_at: date,
    };

    const normalized = normalizer.normalize(lead);

    expect(normalized).toEqual({
      id: 'lead-1',
      organization_id: 'org-1',
      contact_id: 'contact-1',
      stage_id: 'stage-1',
      pipeline_id: 'pipeline-1',
      position_in_stage: 1.5,
      value_cents: 1000,
      assigned_at: '2024-01-01T12:00:00.000Z',
      last_activity_at: null,
      closed_at: null,
      created_at: '2024-01-01T12:00:00.000Z',
      updated_at: '2024-01-01T12:00:00.000Z',
    });
  });

  it('should normalize and sort a list of leads by id', () => {
    const normalizer = new CrmLeadNormalizer();
    const lead1 = {
      id: 'lead-b',
      organization_id: 'org-1',
      contact_id: 'contact-1',
      stage_id: 'stage-1',
      pipeline_id: 'pipeline-1',
      position_in_stage: 2,
      value_cents: 2000,
      assigned_at: null,
      last_activity_at: null,
      closed_at: null,
      created_at: null,
      updated_at: null,
    };

    const lead2 = {
      id: 'lead-a',
      organization_id: 'org-1',
      contact_id: 'contact-2',
      stage_id: 'stage-1',
      pipeline_id: 'pipeline-1',
      position_in_stage: 1,
      value_cents: 1000,
      assigned_at: null,
      last_activity_at: null,
      closed_at: null,
      created_at: null,
      updated_at: null,
    };

    const list = [lead1, lead2];
    const normalizedList = normalizer.normalizeList(list);

    expect(normalizedList?.length).toBe(2);
    expect(normalizedList?.[0]!.id).toBe('lead-a');
    expect(normalizedList?.[1]!.id).toBe('lead-b');
  });
});

