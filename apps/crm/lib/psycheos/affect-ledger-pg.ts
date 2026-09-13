import type pg from "pg";

export type PersistedAffectEvent = Readonly<{
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
  session_id: string;
  event_id: string;
  at_ms: string;
  pleasure: number;
  arousal: number;
  dominance: number;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS psyche_affect_events (
  agent_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  at_ms BIGINT NOT NULL CHECK (at_ms >= 0),
  pleasure DOUBLE PRECISION NOT NULL CHECK (pleasure BETWEEN -1 AND 1),
  arousal DOUBLE PRECISION NOT NULL CHECK (arousal BETWEEN -1 AND 1),
  dominance DOUBLE PRECISION NOT NULL CHECK (dominance BETWEEN -1 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, session_id, event_id)
);
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
  constructor(private readonly pool: pg.Pool) {}

  async initialize(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async append(event: PersistedAffectEvent): Promise<PersistedAffectEvent> {
    const result = await this.pool.query<Row>(
      `INSERT INTO psyche_affect_events (agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (agent_id, session_id, event_id) DO NOTHING
       RETURNING agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance`,
      [event.agentId, event.sessionId, event.eventId, event.atMs, event.pleasure, event.arousal, event.dominance],
    );
    if (result.rows[0]) return this.fromRow(result.rows[0]);
    const existing = await this.pool.query<Row>(
      `SELECT agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance
       FROM psyche_affect_events WHERE agent_id = $1 AND session_id = $2 AND event_id = $3`,
      [event.agentId, event.sessionId, event.eventId],
    );
    if (!existing.rows[0]) throw new Error("idempotent affect event disappeared");
    return this.fromRow(existing.rows[0]);
  }

  async read(agentId: string, sessionId: string): Promise<PersistedAffectEvent[]> {
    const result = await this.pool.query<Row>(
      `SELECT agent_id, session_id, event_id, at_ms, pleasure, arousal, dominance
       FROM psyche_affect_events WHERE agent_id = $1 AND session_id = $2 ORDER BY at_ms, event_id`,
      [agentId, sessionId],
    );
    return result.rows.map((row) => this.fromRow(row));
  }

  private fromRow(row: Row): PersistedAffectEvent {
    return Object.freeze({ agentId: row.agent_id, sessionId: row.session_id, eventId: row.event_id, atMs: Number(row.at_ms), pleasure: row.pleasure, arousal: row.arousal, dominance: row.dominance });
  }
}
