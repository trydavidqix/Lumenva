import { DomainRepository, TenantReadContext, CrmLead, CrmLeadFilter } from './types';
import { getDrizzle } from '@lumenva/db/drizzle/client';
import { sql } from 'drizzle-orm';

export class CrmLeadsDrizzleRepository implements DomainRepository<CrmLead, CrmLeadFilter, unknown, unknown> {
  async findById(ctx: TenantReadContext, id: string): Promise<CrmLead | null> {
    const db = getDrizzle();

    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SET LOCAL app.organization_id = ${ctx.organizationId}`);

      const res = await tx.execute(sql`
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
    const db = getDrizzle();

    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SET LOCAL app.organization_id = ${ctx.organizationId}`);

      const queryParts: string[] = [`SELECT * FROM crm_leads WHERE organization_id = ${ctx.organizationId}`];

      if (filter.stageId) {
         queryParts.push(` AND stage_id = '${filter.stageId}'`); // Assuming safe uuids
      }
      if (filter.contactId) {
         queryParts.push(` AND contact_id = '${filter.contactId}'`); // Assuming safe uuids
      }

      if (filter.limit) {
         queryParts.push(` LIMIT ${filter.limit}`);
      }

      const finalQuery = sql.raw(queryParts.join(''));
      const res = await tx.execute(finalQuery);

      return res.rows as unknown as CrmLead[];
    });
  }

  async insert(ctx: TenantReadContext, input: unknown): Promise<CrmLead> {
    throw new Error('Not implemented for shadow reads');
  }

  async update(ctx: TenantReadContext, id: string, patch: unknown): Promise<CrmLead> {
    throw new Error('Not implemented for shadow reads');
  }

  async delete(ctx: TenantReadContext, id: string): Promise<void> {
    throw new Error('Not implemented for shadow reads');
  }
}
