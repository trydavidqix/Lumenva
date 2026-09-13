import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PostgresAffectLedger } from "./affect-ledger-pg";

const connectionString = process.env.PSY_AFFECT_DATABASE_URL;
const appConnectionString = process.env.PSY_AFFECT_APP_DATABASE_URL;
const describeDb = connectionString && appConnectionString ? describe : describe.skip;

describeDb("PostgresAffectLedger — persistência append-only real", () => {
  let pool: Pool;
  let appPool: Pool;
  let ledger: PostgresAffectLedger;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    ledger = new PostgresAffectLedger(pool, "org-a");
    await ledger.initialize();
    appPool = new Pool({ connectionString: appConnectionString });
    await pool.query("GRANT USAGE ON SCHEMA public TO psycheos_app; GRANT SELECT, INSERT ON psyche_affect_events TO psycheos_app");
  });

  afterAll(async () => {
    await pool.end();
    await appPool.end();
  });

  it("sobrevive restart do Pool e preserva evento após reabertura", async () => {
    const appLedger = new PostgresAffectLedger(appPool, "org-a");
    await appLedger.append({ organizationId: "org-a", agentId: "agent-pg", sessionId: "session-pg", eventId: "evt-restart", atMs: 1_000, pleasure: 0.7, arousal: -0.2, dominance: 0.4 });
    await pool.end();

    const restartedPool = new Pool({ connectionString });
    const restartedLedger = new PostgresAffectLedger(restartedPool, "org-a");
    const restored = await restartedLedger.read("agent-pg", "session-pg");
    expect(restored).toHaveLength(1);
    expect(restored[0]?.pleasure).toBeCloseTo(0.7);
    await restartedPool.end();
    pool = new Pool({ connectionString });
    ledger = new PostgresAffectLedger(pool, "org-a");
  });

  it("replay é idempotente e UPDATE/DELETE são rejeitados pelo banco", async () => {
    const input = { organizationId: "org-a", agentId: "agent-pg", sessionId: "session-pg", eventId: "evt-idempotent", atMs: 2_000, pleasure: 0.3, arousal: 0.1, dominance: -0.1 };
    await ledger.append(input);
    await ledger.append(input);
    expect((await ledger.read("agent-pg", "session-pg")).filter((event) => event.eventId === input.eventId)).toHaveLength(1);
    await expect(pool.query("UPDATE psyche_affect_events SET pleasure = 0 WHERE event_id = $1", [input.eventId])).rejects.toThrow(/append-only/i);
    await expect(pool.query("DELETE FROM psyche_affect_events WHERE event_id = $1", [input.eventId])).rejects.toThrow(/append-only/i);
  });

  it("RLS impede que organização B leia eventos de organização A", async () => {
    const otherLedger = new PostgresAffectLedger(appPool, "org-b");
    expect(await otherLedger.read("agent-pg", "session-pg")).toHaveLength(0);
  });

  it("rejeita evento cujo organizationId diverge do ledger", async () => {
    const ledger = new PostgresAffectLedger(appPool, "org-a");
    await expect(ledger.append({ organizationId: "org-b", agentId: "agent-pg", sessionId: "session-pg", eventId: "evt-cross-org", atMs: 3_000, pleasure: 0, arousal: 0, dominance: 0 })).rejects.toThrow(/organizationId/i);
  });
});
