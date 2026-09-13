import type { LayerReuseApproval } from "./reverse-design";

type QueryResult<T> = Promise<{ rows: T[] }>;
export type ApprovalRegistryDb = {
  query<T = Record<string, unknown>>(sql: string, values?: readonly unknown[]): QueryResult<T>;
};

type ApprovalRow = {
  approval_id: string;
  organization_id: string;
  status: LayerReuseApproval["status"];
  expires_at: string;
};

function toApproval(row: ApprovalRow): LayerReuseApproval {
  return { approval_id: row.approval_id, organizationId: row.organization_id, status: row.status, expires_at: new Date(row.expires_at).toISOString() };
}

/** Durable tenant-scoped registry. Callers must provide a tenant-bound DB role. */
export class PostgresLayerReuseApprovalStore {
  constructor(private readonly db: ApprovalRegistryDb) {}

  async save(approval: LayerReuseApproval): Promise<LayerReuseApproval> {
    const result = await this.db.query<ApprovalRow>(
      `insert into public.layer_reuse_approvals (approval_id, organization_id, status, expires_at)
       values ($1, $2, $3, $4)
       on conflict (organization_id, approval_id) do update
         set status = excluded.status, expires_at = excluded.expires_at, updated_at = now()
       returning approval_id, organization_id, status, expires_at`,
      [approval.approval_id, approval.organizationId, approval.status, approval.expires_at],
    );
    if (result.rows.length !== 1) throw new Error("layer_reuse_approval_not_persisted");
    return toApproval(result.rows[0]);
  }

  async loadForTenant(organizationId: string, approvalId: string): Promise<LayerReuseApproval | null> {
    const result = await this.db.query<ApprovalRow>(
      `select approval_id, organization_id, status, expires_at
         from public.layer_reuse_approvals
        where organization_id = $1 and approval_id = $2
        for update`,
      [organizationId, approvalId],
    );
    return result.rows[0] ? toApproval(result.rows[0]) : null;
  }
}
