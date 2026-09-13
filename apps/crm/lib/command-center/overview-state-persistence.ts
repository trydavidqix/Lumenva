import { buildOverviewState, type OverviewInput, type OverviewState } from "./overview-state";

type Queryable = { query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }> };

export async function ensureOverviewStore(db: Queryable): Promise<void> {
  const result = await db.query<{ table_name: string | null }>("SELECT to_regclass('public.command_center_overviews') AS table_name");
  if (!result.rows[0]?.table_name) throw new Error("command_center_overviews_migration_required");
}

export async function saveOverview(db: Queryable, input: OverviewInput): Promise<OverviewState> {
  const state = buildOverviewState(input);
  await db.query(
    `INSERT INTO command_center_overviews (organization_id, state)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (organization_id) DO UPDATE SET state=EXCLUDED.state, updated_at=now()`,
    [state.organizationId, JSON.stringify(state)],
  );
  return state;
}

export async function loadOverview(db: Queryable, organizationId: string): Promise<OverviewState | null> {
  if (!organizationId.trim()) throw new Error("overview_organization_required");
  const result = await db.query<{ organization_id: string; state: OverviewState }>(
    "SELECT organization_id, state FROM command_center_overviews WHERE organization_id=$1",
    [organizationId],
  );
  if (!result.rows[0]) return null;
  if (result.rows[0].organization_id !== organizationId || result.rows[0].state.organizationId !== organizationId) {
    throw new Error("overview_tenant_mismatch");
  }
  return result.rows[0].state;
}
