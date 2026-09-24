import type { DomainRepository, TenantReadContext, CrmLead, CrmLeadFilter } from './types';
import { getDrizzle } from '@lumenva/db/drizzle/client';
import { sql } from 'drizzle-orm';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LEAD_LIST_LIMIT = 500;

function assertUuid(value: string, field: 'organizationId' | 'stageId' | 'contactId'): void {
  if (!UUID_PATTERN.test(value)) throw new Error(`Invalid ${field}`);
}

export class CrmLeadsDrizzleRepository implements DomainRepository<CrmLead, CrmLeadFilter, unknown, unknown> {
  async findById(ctx: TenantReadContext, id: string): Promise<CrmLead | null> {
    const db = getDrizzle();

    return await db.transaction(async (tx: unknown) => {
      const transaction = tx as { execute: (query: unknown) => Promise<{ rows: unknown[] }> };
      await transaction.execute(sql`SET LOCAL app.organization_id = ${ctx.organizationId}`);

      const res = await transaction.execute(sql`
        SELECT * FROM crm_leads
        WHERE id = ${id}
          AND organization_id = ${ctx.organizationId}
        LIMIT 1
      `);

      if (res.rows.length === 0) return null;
      return res.rows[0] as unknown as CrmLead;
    });
  }

  async list(ctx: TenantReadContext, filter: CrmLeadFilter): Promise<readonly CrmLead[]> {
    assertUuid(ctx.organizationId, 'organizationId');
    if (filter.stageId !== undefined) assertUuid(filter.stageId, 'stageId');
    if (filter.contactId !== undefined) assertUuid(filter.contactId, 'contactId');
    const limit = filter.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LEAD_LIST_LIMIT) {
      throw new Error('Invalid limit');
    }

    const db = getDrizzle();

    return await db.transaction(async (tx: unknown) => {
      const transaction = tx as { execute: (query: unknown) => Promise<{ rows: unknown[] }> };
      await transaction.execute(sql`SET LOCAL app.organization_id = ${ctx.organizationId}`);

      const conditions = [sql`organization_id = ${ctx.organizationId}`];
      if (filter.stageId !== undefined) conditions.push(sql`stage_id = ${filter.stageId}`);
      if (filter.contactId !== undefined) conditions.push(sql`contact_id = ${filter.contactId}`);

      const finalQuery = sql`
        SELECT * FROM crm_leads
        WHERE ${sql.join(conditions, sql` AND `)}
        LIMIT ${limit}
      `;
      const res = await transaction.execute(finalQuery);

      return res.rows as unknown as CrmLead[];
    });
  }

  async insert(_ctx: TenantReadContext, _input: unknown): Promise<CrmLead> {
    throw new Error('Not implemented for shadow reads');
  }

  async update(_ctx: TenantReadContext, _id: string, _patch: unknown): Promise<CrmLead> {
    throw new Error('Not implemented for shadow reads');
  }

  async delete(_ctx: TenantReadContext, _id: string): Promise<void> {
    throw new Error('Not implemented for shadow reads');
  }
}
