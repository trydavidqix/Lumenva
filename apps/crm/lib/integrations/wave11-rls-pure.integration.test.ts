import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";
let container = "";
let admin: Pool;
let auth: Pool;

describe("Wave 11 pure RLS", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop()!;
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    for (let i = 0; i < 40; i += 1) {
      try { const p = new Pool({ connectionString: url }); await p.query("select 1"); await p.end(); break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
    }
    admin = new Pool({ connectionString: url });
    await admin.query("CREATE ROLE authenticated LOGIN PASSWORD 'authenticated' NOSUPERUSER NOBYPASSRLS");
    await admin.query("CREATE ROLE service_role NOLOGIN BYPASSRLS");
    await admin.query("CREATE TABLE public.organizations (id uuid PRIMARY KEY)");
    await admin.query("INSERT INTO public.organizations(id) VALUES ($1),($2)", [ORG_A, ORG_B]);
    await admin.query(`CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF uuid LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ','))::uuid $$`);
    await admin.query(await readFile("supabase/migrations/20260913040000_0167_wave11_replay_secret_proxy.sql", "utf8"));
    await admin.query("GRANT USAGE ON SCHEMA public TO authenticated");
    auth = new Pool({ connectionString: url.replace("postgres:postgres", "authenticated:authenticated") });
  });

  afterAll(async () => {
    await auth?.end();
    await admin?.end();
    if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  });

  it("allows tenant-scoped receipt reads but blocks direct authenticated writes", async () => {
    await admin.query("INSERT INTO integration_webhook_receipts(organization_id,provider,event_id) VALUES ($1,'fake','evt-a')", [ORG_A]);
    await auth.query(`SET app.org_ids = '${ORG_A}'`);
    expect((await auth.query("SELECT event_id FROM integration_webhook_receipts")).rows).toEqual([{ event_id: "evt-a" }]);
    await expect(auth.query("INSERT INTO integration_webhook_receipts(organization_id,provider,event_id) VALUES ($1,'fake','evt-x')", [ORG_A])).rejects.toMatchObject({ code: "42501" });
  }, 30_000);

  it("hides cross-tenant receipts", async () => {
    await auth.query(`SET app.org_ids = '${ORG_B}'`);
    expect((await auth.query("SELECT * FROM integration_webhook_receipts")).rows).toHaveLength(0);
  }, 30_000);

  it("never exposes integration secret_value directly to authenticated", async () => {
    await admin.query("INSERT INTO integration_secrets VALUES ($1,'ref-a','secret-a',ARRAY['send'],ARRAY['actor-a'],NULL)", [ORG_A]);
    await auth.query(`SET app.org_ids = '${ORG_A}'`);
    await expect(auth.query("SELECT secret_value FROM integration_secrets")).rejects.toMatchObject({ code: "42501" });
    await expect(auth.query("INSERT INTO integration_secrets VALUES ($1,'ref-x','x',ARRAY['send'],ARRAY['actor-a'],NULL)", [ORG_A])).rejects.toMatchObject({ code: "42501" });
  }, 30_000);
});
