import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { assertAuthorizedReviewer, registerReviewer } from "./studio-reviewer-registry";

let admin: Pool;
let tenant: Pool;
let container = "";
const orgA = "11111111-1111-1111-1111-111111111111";
const orgB = "22222222-2222-2222-2222-222222222222";

const describeIfDatabase = process.env.STUDIO_REVIEWER_DATABASE_URL ? describe : describe.skip;

describeIfDatabase("Studio reviewer authorization registry", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=test", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) { try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    admin = new Pool({ connectionString: url });
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ','))::uuid $$");
    await admin.query("CREATE ROLE authenticated LOGIN PASSWORD 'authenticated' NOSUPERUSER NOBYPASSRLS");
    await admin.query("CREATE ROLE service_role NOLOGIN");
    await admin.query("GRANT USAGE ON SCHEMA public TO authenticated, service_role");
    await admin.query("GRANT EXECUTE ON FUNCTION public.fn_user_org_ids() TO authenticated");
    await admin.query(readFileSync("supabase/migrations/20260913170000_studio_reviewer_authorizations.sql", "utf8"));
    await registerReviewer(admin, { organizationId: orgA, reviewerId: "reviewer-a", role: "owner" });
    await registerReviewer(admin, { organizationId: orgB, reviewerId: "reviewer-b", role: "owner" });
    tenant = new Pool({ connectionString: url.replace("postgres:test", "authenticated:authenticated") });
    await tenant.query(`SET app.org_ids = '${orgA}'`);
  }, 30_000);
  afterAll(async () => { await tenant?.end(); if (admin) { await admin.query("DROP OWNED BY authenticated"); await admin.query("DROP OWNED BY service_role"); await admin.query("DROP ROLE IF EXISTS authenticated"); await admin.query("DROP ROLE IF EXISTS service_role"); await admin.end(); } if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("authorizes same-tenant reviewer and rejects unknown/cross-tenant identities", async () => {
    await expect(assertAuthorizedReviewer(tenant, orgA, "reviewer-a")).resolves.toBeUndefined();
    await expect(assertAuthorizedReviewer(tenant, orgA, "unknown-reviewer")).rejects.toThrow("reviewer_not_authorized");
    await expect(assertAuthorizedReviewer(tenant, orgA, "reviewer-b")).rejects.toThrow("reviewer_not_authorized");
    await expect(tenant.query("INSERT INTO public.studio_reviewer_authorizations (organization_id, reviewer_id, role) VALUES ($1,'attacker','reviewer')", [orgB])).rejects.toMatchObject({ code: "42501" });
  }, 30_000);
});
