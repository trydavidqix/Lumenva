export type Queryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };
export type BuildPlanStateRow = { id: string; status: string; attempts: number; blocked_at: string | null };
export class BuildPlanStateStore {
  constructor(private readonly db: Queryable) {}
  async get(tenantId: string, planId: string, stepId: string): Promise<BuildPlanStateRow | undefined> {
    const result = await this.db.query<BuildPlanStateRow>(`select id,status,attempts,blocked_at from public.build_plan_state where tenant_id=$1 and plan_id=$2 and step_id=$3`, [tenantId, planId, stepId]);
    return result.rows[0];
  }
  /** Atomic UPDATE/INSERT claims; a RUNNING row cannot be reclaimed. */
  async recordAttempt(tenantId: string, planId: string, stepId: string): Promise<BuildPlanStateRow | undefined> {
    const updated = await this.db.query<BuildPlanStateRow>(`update public.build_plan_state set status='RUNNING', attempts=attempts+1, blocked_at=null, updated_at=now() where tenant_id=$1 and plan_id=$2 and step_id=$3 and status not in ('RUNNING','BLOCKED','SUCCEEDED') returning id,status,attempts,blocked_at`, [tenantId, planId, stepId]);
    if (updated.rows[0]) return updated.rows[0];
    const inserted = await this.db.query<BuildPlanStateRow>(`insert into public.build_plan_state (tenant_id,plan_id,step_id,status,attempts) values ($1,$2,$3,'RUNNING',1) on conflict (tenant_id,plan_id,step_id) do nothing returning id,status,attempts,blocked_at`, [tenantId, planId, stepId]);
    return inserted.rows[0];
  }
  async finish(tenantId: string, planId: string, stepId: string, status: "FAILED" | "SUCCEEDED" | "BLOCKED"): Promise<void> {
    await this.db.query(`update public.build_plan_state set status=$4, blocked_at=case when $4='BLOCKED' then now() else null end, updated_at=now() where tenant_id=$1 and plan_id=$2 and step_id=$3`, [tenantId, planId, stepId, status]);
  }
}
