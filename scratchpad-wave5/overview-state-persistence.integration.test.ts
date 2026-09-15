import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "../apps/crm/node_modules/pg";
import { ensureOverviewStore, loadOverview, saveOverview } from "../apps/crm/lib/command-center/overview-state-persistence";

let pool: Pool;
let container = "";

async function waitForPostgres(connectionString: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const probe = new Pool({ connectionString });
      await probe.query("select 1");
      await probe.end();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("postgres_query_not_ready");
}

describe("command center overview postgres persistence", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=postgres", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    await waitForPostgres(connectionString);
    pool = new Pool({ connectionString });
    await pool.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await pool.query("CREATE ROLE authenticated NOLOGIN");
    await pool.query(await readFile(join(process.cwd(), "supabase/migrations/20260913150000_command_center_overview_rls.sql"), "utf8"));
    await ensureOverviewStore(pool);
  }, 30_000);
  afterAll(async () => { await pool?.end(); if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("reconstructs tenant-scoped overview through a fresh pool", async () => {
    const input = { organizationId: "org-1", generatedAt: "2026-09-13T00:00:00.000Z", agents: [{ id: "a", version: "1", status: "ACTIVE" as const, organizationId: "org-1" }], costs: [], jobs: [], approvals: [] };
    await saveOverview(pool, input);
    const fresh = new Pool({ connectionString: (pool as unknown as { options: { connectionString: string } }).options.connectionString });
    expect(await loadOverview(fresh, "org-1")).toMatchObject({ organizationId: "org-1", activeAgents: [{ id: "a" }] });
    expect(await loadOverview(fresh, "other-org")).toBeNull();
    await fresh.end();
  });
});
