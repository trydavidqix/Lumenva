import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { createPostgresSourceRegistry, type SourceInput } from "../apps/crm/lib/memory/source-registry";

let admin: Pool;
let tenant: Pool;
let container = "";
const source: SourceInput = {
  organizationId: "00000000-0000-4000-8000-000000000010",
  uri: "https://docs.example.com/hermes/rls",
  title: "RLS source",
  owner: "memory-team",
  license: "CC-BY-4.0",
  version: "1",
  sourceType: "approved_internal",
};

describe("Hermes Source Registry RLS", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
    }
    admin = new Pool({ connectionString: url });
    await admin.query("DROP TABLE IF EXISTS public.hermes_source_registry CASCADE");
    await admin.query("CREATE SCHEMA IF NOT EXISTS auth");
    await admin.query("CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$");
    await admin.query("GRANT USAGE ON SCHEMA auth TO public");
    await admin.query("GRANT EXECUTE ON FUNCTION auth.uid() TO public");
    await admin.query("CREATE TABLE IF NOT EXISTS public.user_organizations (user_id uuid NOT NULL, organization_id uuid NOT NULL, revoked_at timestamptz)");
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT organization_id FROM public.user_organizations WHERE user_id = auth.uid() AND revoked_at IS NULL $$");
    await admin.query(readFileSync("supabase/migrations/20260913000000_0163_hermes_source_registry.sql", "utf8"));
    await admin.query(readFileSync("supabase/migrations/20260913010000_0164_hermes_source_registry_rls.sql", "utf8"));
    await admin.query("DROP ROLE IF EXISTS hermes_rls_test");
    await admin.query("CREATE ROLE hermes_rls_test LOGIN PASSWORD 'hermes-test'");
    await admin.query("GRANT USAGE ON SCHEMA public TO hermes_rls_test");
    await admin.query("GRANT SELECT, INSERT ON public.hermes_source_registry TO hermes_rls_test");
    const registry = createPostgresSourceRegistry(admin);
    await registry.register(source, "2026-09-13T00:00:00.000Z");
    await registry.register({ ...source, organizationId: "00000000-0000-4000-8000-000000000020" }, "2026-09-13T00:00:00.000Z");
    tenant = new Pool({ connectionString: url.replace("postgres:postgres", "hermes_rls_test:hermes-test") });
    const userId = "00000000-0000-4000-8000-000000000001";
    await admin.query("TRUNCATE public.user_organizations");
    await admin.query("INSERT INTO public.user_organizations(user_id, organization_id) VALUES ($1, $2)", [userId, "00000000-0000-4000-8000-000000000010"]);
    await tenant.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
  });

  afterAll(async () => {
    await tenant?.end();
    if (admin) { await admin.query("DROP OWNED BY hermes_rls_test"); await admin.query("DROP ROLE IF EXISTS hermes_rls_test"); await admin.end(); }
    if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); }
  });

  it("prevents a tenant session from reading another organization's source", async () => {
    const rows = await tenant.query("SELECT organization_id, source_id FROM public.hermes_source_registry ORDER BY source_id");
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.organization_id).toBe("00000000-0000-4000-8000-000000000010");
  });
});
