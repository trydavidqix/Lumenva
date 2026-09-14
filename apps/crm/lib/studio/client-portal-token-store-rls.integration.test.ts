import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

let admin: Pool;
let authenticated: Pool;
let container = "";

describe("Client portal token store RLS", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
    }
    admin = new Pool({ connectionString: url });
    await admin.query("CREATE TABLE public.organizations (id uuid PRIMARY KEY)");
    await admin.query("CREATE TABLE public.user_organizations (user_id uuid NOT NULL, organization_id uuid NOT NULL, revoked_at timestamptz)");
    await admin.query("CREATE SCHEMA auth");
    await admin.query("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$");
    await admin.query("CREATE FUNCTION public.fn_user_org_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid() AND revoked_at IS NULL $$");
    await admin.query("INSERT INTO public.organizations VALUES ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222')");
    await admin.query("CREATE ROLE authenticated LOGIN PASSWORD 'authenticated'");
    await admin.query("CREATE ROLE service_role LOGIN PASSWORD 'service_role'");
    await admin.query("GRANT USAGE ON SCHEMA public TO authenticated");
    await admin.query("GRANT USAGE ON SCHEMA auth TO authenticated");
    await admin.query("GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated");
    await admin.query("GRANT EXECUTE ON FUNCTION public.fn_user_org_ids() TO authenticated");
    await admin.query(readFileSync("supabase/migrations/20260913150000_0166_studio_client_portal_tokens.sql", "utf8"));
    await admin.query("INSERT INTO public.studio_client_portal_tokens (token_id, project_id, organization_id, token_hash, scope, expires_at, created_by) VALUES ('00000000-0000-0000-0000-000000000001', 'project-1', '11111111-1111-1111-1111-111111111111', repeat('a', 64), 'VIEW', '2099-01-01', 'owner')");
    await admin.query("INSERT INTO public.user_organizations VALUES ('00000000-0000-0000-0000-000000000099', '11111111-1111-1111-1111-111111111111', NULL)");
    authenticated = new Pool({ connectionString: url.replace("postgres:postgres", "authenticated:authenticated") });
    await authenticated.query("SELECT set_config('request.jwt.claim.sub', $1, false)", ["00000000-0000-0000-0000-000000000099"]);
  });

  afterAll(async () => {
    await authenticated?.end();
    if (admin) { await admin.query("DROP OWNED BY authenticated"); await admin.query("DROP OWNED BY service_role"); await admin.query("DROP ROLE IF EXISTS authenticated"); await admin.query("DROP ROLE IF EXISTS service_role"); await admin.end(); }
    if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); }
  });

  it("allows only the authenticated tenant and rejects cross-tenant writes", async () => {
    const visible = await authenticated.query("SELECT organization_id FROM public.studio_client_portal_tokens");
    expect(visible.rows).toEqual([{ organization_id: "11111111-1111-1111-1111-111111111111" }]);
    await expect(authenticated.query("INSERT INTO public.studio_client_portal_tokens (token_id, project_id, organization_id, token_hash, scope, expires_at, created_by) VALUES ('00000000-0000-0000-0000-000000000002', 'project-2', '22222222-2222-2222-2222-222222222222', repeat('b', 64), 'VIEW', '2099-01-01', 'attacker')")).rejects.toThrow(/row-level security|permission denied/i);
  });
});
