import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = join(process.cwd(), "supabase/migrations/20260913130000_0163_studio_editor.sql");

describe("Studio Editor RLS (real PostgreSQL)", () => {
  it("isola canvas por tenant com role sem BYPASSRLS", async () => {
    const url = process.env.STUDIO_EDITOR_DATABASE_URL;
    if (!url) throw new Error("STUDIO_EDITOR_DATABASE_URL_required");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: url });
    const role = "studio_editor_rls_test";
    const org = "11111111-1111-1111-1111-111111111111";
    try {
      await admin.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
      await admin.query("CREATE TABLE IF NOT EXISTS public.organizations (id uuid PRIMARY KEY)");
      await admin.query("INSERT INTO public.organizations (id) VALUES ($1) ON CONFLICT DO NOTHING", [org]);
      await admin.query("DROP ROLE IF EXISTS studio_editor_rls_test");
      await admin.query("DROP ROLE IF EXISTS authenticated");
      await admin.query("DROP ROLE IF EXISTS service_role");
      await admin.query("CREATE ROLE authenticated NOLOGIN");
      await admin.query("CREATE ROLE service_role NOLOGIN");
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'test-role' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated`);
      await admin.query(`CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')::uuid[]) $$`);
      await admin.query(await readFile(migration, "utf8"));
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await admin.query(`GRANT SELECT, INSERT, UPDATE ON public.studio_canvas_documents TO ${role}`);
      await admin.query("TRUNCATE public.studio_canvas_documents");
      const tenantA = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) });
      const a = await tenantA.connect();
      try {
        await a.query(`SET app.org_ids = '${org}'`);
        await a.query("INSERT INTO public.studio_canvas_documents (organization_id, session_id, canvas_id, project_id, version, viewport, layers, editor_state, created_by) VALUES ($1,'s1','c1','p1',1,'{}','[]','DRAFT','owner')", [org]);
      } finally { a.release(); await tenantA.end(); }
      const tenantB = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) });
      const b = await tenantB.connect();
      try {
        await b.query("SET app.org_ids = '22222222-2222-2222-2222-222222222222'");
        expect((await b.query("SELECT canvas_id FROM public.studio_canvas_documents WHERE organization_id = $1", [org])).rows).toEqual([]);
        await expect(b.query("INSERT INTO public.studio_canvas_documents (organization_id, session_id, canvas_id, project_id, version, viewport, layers, editor_state, created_by) VALUES ($1,'s2','c2','p1',1,'{}','[]','DRAFT','attacker')", [org])).rejects.toMatchObject({ code: "42501" });
      } finally { b.release(); await tenantB.end(); }
    } finally {
      await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined);
      await admin.query("DROP ROLE IF EXISTS authenticated").catch(() => undefined);
      await admin.query("DROP ROLE IF EXISTS service_role").catch(() => undefined);
      await admin.end();
    }
  }, 30_000);
});
