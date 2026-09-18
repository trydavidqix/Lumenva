import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "../apps/crm/node_modules/pg";
import { NoProgressWatchdog } from "../apps/crm/lib/psycheos/no-progress-watchdog";
import { PostgresWatchdogRequesterRegistry, requestRerouteFromRegistry } from "./postgres-watchdog-authorization";

let container = "";
let admin: Pool;
let adminUrl = "";

async function waitForPostgres(url: string): Promise<void> { for (let i = 0; i < 40; i += 1) { try { const p = new Pool({ connectionString: url }); await p.query("select 1"); await p.end(); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); } } throw new Error("postgres_query_not_ready"); }

describe("Watchdog requester registry (real Postgres RLS)", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
    admin = new Pool({ connectionString: adminUrl });
    await admin.query("CREATE ROLE authenticated NOLOGIN");
    await admin.query("CREATE ROLE watchdog_auth_test LOGIN PASSWORD 'watchdog-auth-test' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated");
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE SQL STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(readFileSync("supabase/migrations/20260917100400_0178_psyche_watchdog_requesters.sql", "utf8"));
  });
  afterAll(async () => { await admin?.end(); if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" }); });

  it("autoriza apenas requester registrado no tenant e rejeita desconhecido/cross-tenant", async () => {
    const url = adminUrl.replace("postgres:test@", "watchdog_auth_test:watchdog-auth-test@");
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query("SET app.org_ids = 'org-a'");
      const registryA = new PostgresWatchdogRequesterRegistry(client, "org-a");
      await registryA.save("actor-a", "P2", ["workforce.reroute"]);
      const watchdog = new NoProgressWatchdog();
      await watchdog.observe({ jobId: "job-1", cycle: 1, progressed: false });
      await watchdog.observe({ jobId: "job-1", cycle: 2, progressed: false });
      const allowed = await requestRerouteFromRegistry(watchdog, { jobId: "job-1", cycle: 3, progressed: false }, "actor-a", registryA);
      expect(allowed).toMatchObject({ decision: "ALLOW", reason: "AUTHORIZED" });
      await expect(requestRerouteFromRegistry(watchdog, { jobId: "job-2", cycle: 1, progressed: false }, "unknown", registryA)).rejects.toThrow("watchdog_requester_not_authorized");
    } finally { client.release(); await pool.end(); }

    const crossPool = new Pool({ connectionString: url });
    const cross = await crossPool.connect();
    try {
      await cross.query("SET app.org_ids = 'org-b'");
      const registryB = new PostgresWatchdogRequesterRegistry(cross, "org-b");
      await expect(registryB.load("actor-a")).resolves.toBeNull();
      await expect(cross.query("INSERT INTO public.psyche_watchdog_requesters (organization_id,requester_id,permission_level,capabilities) VALUES ('org-a','forged','P2','[]')")).rejects.toMatchObject({ code: "42501" });
    } finally { cross.release(); await crossPool.end(); }
  });
});
