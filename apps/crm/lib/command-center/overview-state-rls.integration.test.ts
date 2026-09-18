import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import { loadOverview, saveOverview } from "./overview-state-persistence";

let container = "";
let admin: Pool;
let adminUrl = "";

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

const dockerAvailable = spawnSync("docker", ["version"], { stdio: "ignore" }).status === 0;

describe.skipIf(!dockerAvailable)("Command Center overview RLS (real PostgreSQL)", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
    admin = new Pool({ connectionString: adminUrl });
    await admin.query("CREATE ROLE authenticated NOLOGIN");
    await admin.query("CREATE ROLE command_center_rls_test LOGIN PASSWORD 'test-role' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated");
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(await readFile(join(process.cwd(), "supabase/migrations/20260917100900_0183_command_center_overview_rls.sql"), "utf8"));
  }, 30_000);

  afterAll(async () => {
    await admin?.end();
    if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  });

  it("isola tenant A de tenant B com role sem BYPASSRLS", async () => {
    const url = adminUrl.replace("postgres:test@", "command_center_rls_test:test-role@");
    const tenantA = new Pool({ connectionString: url });
    const a = await tenantA.connect();
    try {
      await a.query("SET app.org_ids = 'org-a'");
      await saveOverview(a, { organizationId: "org-a", generatedAt: "2026-09-13T00:00:00.000Z", agents: [], costs: [], jobs: [], approvals: [] });
    } finally {
      a.release();
      await tenantA.end();
    }

    const tenantB = new Pool({ connectionString: url });
    const b = await tenantB.connect();
    try {
      await b.query("SET app.org_ids = 'org-b'");
      expect(await loadOverview(b, "org-a")).toBeNull();
      await expect(saveOverview(b, { organizationId: "org-a", generatedAt: "2026-09-13T00:00:00.000Z", agents: [], costs: [], jobs: [], approvals: [] })).rejects.toMatchObject({ code: "42501" });
    } finally {
      b.release();
      await tenantB.end();
    }
  }, 30_000);
});
