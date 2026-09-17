import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Hermes Source Registry RLS (real PostgreSQL)", () => {
  it("persiste via migration e isola tenants com role sem BYPASSRLS", async () => {
    const container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    try {
      const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split(":").pop();
      const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
      const { Pool } = await import("pg");
      const admin = new Pool({ connectionString: url });
      for (let attempt = 0; attempt < 120; attempt += 1) {
        try { await admin.query("select 1"); break; }
        catch (error) { if (attempt === 119) throw error; await new Promise((resolve) => setTimeout(resolve, 200)); }
      }
      const role = "hermes_rls_test";
      try {
        await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'test-role' NOSUPERUSER NOBYPASSRLS`);
        await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
        const root = `${process.cwd()}/supabase/migrations`;
        await admin.query(await readFile(`${root}/20260917100000_0174_hermes_source_registry.sql`, "utf8"));
        await admin.query(await readFile(`${root}/20260917100100_0175_hermes_source_registry_rls.sql`, "utf8"));
        await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
        await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_source_registry TO ${role}`);
        const tenant = new Pool({ connectionString: url.replace("postgres:postgres@", `${role}:test-role@`) });
        const client = await tenant.connect();
        try {
          await client.query("SET app.org_ids='org-a'");
          await client.query("INSERT INTO public.hermes_source_registry (organization_id,source_id,uri,title,owner,license,version,source_type) VALUES ('org-a','s-a','https://a.example','A','owner','CC-BY','1','approved_internal')");
          await client.query("SET app.org_ids='org-b'");
          expect((await client.query("SELECT organization_id FROM public.hermes_source_registry WHERE organization_id='org-a'")).rows).toEqual([]);
          await expect(client.query("INSERT INTO public.hermes_source_registry (organization_id,source_id,uri,title,owner,license,version,source_type) VALUES ('org-a','s-b','https://b.example','B','owner','CC-BY','1','approved_internal')")).rejects.toMatchObject({ code: "42501" });
        } finally { client.release(); await tenant.end(); }
      } finally { await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined); await admin.end(); }
    } finally { execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" }); }
  }, 40_000);
});
