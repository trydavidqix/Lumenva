import { routeResource, type ResourceRoute, type ResourceTask, type Worker } from "../apps/crm/lib/memory/resource-router";

type Queryable = { query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }> };

export async function ensureResourceRouterStore(db: Queryable): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS resource_router_workers (
    tenant_id text NOT NULL, agent_id text NOT NULL, surface text NOT NULL,
    capabilities jsonb NOT NULL, current_load numeric NOT NULL, capacity numeric NOT NULL,
    healthy boolean NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, agent_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS resource_router_reroutes (
    tenant_id text NOT NULL, task_id text NOT NULL, reroute_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, task_id, reroute_key)
  )`);
}

export async function persistWorker(db: Queryable, tenantId: string, worker: Worker): Promise<void> {
  if (!tenantId.trim() || !worker.agentId.trim()) throw new Error("resource_router_persistence_invalid");
  await db.query(
    `INSERT INTO resource_router_workers (tenant_id, agent_id, surface, capabilities, current_load, capacity, healthy)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
     ON CONFLICT (tenant_id, agent_id) DO UPDATE SET surface=EXCLUDED.surface, capabilities=EXCLUDED.capabilities,
       current_load=EXCLUDED.current_load, capacity=EXCLUDED.capacity, healthy=EXCLUDED.healthy, updated_at=now()`,
    [tenantId, worker.agentId, worker.surface, JSON.stringify(worker.capabilities), worker.currentLoad, worker.capacity, worker.healthy],
  );
}

export async function loadWorkers(db: Queryable, tenantId: string): Promise<Worker[]> {
  const result = await db.query<{ agent_id: string; surface: Worker["surface"]; capabilities: string[]; current_load: string | number; capacity: string | number; healthy: boolean }>(
    `SELECT agent_id, surface, capabilities, current_load, capacity, healthy FROM resource_router_workers WHERE tenant_id=$1`, [tenantId],
  );
  return result.rows.map((row) => ({ agentId: row.agent_id, surface: row.surface, capabilities: row.capabilities, currentLoad: Number(row.current_load), capacity: Number(row.capacity), healthy: row.healthy }));
}

export async function routeResourcePersisted(db: Queryable, tenantId: string, task: ResourceTask): Promise<ResourceRoute> {
  return routeResource(task, await loadWorkers(db, tenantId));
}

export async function claimReroute(db: Queryable, tenantId: string, taskId: string, rerouteKey: string): Promise<boolean> {
  if (!tenantId.trim() || !taskId.trim() || !rerouteKey.trim()) throw new Error("resource_router_reroute_invalid");
  const result = await db.query(
    `INSERT INTO resource_router_reroutes (tenant_id, task_id, reroute_key)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, task_id, reroute_key) DO NOTHING
     RETURNING tenant_id`,
    [tenantId, taskId, rerouteKey],
  );
  return result.rows.length === 1;
}

export async function routeResourcePersistedOnce(
  db: Queryable,
  tenantId: string,
  task: ResourceTask,
  rerouteKey: string,
): Promise<ResourceRoute | null> {
  const route = await routeResourcePersisted(db, tenantId, task);
  return (await claimReroute(db, tenantId, task.taskId, rerouteKey)) ? route : null;
}
