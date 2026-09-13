import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadContentProvenance, persistContentProvenance } from "./content-provenance-persistence";
import type { ContentProvenanceInput } from "./content-provenance";

const migration = join(process.cwd(), "supabase/migrations/20260913140000_content_provenance_rls.sql");
const piece: ContentProvenanceInput = {
  contentId: "content-tenant-a",
  skill: "SEO",
  content: "conteúdo com provenance",
  source: "briefing-a",
  freshness: "current",
  confidence: 0.91,
  generatedAt: "2026-09-13T10:00:00.000Z",
};

describe("Content provenance RLS (real PostgreSQL)", () => {
  it("persiste concorrente e impede leitura/escrita cross-tenant com role sem BYPASSRLS", async () => {
    const url = process.env.CONTENT_PROVENANCE_DATABASE_URL;
    if (!url) throw new Error("CONTENT_PROVENANCE_DATABASE_URL_required");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: url });
    const role = "content_provenance_rls_test";
    try {
      await admin.query(`DROP ROLE IF EXISTS ${role}`);
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD 'test-role' NOSUPERUSER NOBYPASSRLS`);
      await admin.query(`CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE sql STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$`);
      await admin.query(await readFile(migration, "utf8"));
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
      await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_provenance TO ${role}`);
      await admin.query("TRUNCATE public.content_provenance");

      const tenantA = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) });
      const a1 = await tenantA.connect();
      const a2 = await tenantA.connect();
      try {
        await Promise.all([a1.query("SET app.org_ids = 'org-a'"), a2.query("SET app.org_ids = 'org-a'")]);
        await Promise.all([
          persistContentProvenance(a1, "org-a", piece),
          persistContentProvenance(a2, "org-a", piece),
        ]);
        const count = await a1.query("SELECT count(*)::int AS count FROM public.content_provenance WHERE organization_id = 'org-a'");
        expect(count.rows[0].count).toBe(1);
        expect(await loadContentProvenance(a1, "org-a", piece.contentId)).toMatchObject(piece);
      } finally {
        a1.release(); a2.release(); await tenantA.end();
      }

      const tenantB = new Pool({ connectionString: url.replace("postgres:test@", `${role}:test-role@`) });
      const b = await tenantB.connect();
      try {
        await b.query("SET app.org_ids = 'org-b'");
        expect(await loadContentProvenance(b, "org-b", piece.contentId)).toBeNull();
        const hidden = await b.query("SELECT content_id FROM public.content_provenance WHERE organization_id = 'org-a'");
        expect(hidden.rows).toEqual([]);
        await expect(persistContentProvenance(b, "org-a", { ...piece, contentId: "content-cross-tenant" })).rejects.toMatchObject({ code: "42501" });
      } finally {
        b.release(); await tenantB.end();
      }
    } finally {
      await admin.query(`DROP ROLE IF EXISTS ${role}`).catch(() => undefined);
      await admin.end();
    }
  }, 30_000);
});
