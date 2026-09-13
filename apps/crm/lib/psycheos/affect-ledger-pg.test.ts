import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAffectLedger } from "./affect-ledger-pg";

const connectionString = process.env.PSY_AFFECT_DATABASE_URL;
const describeDb = connectionString ? describe : describe.skip;

describeDb("PostgresAffectLedger — persistência append-only real", () => {
  let pool: Pool;
  let ledger: PostgresAffectLedger;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    ledger = new PostgresAffectLedger(pool);
    await ledger.initialize();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("sobrevive restart do Pool e preserva evento após reabertura", async () => {
    await ledger.append({ agentId: "agent-pg", sessionId: "session-pg", eventId: "evt-restart", atMs: 1_000, pleasure: 0.7, arousal: -0.2, dominance: 0.4 });
    await pool.end();

    const restartedPool = new Pool({ connectionString });
    const restartedLedger = new PostgresAffectLedger(restartedPool);
    const restored = await restartedLedger.read("agent-pg", "session-pg");
    expect(restored).toHaveLength(1);
    expect(restored[0]?.pleasure).toBeCloseTo(0.7);
    await restartedPool.end();
    pool = new Pool({ connectionString });
    ledger = new PostgresAffectLedger(pool);
  });

  it("replay é idempotente e UPDATE/DELETE são rejeitados pelo banco", async () => {
    const input = { agentId: "agent-pg", sessionId: "session-pg", eventId: "evt-idempotent", atMs: 2_000, pleasure: 0.3, arousal: 0.1, dominance: -0.1 };
    await ledger.append(input);
    await ledger.append(input);
    expect((await ledger.read("agent-pg", "session-pg")).filter((event) => event.eventId === input.eventId)).toHaveLength(1);
    await expect(pool.query("UPDATE psyche_affect_events SET pleasure = 0 WHERE event_id = $1", [input.eventId])).rejects.toThrow(/append-only/i);
    await expect(pool.query("DELETE FROM psyche_affect_events WHERE event_id = $1", [input.eventId])).rejects.toThrow(/append-only/i);
  });
});
