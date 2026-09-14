import type { Queryable } from "../queue/queue";

export class SessionSupersessionError extends Error {
  constructor(readonly code: "STALE_VERSION" | "TENANT_MISMATCH", message: string) { super(message); this.name = "SessionSupersessionError"; }
}
export type SupersessionResult = { sessionId: string; version: number };

type Row = { organization_id: string; active_session_id: string; version: number };
/** Durable winner selection: Postgres CAS is the authority across processes. */
export async function claimActiveSession(db: Queryable, organizationId: string, sessionId: string, expectedVersion: number, table = "hermes_session_supersession"): Promise<SupersessionResult> {
  if (!organizationId.trim() || !sessionId.trim() || !Number.isInteger(expectedVersion) || expectedVersion < 0) throw new SessionSupersessionError("TENANT_MISMATCH", "supersession_input_invalid");
  if (!/^\w+$/.test(table)) throw new Error("supersession_table_invalid");
  const result = await db.query<Row>(`UPDATE ${table} SET active_session_id = $1, version = version + 1 WHERE organization_id = $2 AND version = $3 AND (active_session_id IS NULL OR active_session_id = '') RETURNING organization_id, active_session_id, version`, [sessionId, organizationId, expectedVersion]);
  if (result.rows[0]) return { sessionId: result.rows[0].active_session_id, version: result.rows[0].version };
  const current = await db.query<Row>(`SELECT organization_id, active_session_id, version FROM ${table} WHERE organization_id = $1`, [organizationId]);
  if (!current.rows[0]) throw new SessionSupersessionError("STALE_VERSION", "supersession_state_not_found");
  if (current.rows[0].version !== expectedVersion || current.rows[0].active_session_id !== "") throw new SessionSupersessionError("STALE_VERSION", "supersession_version_stale");
  throw new SessionSupersessionError("STALE_VERSION", "supersession_claim_rejected");
}
