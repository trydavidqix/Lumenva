export type Queryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };
export type BuildPlanStateRow = { id: string; status: string; attempts: number; blocked_at: string | null };
export class BuildPlanStateStore {
  constructor(private readonly db: Queryable) {}
  async get(tenantId: string, planId: string, stepId: string): Promise<BuildPlanStateRow | undefined> {
    const result = await this.db.query<BuildPlanStateRow>(`select id,status,attempts,blocked_at from public.build_plan_state where tenant_id=$1 and plan_id=$2 and step_id=$3`, [tenantId, planId, stepId]);
    return result.rows[0];
  }
  /** One PostgreSQL statement reserves the next attempt; no check-then-write. */
  async recordAttempt(tenantId: string, planId: string, stepId: string): Promise<BuildPlanStateRow | undefined> {
    try {
      const result = await this.db.query<BuildPlanStateRow>(`insert into public.build_plan_state (tenant_id,plan_id,step_id,status,attempts) values ($1,$2,$3,'RUNNING',1) on conflict (tenant_id,plan_id,step_id) do update set status='RUNNING', attempts=build_plan_state.attempts+1, blocked_at=null, updated_at=now() where build_plan_state.status not in ('RUNNING','BLOCKED','SUCCEEDED') returning id,status,attempts,blocked_at`, [tenantId, planId, stepId]);
      return result.rows[0];
    } catch (error) {
      // The partial RUNNING index may win the race before the conflict arbiter;
      // treat that unique-key loser as a failed reservation, never as a retry.
      if ((error as { code?: string }).code === "23505") return undefined;
      throw error;
    }
  }
  /** Complete only the reservation that is still RUNNING; stale workers cannot overwrite a terminal state. */
  async finish(tenantId: string, planId: string, stepId: string, status: "FAILED" | "SUCCEEDED" | "BLOCKED"): Promise<void> {
    const result = await this.db.query<{ id: string }>(`update public.build_plan_state set status=$4, blocked_at=case when $4='BLOCKED' then now() else null end, updated_at=now() where tenant_id=$1 and plan_id=$2 and step_id=$3 and status='RUNNING' returning id`, [tenantId, planId, stepId, status]);
    if (!result.rows[0]) throw new Error("build_plan_state_transition_lost");
  }
}
