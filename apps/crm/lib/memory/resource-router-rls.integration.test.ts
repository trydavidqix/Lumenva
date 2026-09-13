import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorkers, persistWorker, routeResourcePersisted } from "./resource-router-persistence";

describe("Resource Router RLS (real PostgreSQL)", () => {
  it("isola workers por tenant com role sem BYPASSRLS", async () => {
    const container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    try {
      const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split(":").pop();
      const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
      const { Pool } = await import("pg"); let admin = new Pool({ connectionString: url });
      for (let i = 0; i < 120; i++) { try { await admin.query("select 1"); break; } catch (error) { if (i === 119) throw error; await new Promise((r) => setTimeout(r, 200)); } }
      const role = "resource_router_rls_test";
      try {
        await admin.query(`DROP ROLE IF EXISTS ${role}`); await admin.query("DROP ROLE IF EXISTS authenticated"); await admin.query("CREATE ROLE authenticated NOLOGIN"); await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'test-role' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated`);
        await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
        await admin.query(await readFile(join(process.cwd(), "supabase/migrations/20260913160000_resource_router_rls.sql"), "utf8")); await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`); await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_router_workers, public.resource_router_reroutes TO ${role}`);
        const tenant = new Pool({ connectionString: url.replace("postgres:postgres@", `${role}:test-role@`) }); const a = await tenant.connect();
        try { await a.query("SET app.org_ids = 'org-a'"); await persistWorker(a, "org-a", { agentId: "worker-a", surface: "Linux", capabilities: ["ts"], currentLoad: 0, capacity: 1, healthy: true }); await a.query("SET app.org_ids = 'org-b'"); expect((await a.query("SELECT agent_id FROM public.resource_router_workers WHERE tenant_id='org-a'")).rows).toEqual([]); await expect(loadWorkers(a, "org-a")).resolves.toEqual([]); await expect(routeResourcePersisted(a, "org-a", { taskId: "cross-tenant", requiredCapabilities: ["ts"] })).rejects.toThrow("resource_router_no_apt_worker"); } finally { a.release(); await tenant.end(); }
      } finally { await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined); await admin.query("DROP ROLE IF EXISTS authenticated").catch(() => undefined); await admin.end(); }
    } finally { execFileSync("docker", ["rm", "-f", container]); }
  }, 40_000);
});
