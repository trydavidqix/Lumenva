import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadOverview, saveOverview } from "./overview-state-persistence";

const migration = join(process.cwd(), "supabase/migrations/20260913150000_command_center_overview_rls.sql");
const state = { organizationId: "org-a", generatedAt: "2026-09-13T00:00:00.000Z", agents: [], costs: [], jobs: [], approvals: [] };

describe("Command Center overview RLS (real PostgreSQL)", () => {
  it("isola tenant A de tenant B com role sem BYPASSRLS", async () => {
    const url = process.env.COMMAND_CENTER_DATABASE_URL;
    if (!url) throw new Error("COMMAND_CENTER_DATABASE_URL_required");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: url });
    const role = "command_center_rls_test";
    try {
      await admin.query(`DROP ROLE IF EXISTS ${role}`);
      await admin.query("DROP ROLE IF EXISTS authenticated");
      await admin.query(`CREATE ROLE authenticated NOLOGIN`);
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'test-role' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated`);
      await admin.query(`CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$`);
      await admin.query(await readFile(migration, "utf8"));
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_center_overviews TO ${role}`);
      await admin.query("TRUNCATE public.command_center_overviews");
      const tenantA = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) });
      const a = await tenantA.connect();
      try { await a.query("SET app.org_ids = 'org-a'"); await saveOverview(a, state); } finally { a.release(); await tenantA.end(); }
      const tenantB = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) });
      const b = await tenantB.connect();
      try {
        await b.query("SET app.org_ids = 'org-b'");
        expect(await loadOverview(b, "org-a")).toBeNull();
        await expect(saveOverview(b, { ...state, organizationId: "org-a" })).rejects.toMatchObject({ code: "42501" });
      } finally { b.release(); await tenantB.end(); }
    } finally { await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined); await admin.query("DROP ROLE IF EXISTS authenticated").catch(() => undefined); await admin.end(); }
  }, 30_000);
});
