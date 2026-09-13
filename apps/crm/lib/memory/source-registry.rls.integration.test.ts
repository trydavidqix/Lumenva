import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationRoot = join(process.cwd(), "supabase/migrations");

describe("Hermes Source Registry RLS (real PostgreSQL)", () => {
  it("persiste via migration e isola tenant A de tenant B com role sem BYPASSRLS", async () => {
    const url = process.env.SOURCE_REGISTRY_DATABASE_URL;
    if (!url) throw new Error("SOURCE_REGISTRY_DATABASE_URL_required");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: url });
    const role = "hermes_rls_test";
    try {
      await admin.query("DROP ROLE IF EXISTS hermes_rls_test");
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'test-role' NOSUPERUSER NOBYPASSRLS`);
      await admin.query(`CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$`);
      await admin.query(await readFile(join(migrationRoot, "20260913000000_0163_hermes_source_registry.sql"), "utf8"));
      await admin.query(await readFile(join(migrationRoot, "20260913010000_0164_hermes_source_registry_rls.sql"), "utf8"));
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.hermes_source_registry TO ${role}`);
      await admin.query("TRUNCATE public.hermes_source_registry");
      await admin.query(`SET ROLE ${role}`);
      await admin.query("SET app.org_ids = 'org-a'");
      await admin.query("INSERT INTO public.hermes_source_registry (organization_id, source_id, uri, title, owner, license, version, source_type) VALUES ('org-a','source-a','https://a.example','A','owner','CC-BY','1','approved_internal')");
      await admin.query("RESET ROLE");

      const tenantB = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) });
      const tenantBClient = await tenantB.connect();
      try {
        await tenantBClient.query("SET app.org_ids = 'org-b'");
        const hidden = await tenantBClient.query("SELECT organization_id FROM public.hermes_source_registry WHERE organization_id = 'org-a'");
        expect(hidden.rows).toEqual([]);
        await expect(tenantBClient.query("INSERT INTO public.hermes_source_registry (organization_id, source_id, uri, title, owner, license, version, source_type) VALUES ('org-a','source-b','https://b.example','B','owner','CC-BY','1','approved_internal')")).rejects.toMatchObject({ code: "42501" });
      } finally {
        tenantBClient.release();
        await tenantB.end();
      }
    } finally {
      await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined);
      await admin.end();
    }
  }, 30_000);
});
