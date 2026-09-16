import type pg from "pg";

export type PersistedAffectEvent = Readonly<{
  organizationId: string;
  agentId: string;
  sessionId: string;
  eventId: string;
  atMs: number;
  pleasure: number;
  arousal: number;
  dominance: number;
}>;

type Row = {
  agent_id: string;
  organization_id: string;
  session_id: string;
  event_id: string;
  at_ms: string;
  pleasure: number;
  arousal: number;
  dominance: number;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS psyche_affect_events (
  organization_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  at_ms BIGINT NOT NULL CHECK (at_ms >= 0),
  pleasure DOUBLE PRECISION NOT NULL CHECK (pleasure BETWEEN -1 AND 1),
  arousal DOUBLE PRECISION NOT NULL CHECK (arousal BETWEEN -1 AND 1),
  dominance DOUBLE PRECISION NOT NULL CHECK (dominance BETWEEN -1 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, agent_id, session_id, event_id)
);
ALTER TABLE psyche_affect_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE psyche_affect_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psyche_affect_tenant_policy ON psyche_affect_events;
CREATE POLICY psyche_affect_tenant_policy ON psyche_affect_events
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
CREATE OR REPLACE FUNCTION psyche_affect_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only affect ledger: UPDATE/DELETE denied';
END;
$$;
DROP TRIGGER IF EXISTS psyche_affect_append_only_trigger ON psyche_affect_events;
CREATE TRIGGER psyche_affect_append_only_trigger
  BEFORE UPDATE OR DELETE ON psyche_affect_events
  FOR EACH ROW EXECUTE FUNCTION psyche_affect_append_only();
`;

export class PostgresAffectLedger {
  constructor(private readonly pool: pg.Pool, private readonly organizationId: string) {
    if (!organizationId) throw new TypeError("organizationId is required");
  }

  async initialize(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async append(event: PersistedAffectEvent): Promise<PersistedAffectEvent> {
    if (event.organizationId !== this.organizationId) throw new Error("organizationId does not match ledger tenant");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.organization_id', $1, true)", [this.organizationId]);
      const result = await client.query<Row>(
        `INSERT INTO psyche_affect_events (organization_id, agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (organization_id, agent_id, session_id, event_id) DO NOTHING
         RETURNING organization_id, agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance`,
        [this.organizationId, event.agentId, event.sessionId, event.eventId, event.atMs, event.pleasure, event.arousal, event.dominance],
      );
      const row = result.rows[0] ?? (await client.query<Row>(
        `SELECT organization_id, agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance
         FROM psyche_affect_events WHERE organization_id = $1 AND agent_id = $2 AND session_id = $3 AND event_id = $4`,
        [this.organizationId, event.agentId, event.sessionId, event.eventId],
      )).rows[0];
      if (!row) throw new Error("idempotent affect event disappeared");
      await client.query("COMMIT");
      return this.fromRow(row);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  async read(agentId: string, sessionId: string): Promise<PersistedAffectEvent[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.organization_id', $1, true)", [this.organizationId]);
      const result = await client.query<Row>(
        `SELECT organization_id, agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance
         FROM psyche_affect_events WHERE organization_id = $1 AND agent_id = $2 AND session_id = $3 ORDER BY at_ms, event_id`,
        [this.organizationId, agentId, sessionId],
      );
      await client.query("COMMIT");
      return result.rows.map((row) => this.fromRow(row));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  private fromRow(row: Row): PersistedAffectEvent {
    return Object.freeze({ organizationId: row.organization_id, agentId: row.agent_id, sessionId: row.session_id, eventId: row.event_id, atMs: Number(row.at_ms), pleasure: row.pleasure, arousal: row.arousal, dominance: row.dominance });
  }
}
