import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { loadOverview, saveOverview } from "../apps/crm/lib/command-center/overview-state-persistence";

let container = "";
let admin: Pool;
let adminUrl = "";
const state = { organizationId: "org-a", generatedAt: "2026-09-13T00:00:00.000Z", agents: [], costs: [{ id: "cost-1", jobId: "job-1", organizationId: "org-a", tenantId: "org-a", amount: 125, currency: "EUR" }], jobs: [{ id: "job-1", name: "queued job", status: "PENDING" as const, organizationId: "org-a" }], approvals: [{ id: "approval-1", action: "publish", requestedBy: "actor-a", status: "PENDING" as const, organizationId: "org-a" }] };

async function waitForPostgres(url: string): Promise<void> { for (let i = 0; i < 40; i += 1) { try { const p = new Pool({ connectionString: url }); await p.query("select 1"); await p.end(); return; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); } } throw new Error("postgres_query_not_ready"); }

describe("Command Center overview persistence (real RLS)", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
    admin = new Pool({ connectionString: adminUrl });
    await admin.query("CREATE ROLE authenticated NOLOGIN");
    await admin.query("CREATE ROLE command_center_test LOGIN PASSWORD 'command-center-test' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated");
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE SQL STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(readFileSync("supabase/migrations/20260917100900_0183_command_center_overview_rls.sql", "utf8"));
  });
  afterAll(async () => { await admin?.end(); if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" }); });

  it("persiste overview com costs/approvals, reconstrói após restart e bloqueia cross-tenant", async () => {
    const url = adminUrl.replace("postgres:test@", "command_center_test:command-center-test@");
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query("SET app.org_ids = 'org-a'");
      await expect(saveOverview(client, state)).resolves.toMatchObject({ organizationId: "org-a" });
      expect((await loadOverview(client, "org-a"))?.costEntries).toHaveLength(1);
      expect((await loadOverview(client, "org-a"))?.pendingApprovals).toHaveLength(1);
    } finally { client.release(); await pool.end(); }

    const restarted = new Pool({ connectionString: url });
    const restartedClient = await restarted.connect();
    try {
      await restartedClient.query("SET app.org_ids = 'org-a'");
      expect(await loadOverview(restartedClient, "org-a")).toMatchObject({ organizationId: "org-a", costEntries: [{ id: "cost-1", amount: 125 }], pendingApprovals: [{ id: "approval-1", status: "PENDING" }] });
    } finally { restartedClient.release(); await restarted.end(); }

    const cross = new Pool({ connectionString: url });
    const crossClient = await cross.connect();
    try {
      await crossClient.query("SET app.org_ids = 'org-b'");
      await expect(loadOverview(crossClient, "org-a")).resolves.toBeNull();
      const forged = await crossClient.query("INSERT INTO public.command_center_overviews (organization_id,state) VALUES ('org-a','{}')").catch((error: { code?: string }) => error);
      expect(forged).toMatchObject({ code: "42501" });
    } finally { crossClient.release(); await cross.end(); }
  });
});
