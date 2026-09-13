import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
let container = ""; let admin: Pool; let auth: Pool;
describe("Wave 11 pure RLS", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop()!;
    const url = "postgres://postgres:postgres@127.0.0.1:" + port + "/postgres";
    for (let i = 0; i < 40; i++) { try { const p = new Pool({ connectionString: url }); await p.query("select 1"); await p.end(); break; } catch { await new Promise(r => setTimeout(r, 200)); } }
    admin = new Pool({ connectionString: url });
    await admin.query("CREATE ROLE authenticated LOGIN PASSWORD 'authenticated' NOSUPERUSER NOBYPASSRLS");
    await admin.query(`CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$`);
    await admin.query(await readFile("supabase/migrations/20260913040000_0167_wave11_replay_secret_proxy.sql", "utf8"));
    await admin.query("GRANT USAGE ON SCHEMA public TO authenticated"); await admin.query("GRANT SELECT, INSERT ON integration_webhook_receipts TO authenticated"); await admin.query("GRANT SELECT ON integration_secrets TO authenticated");
    auth = new Pool({ connectionString: url.replace("postgres:postgres", "authenticated:authenticated") });
  });
  afterAll(async () => { await auth?.end(); await admin?.end(); if (container) execFileSync("docker", ["rm", "-f", container]); });
  it("bloqueia leitura e escrita cross-tenant nas duas tabelas", async () => {
    await admin.query("INSERT INTO integration_webhook_receipts VALUES ('org-a','fake','evt-a',now())"); await admin.query("INSERT INTO integration_secrets VALUES ('org-a','ref-a','secret-a',ARRAY['send'],ARRAY['actor-a'],NULL)"); await auth.query("SET app.org_ids = 'org-b'");
    expect((await auth.query("SELECT * FROM integration_webhook_receipts")).rows).toHaveLength(0); expect((await auth.query("SELECT * FROM integration_secrets")).rows).toHaveLength(0);
    await expect(auth.query("INSERT INTO integration_webhook_receipts VALUES ('org-a','fake','evt-x',now())")).rejects.toMatchObject({ code: "42501" }); await expect(auth.query("INSERT INTO integration_secrets VALUES ('org-a','ref-x','x',ARRAY['send'],ARRAY['actor-a'],NULL)")).rejects.toMatchObject({ code: "42501" });
  }, 30000);
});
