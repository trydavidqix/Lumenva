import { buildOverviewState, type OverviewInput, type OverviewState } from "./overview-state";

type Queryable = { query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }> };

export async function ensureOverviewStore(db: Queryable): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS command_center_overviews (
    organization_id text PRIMARY KEY,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
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
