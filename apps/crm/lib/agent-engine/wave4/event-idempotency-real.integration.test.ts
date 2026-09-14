import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresWakeEventStore } from "@/lib/agent-engine/wave4/event-idempotency";
import { dispatchWakeEvent, signWakeEvent, WakeActorRegistry, type WakePolicy, type WakeWorker } from "@/lib/agent-engine/wave4/event-wake";

describe("Wave 4 BrowserMesh replay claims against real Postgres RLS", () => {
  let container = "";
  let admin: pg.Pool;
  let tenantUrl = "";
  const event = signWakeEvent({ event_id: "event-real-1", organization_id: "org-a", actor_id: "actor-a", actor_capabilities: ["browser.open"], required_capability: "browser.open", idempotency_key: "event-real-1-replay", payload: { url: "https://example.test" } }, "fixture-shared-secret");
  const workers: WakeWorker[] = [{ worker_id: "worker-a", agent_id: "agent-a", organization_id: "org-a", capabilities: ["browser.open"], available: true }];
  const policy: WakePolicy = { organization_id: "org-a", allowed_worker_ids: ["worker-a"] };
  const actors = new WakeActorRegistry([{ actor_id: "actor-a", organization_id: "org-a", capabilities: ["browser.open"] }]);

  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_missing");
    const adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    admin = new pg.Pool({ connectionString: adminUrl });
    for (let attempt = 0; attempt < 90; attempt += 1) {
      try { await admin.query("select 1"); break; } catch (error) {
        if (attempt === 89) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    await admin.query("create role authenticated nologin");
    await admin.query("create role service_role nologin");
    await admin.query("create role browsermesh_test login password 'browsermesh-test' nosuperuser nobypassrls in role authenticated");
    await admin.query("create or replace function public.fn_user_org_ids() returns setof text language sql stable as $$ select unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(readFileSync("supabase/migrations/20260913100000_browsermesh_event_idempotency.sql", "utf8"));
    await admin.query(readFileSync("supabase/migrations/20260913160000_0163_browsermesh_event_idempotency_rls.sql", "utf8"));
    await admin.query("insert into public.browsermesh_event_idempotency (organization_id,event_id,idempotency_key,status) values ('org-b','event-b','replay-b','CLAIMED')");
    tenantUrl = `postgres://browsermesh_test:browsermesh-test@127.0.0.1:${port}/postgres`;
  }, 60_000);

  afterAll(async () => { await admin?.end(); if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" }); });

  it("executes one concurrent wake, rejects replay after a new store, and blocks cross-tenant claims", async () => {
    const first = new pg.Pool({ connectionString: tenantUrl });
    const second = new pg.Pool({ connectionString: tenantUrl });
    try {
      await first.query("select set_config('app.org_ids', 'org-a', false)");
      await second.query("select set_config('app.org_ids', 'org-a', false)");
      let executions = 0;
      const results = await Promise.all([
        dispatchWakeEvent(event, workers, policy, "fixture-shared-secret", new PostgresWakeEventStore(first), actors, async () => { executions += 1; }),
        dispatchWakeEvent(event, workers, policy, "fixture-shared-secret", new PostgresWakeEventStore(second), actors, async () => { executions += 1; }),
      ]);
      expect(results.filter((result) => result.status === "WAKED")).toHaveLength(1);
      expect(results.filter((result) => result.status === "DUPLICATE")).toHaveLength(1);
      expect(executions).toBe(1);
      const restarted = new pg.Pool({ connectionString: tenantUrl });
      try {
        await restarted.query("select set_config('app.org_ids', 'org-a', false)");
        await expect(dispatchWakeEvent(event, workers, policy, "fixture-shared-secret", new PostgresWakeEventStore(restarted), actors, async () => { executions += 1; })).resolves.toEqual({ status: "DUPLICATE", event_id: event.event_id, reason: "IDEMPOTENT_REPLAY" });
        await expect(restarted.query("insert into public.browsermesh_event_idempotency (organization_id,event_id,idempotency_key) values ('org-b','cross','cross')")).rejects.toMatchObject({ code: "42501" });
      } finally { await restarted.end(); }
    } finally { await first.end(); await second.end(); }
  }, 60_000);
});
