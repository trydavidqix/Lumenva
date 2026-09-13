import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { ensureJobReceiptStore } from "./job-receipt-store";

let admin: Pool;
let authenticated: Pool;
let container = "";

describe("Operating Core job receipts RLS", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=test", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) { try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    admin = new Pool({ connectionString: url });
    await ensureJobReceiptStore(admin);
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query("CREATE ROLE authenticated LOGIN PASSWORD 'authenticated' NOSUPERUSER NOBYPASSRLS");
    await admin.query(readFileSync("supabase/migrations/20260913091000_operating_core_job_receipts_rls.sql", "utf8"));
    await admin.query("GRANT USAGE ON SCHEMA public TO authenticated");
    await admin.query("GRANT EXECUTE ON FUNCTION public.fn_user_org_ids() TO authenticated");
    await admin.query("INSERT INTO public.operating_core_job_receipts (receipt_id, organization_id, job_id, event_id, outcome, evidence) VALUES ('receipt-a', 'org-a', 'job-1', 'event-1', 'completed', '{\"exitCode\":0}')");
    authenticated = new Pool({ connectionString: url.replace("postgres:test", "authenticated:authenticated") });
    await authenticated.query("SET app.org_ids = 'org-a'");
  });
  afterAll(async () => { await authenticated?.end(); if (admin) { await admin.query("DROP OWNED BY authenticated"); await admin.query("DROP ROLE IF EXISTS authenticated"); await admin.end(); } if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });
  it("isolates reads and rejects cross-tenant writes for a non-superuser role", async () => {
    expect((await authenticated.query("SELECT organization_id FROM public.operating_core_job_receipts")).rows).toEqual([{ organization_id: "org-a" }]);
    await expect(authenticated.query("INSERT INTO public.operating_core_job_receipts (receipt_id, organization_id, job_id, event_id, outcome, evidence) VALUES ('receipt-b', 'org-b', 'job-2', 'event-2', 'completed', '{}')")).rejects.toMatchObject({ code: "42501" });
  });
});
