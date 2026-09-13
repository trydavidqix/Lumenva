export type Queryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };
export class BuildPlanStateStore {
  constructor(private readonly db: Queryable) {}
  async claim(tenantId: string, planId: string, stepId: string): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(`insert into public.build_plan_state (tenant_id, plan_id, step_id, status, attempts) values ($1,$2,$3,'RUNNING',1) on conflict (tenant_id,plan_id,step_id) do update set status='RUNNING', attempts=build_plan_state.attempts+1, blocked_at=null, updated_at=now() where build_plan_state.status <> 'RUNNING' returning id`, [tenantId, planId, stepId]);
    return result.rows.length === 1;
  }
  async finish(tenantId: string, planId: string, stepId: string, status: "SUCCEEDED" | "BLOCKED"): Promise<void> {
    await this.db.query(`update public.build_plan_state set status=$4, blocked_at=case when $4='BLOCKED' then now() else null end, updated_at=now() where tenant_id=$1 and plan_id=$2 and step_id=$3`, [tenantId, planId, stepId, status]);
  }
}
