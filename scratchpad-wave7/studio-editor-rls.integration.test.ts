import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Pool } from "../apps/crm/node_modules/pg";

let admin: Pool;
let authenticated: Pool;
let container = "";
const orgA = "11111111-1111-1111-1111-111111111111";
const orgB = "22222222-2222-2222-2222-222222222222";

describe("Studio Editor RLS", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=test", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 120; attempt += 1) { try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    admin = new Pool({ connectionString: url });
    await admin.query("CREATE TABLE public.organizations (id uuid PRIMARY KEY)");
    await admin.query("INSERT INTO public.organizations VALUES ($1),($2)", [orgA, orgB]);
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ','))::uuid $$");
    await admin.query("CREATE ROLE authenticated LOGIN PASSWORD 'authenticated' NOSUPERUSER NOBYPASSRLS");
    await admin.query("CREATE ROLE service_role NOLOGIN");
    await admin.query("GRANT USAGE ON SCHEMA public TO authenticated");
    await admin.query("GRANT EXECUTE ON FUNCTION public.fn_user_org_ids() TO authenticated");
    await admin.query(readFileSync("supabase/migrations/20260913130000_0163_studio_editor.sql", "utf8"));
    await admin.query("INSERT INTO public.studio_canvas_documents (organization_id,session_id,canvas_id,project_id,version,viewport,layers,editor_state,created_by) VALUES ($1,'session-a','canvas-a','project-a',1,'{}','[]','DRAFT','owner')", [orgA]);
    authenticated = new Pool({ connectionString: url.replace("postgres:test", "authenticated:authenticated") });
    await authenticated.query(`SET app.org_ids = '${orgA}'`);
  }, 30_000);
  afterAll(async () => { await authenticated?.end(); if (admin) { await admin.query("DROP OWNED BY authenticated"); await admin.query("DROP ROLE IF EXISTS authenticated"); await admin.end(); } if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("isolates all Studio Editor tables and rejects cross-tenant writes", async () => {
    const visible = await authenticated.query("SELECT organization_id FROM public.studio_canvas_documents");
    expect(visible.rows).toEqual([{ organization_id: orgA }]);
    await expect(authenticated.query("INSERT INTO public.studio_canvas_documents (organization_id,session_id,canvas_id,project_id,version,viewport,layers,editor_state,created_by) VALUES ($1,'session-b','canvas-b','project-b',1,'{}','[]','DRAFT','attacker')", [orgB])).rejects.toMatchObject({ code: "42501" });
    for (const table of ["studio_edit_proposals", "studio_variant_mixes", "studio_editor_evals"]) {
      expect((await authenticated.query(`SELECT organization_id FROM public.${table}`)).rows).toEqual([]);
    }
  }, 30_000);
});
