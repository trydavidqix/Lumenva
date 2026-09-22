import type { ExecutionResult, MasterPlan, ResultDigest } from './execution-port';
import type { RoutingObservation } from './learning-router';
import type { RoutingTrace } from './routing-observability';
import type { WorkforcePersistence } from './durable-stores';

export interface SqlExecutor {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export class PostgresWorkforcePersistence implements WorkforcePersistence {
  constructor(private readonly db: SqlExecutor) {}

  async savePlan(plan: MasterPlan): Promise<void> {
    await this.db.query(
      'insert into maestri_master_plans(plan_id, objective, payload) values($1,$2,$3::jsonb) on conflict(plan_id) do update set objective=excluded.objective,payload=excluded.payload',
      [plan.plan_id, plan.objective, JSON.stringify(plan)],
    );
  }

  async getPlan(planId: string): Promise<MasterPlan | undefined> {
    const result = await this.db.query<{ payload: MasterPlan }>('select payload from maestri_master_plans where plan_id=$1', [planId]);
    return result.rows[0]?.payload;
  }

  async saveExecution(result: ExecutionResult): Promise<void> {
    const id = result.execution_id ?? `${result.task_id}:${Date.now()}`;
    await this.db.query(
      'insert into maestri_executions(execution_id,task_id,provider,model,status,payload) values($1,$2,$3,$4,$5,$6::jsonb) on conflict(execution_id) do update set status=excluded.status,payload=excluded.payload',
      [id, result.task_id, result.provider ?? null, result.model ?? null, result.status, JSON.stringify(result)],
    );
  }

  async saveDigest(digest: ResultDigest): Promise<void> {
    await this.db.query('insert into maestri_result_digests(task_id,execution_id,payload) values($1,$2,$3::jsonb)', [digest.task_id, digest.execution_id ?? null, JSON.stringify(digest)]);
  }

  async saveRoutingTrace(trace: RoutingTrace): Promise<void> {
    await this.db.query(
      'insert into maestri_routing_traces(trace_id,task_id,provider,model,phase,payload) values($1,$2,$3,$4,$5,$6::jsonb) on conflict(trace_id) do nothing',
      [trace.trace_id, trace.task_id, trace.decision.provider, trace.decision.model, trace.phase, JSON.stringify(trace)],
    );
  }

  async saveObservation(observation: RoutingObservation): Promise<void> {
    await this.db.query(
      'insert into maestri_routing_observations(model_id,task_type,risk,complexity,success,reviewer_accepted,deterministic_passed,retries,latency_ms,cost_usd) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [observation.model_id, observation.task_type, observation.risk, observation.complexity, observation.success, observation.reviewer_accepted, observation.deterministic_passed, observation.retries, observation.latency_ms ?? null, observation.cost_usd ?? null],
    );
  }
}
