import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "../apps/crm/node_modules/pg";
import { PostgresNoProgressWatchdog } from "./postgres-no-progress-watchdog";

let container = "";
let admin: Pool;
let adminUrl = "";

async function waitForPostgres(url: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error("postgres_query_not_ready");
}

describe("Postgres No-Progress Watchdog (real RLS)", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
    admin = new Pool({ connectionString: adminUrl });
    await admin.query("CREATE ROLE authenticated NOLOGIN");
    await admin.query("CREATE ROLE watchdog_test LOGIN PASSWORD 'watchdog-test' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated");
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE SQL STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(readFileSync("supabase/migrations/20260917100300_0177_psyche_watchdog_observations.sql", "utf8"));
  });

  afterAll(async () => { await admin?.end(); if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" }); });

  it("persiste após restart, serializa ciclos concorrentes e isola tenants", async () => {
    const tenantUrl = adminUrl.replace("postgres:test@", "watchdog_test:watchdog-test@");
    const firstPool = new Pool({ connectionString: tenantUrl });
    const firstClient = await firstPool.connect();
    try {
      await firstClient.query("SET app.org_ids = 'org-a'");
      const watchdog = new PostgresNoProgressWatchdog(firstClient, "org-a");
      expect((await watchdog.observe({ jobId: "job-1", cycle: 1, progressed: false })).noProgressCycles).toBe(1);
      expect((await watchdog.observe({ jobId: "job-1", cycle: 2, progressed: false })).noProgressCycles).toBe(2);
      expect((await watchdog.observe({ jobId: "job-1", cycle: 3, progressed: false })).status).toBe("AT_RISK");
      expect(await watchdog.observe({ jobId: "job-1", cycle: 3, progressed: false })).toEqual(await watchdog.observe({ jobId: "job-1", cycle: 3, progressed: false }));
    } finally { firstClient.release(); await firstPool.end(); }

    const restartedPool = new Pool({ connectionString: tenantUrl });
    const restartedClient = await restartedPool.connect();
    try {
      await restartedClient.query("SET app.org_ids = 'org-a'");
      const restarted = new PostgresNoProgressWatchdog(restartedClient, "org-a");
      expect((await restarted.observe({ jobId: "job-1", cycle: 4, progressed: false })).noProgressCycles).toBe(4);
    } finally { restartedClient.release(); await restartedPool.end(); }

    const concurrentPool = new Pool({ connectionString: tenantUrl });
    const [a, b] = await Promise.all([concurrentPool.connect(), concurrentPool.connect()]);
    try {
      await Promise.all([a.query("SET app.org_ids = 'org-a'"), b.query("SET app.org_ids = 'org-a'")]);
      const results = await Promise.allSettled([
        new PostgresNoProgressWatchdog(a, "org-a").observe({ jobId: "job-concurrent", cycle: 1, progressed: false }),
        new PostgresNoProgressWatchdog(b, "org-a").observe({ jobId: "job-concurrent", cycle: 1, progressed: false }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
      expect(results[0]).toEqual(results[1]);
    } finally { a.release(); b.release(); await concurrentPool.end(); }

    const crossPool = new Pool({ connectionString: tenantUrl });
    const cross = await crossPool.connect();
    try {
      await cross.query("SET app.org_ids = 'org-b'");
      const crossWatchdog = new PostgresNoProgressWatchdog(cross, "org-b");
      expect((await crossWatchdog.observe({ jobId: "job-1", cycle: 1, progressed: false })).noProgressCycles).toBe(1);
      expect((await cross.query("SELECT organization_id FROM public.psyche_watchdog_observations WHERE organization_id='org-a'")).rows).toEqual([]);
      await expect(cross.query("INSERT INTO public.psyche_watchdog_observations (organization_id,job_id,cycle,progressed,no_progress_cycles,status) VALUES ('org-a','forged',1,false,1,'ON_TRACK')")).rejects.toMatchObject({ code: "42501" });
    } finally { cross.release(); await crossPool.end(); }
  });
});
