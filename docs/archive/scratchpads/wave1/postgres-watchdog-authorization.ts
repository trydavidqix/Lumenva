import type { Queryable } from "../apps/crm/lib/agent-engine/queue/queue";
import type { RerouteRequest, RerouteResult, WatchdogObservation } from "../apps/crm/lib/psycheos/no-progress-watchdog";

type Permission = RerouteRequest["permissionLevel"];
type Row = { requester_id: string; permission_level: Permission; capabilities: unknown; enabled: boolean };

export class PostgresWatchdogRequesterRegistry {
  constructor(private readonly db: Queryable, private readonly organizationId: string, private readonly table = "psyche_watchdog_requesters") {
    if (!organizationId.trim()) throw new Error("watchdog_tenant_invalid");
    if (!/^\w+$/.test(table)) throw new Error("watchdog_table_invalid");
  }

  async save(requesterId: string, permissionLevel: Permission, capabilities: readonly string[], enabled = true): Promise<void> {
    if (!requesterId.trim() || !/^P[0-4]$/.test(permissionLevel)) throw new Error("watchdog_requester_invalid");
    await this.db.query(
      `INSERT INTO ${this.table} (organization_id, requester_id, permission_level, capabilities, enabled)
       VALUES ($1,$2,$3,$4::jsonb,$5)
       ON CONFLICT (organization_id, requester_id) DO UPDATE SET permission_level=EXCLUDED.permission_level, capabilities=EXCLUDED.capabilities, enabled=EXCLUDED.enabled, updated_at=now()`,
      [this.organizationId, requesterId, permissionLevel, JSON.stringify([...capabilities]), enabled],
    );
  }

  async load(requesterId: string): Promise<RerouteRequest | null> {
    const result = await this.db.query<Row>(`SELECT requester_id, permission_level, capabilities, enabled FROM ${this.table} WHERE organization_id=$1 AND requester_id=$2`, [this.organizationId, requesterId]);
    const row = result.rows[0];
    if (!row || !row.enabled) return null;
    const capabilities = Array.isArray(row.capabilities) ? row.capabilities.filter((value): value is string => typeof value === "string") : [];
    return { requesterId: row.requester_id, permissionLevel: row.permission_level, capabilities };
  }
}

export async function requestRerouteFromRegistry(
  watchdog: { requestReroute(observation: WatchdogObservation, request: RerouteRequest): RerouteResult },
  observation: WatchdogObservation,
  requesterId: string,
  registry: PostgresWatchdogRequesterRegistry,
): Promise<RerouteResult> {
  const request = await registry.load(requesterId);
  if (!request) throw new Error("watchdog_requester_not_authorized");
  return watchdog.requestReroute(observation, request);
}
