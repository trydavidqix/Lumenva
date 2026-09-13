import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { persistWorker } from "./resource-router-persistence";

const migration = join(process.cwd(), "supabase/migrations/20260913160000_resource_router_rls.sql");
describe("Resource Router RLS (real PostgreSQL)", () => {
  it("isola workers por tenant com role sem BYPASSRLS", async () => {
    const url = process.env.RESOURCE_ROUTER_DATABASE_URL;
    if (!url) throw new Error("RESOURCE_ROUTER_DATABASE_URL_required");
    const { Pool } = await import("pg"); const admin = new Pool({ connectionString: url }); const role = "resource_router_rls_test";
    try {
      await admin.query(`DROP ROLE IF EXISTS ${role}`); await admin.query("DROP ROLE IF EXISTS authenticated");
      await admin.query("CREATE ROLE authenticated NOLOGIN"); await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'test-role' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated`);
      await admin.query(`CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$`);
      await admin.query(await readFile(migration, "utf8")); await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_router_workers, public.resource_router_reroutes TO ${role}`);
      const tenantA = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) }); const a = await tenantA.connect();
      try { await a.query("SET app.org_ids = 'org-a'"); await persistWorker(a, "org-a", { agentId: "worker-a", surface: "Linux", capabilities: ["ts"], currentLoad: 0, capacity: 1, healthy: true }); } finally { a.release(); await tenantA.end(); }
      const tenantB = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) }); const b = await tenantB.connect();
      try { await b.query("SET app.org_ids = 'org-b'"); expect((await b.query("SELECT agent_id FROM public.resource_router_workers WHERE tenant_id='org-a'")).rows).toEqual([]); await expect(persistWorker(b, "org-a", { agentId: "worker-b", surface: "Cloud", capabilities: [], currentLoad: 0, capacity: 1, healthy: true })).rejects.toMatchObject({ code: "42501" }); } finally { b.release(); await tenantB.end(); }
    } finally { await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined); await admin.query("DROP ROLE IF EXISTS authenticated").catch(() => undefined); await admin.end(); }
  }, 30_000);
});
