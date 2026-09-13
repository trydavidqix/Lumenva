import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";

let admin: Pool | undefined;
let authenticated: Pool | undefined;
let container = "";

describe("operating core job claims RLS", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=test", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
    }
    admin = new Pool({ connectionString: url });
    await admin.query("create or replace function public.fn_user_org_ids() returns setof text language sql stable as $$ select unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query("create role authenticated login password 'authenticated' nosuperuser nobypassrls");
    await admin.query(readFileSync("supabase/migrations/20260913090000_operating_core_job_claims.sql", "utf8"));
    await admin.query("grant usage on schema public to authenticated");
    await admin.query("grant execute on function public.fn_user_org_ids() to authenticated");
    await admin.query("insert into public.operating_core_job_claims (organization_id, job_id, worker_id, status, attempts) values ('org-a', 'job-a', 'worker-a', 'CLAIMED', 1), ('org-b', 'job-b', 'worker-b', 'CLAIMED', 1)");
    authenticated = new Pool({ connectionString: url.replace("postgres:test", "authenticated:authenticated") });
    await authenticated.query("set app.org_ids = 'org-a'");
  });

  afterAll(async () => {
    await authenticated?.end();
    if (admin) { await admin.query("drop owned by authenticated"); await admin.query("drop role if exists authenticated"); await admin.end(); }
    if (container) execFileSync("docker", ["rm", "-f", container]);
  });

  it("exposes only the caller tenant and rejects cross-tenant writes", async () => {
    expect((await authenticated!.query("select organization_id, job_id from public.operating_core_job_claims order by job_id")).rows).toEqual([{ organization_id: "org-a", job_id: "job-a" }]);
    await expect(authenticated!.query("insert into public.operating_core_job_claims (organization_id, job_id, worker_id, status, attempts) values ('org-b', 'job-c', 'worker-c', 'CLAIMED', 1)")).rejects.toMatchObject({ code: "42501" });
    await expect(authenticated!.query("update public.operating_core_job_claims set worker_id = 'attacker' where organization_id = 'org-b' and job_id = 'job-b'")).resolves.toMatchObject({ rowCount: 0 });
  });
});
