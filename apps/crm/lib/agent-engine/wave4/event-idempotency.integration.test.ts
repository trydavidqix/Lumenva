import pg from "pg";
import { describe, expect, it } from "vitest";
import { PostgresWakeEventStore } from "./event-idempotency";
import { signWakeEvent, wakeEventPersisted, type WakeEvent, type WakePolicy, type WakeWorker } from "./event-wake";

describe("BrowserMesh event idempotency against real Postgres", () => {
  it("allows one concurrent wake and rejects the replay after a new store instance", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for this integration test");
    const pool = new pg.Pool({ connectionString: databaseUrl });
    const secret = "fixture-shared-secret";
    const event = signWakeEvent({ event_id: "event-real-1", organization_id: "org-real-1", actor_id: "actor-real-1", actor_capabilities: ["browser.open"], required_capability: "browser.open", idempotency_key: "event-real-1-replay", payload: { url: "https://example.test" } }, secret);
    const workers: WakeWorker[] = [{ worker_id: "worker-real-1", agent_id: "agent-real-1", organization_id: "org-real-1", capabilities: ["browser.open"], available: true }];
    const policy: WakePolicy = { organization_id: "org-real-1", allowed_worker_ids: ["worker-real-1"] };
    try {
      await pool.query("truncate public.browsermesh_event_idempotency");
      const results = await Promise.all([
        wakeEventPersisted(event, workers, policy, secret, new PostgresWakeEventStore(pool)),
        wakeEventPersisted(event, workers, policy, secret, new PostgresWakeEventStore(pool)),
      ]);
      expect(results.filter((result) => result.status === "WAKED")).toHaveLength(1);
      expect(results.filter((result) => result.status === "DUPLICATE")).toHaveLength(1);
      const replay = await wakeEventPersisted(event as WakeEvent, workers, policy, secret, new PostgresWakeEventStore(pool));
      expect(replay).toEqual({ status: "DUPLICATE", event_id: event.event_id, reason: "IDEMPOTENT_REPLAY" });
    } finally {
      await pool.end();
    }
  });
});
