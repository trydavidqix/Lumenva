import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { approveLayerReuseFromStore, type LayerReuseApproval } from "@/lib/asset-intelligence/reverse-design";
import { PostgresLayerLicenseStore } from "@/lib/asset-intelligence/layer-license-store";
import type { LayerManifest } from "@/lib/asset-intelligence/layer-manifest";

const manifest: LayerManifest = {
  manifest_id: "manifest-1", asset_id: "asset-1", organization_id: "org-a", version: "1",
  layers: [{ layer_id: "layer-1", type: "text", bounds: { x: 0, y: 0, width: 100, height: 40 }, semantic_tag: "headline", provenance: { created_by: "designer", owner_id: "owner-a", source_id: "source-a", license_ref: "lic-a" } }],
};
const approval: LayerReuseApproval = { approval_id: "approval-a", organizationId: "org-a", status: "APPROVED", expires_at: "2099-01-01T00:00:00.000Z" };

describe("Wave 8 persistent asset license registry", () => {
  let container = "";
  let admin: pg.Pool;
  let tenantUrl = "";
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_missing");
    const url = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    admin = new pg.Pool({ connectionString: url });
    for (let i = 0; i < 90; i += 1) { try { await admin.query("select 1"); break; } catch (error) { if (i === 89) throw error; await new Promise((resolve) => setTimeout(resolve, 500)); } }
    await admin.query("create role authenticated nologin");
    await admin.query("create role service_role nologin");
    await admin.query("create role asset_license_test login password 'asset-license-test' nosuperuser nobypassrls in role authenticated");
    await admin.query("create or replace function public.fn_user_org_ids() returns setof text language sql stable as $$ select unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(readFileSync("supabase/migrations/20260913170001_0183_asset_license_records.sql", "utf8"));
    await admin.query("insert into public.asset_license_records (organization_id,license_ref,source_id,owner_id,status,expires_at) values ('org-a','lic-a','source-a','owner-a','VERIFIED','2099-01-01T00:00:00Z'),('org-b','lic-b','source-b','owner-b','VERIFIED','2099-01-01T00:00:00Z')");
    tenantUrl = `postgres://asset_license_test:asset-license-test@127.0.0.1:${port}/postgres`;
  }, 60_000);
  afterAll(async () => { await admin?.end(); if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" }); });

  it("loads the verified license through a new pool and blocks cross-tenant provenance", async () => {
    const tenant = new pg.Pool({ connectionString: tenantUrl });
    try {
      await tenant.query("select set_config('app.org_ids', 'org-a', false)");
      const store = new PostgresLayerLicenseStore(tenant);
      await expect(store.loadForTenant("org-a", "lic-a")).resolves.toMatchObject({ license_ref: "lic-a", status: "VERIFIED" });
      const fresh = new pg.Pool({ connectionString: tenantUrl });
      try { await fresh.query("select set_config('app.org_ids', 'org-a', false)"); await expect(new PostgresLayerLicenseStore(fresh).loadForTenant("org-a", "lic-a")).resolves.toMatchObject({ source_id: "source-a" }); } finally { await fresh.end(); }
      await expect(store.loadForTenant("org-a", "lic-b")).resolves.toBeNull();
      await expect(approveLayerReuseFromStore(manifest, { organizationId: "org-a", targetSemanticTags: ["headline"], approvalId: approval.approval_id }, { loadForTenant: (organizationId, approvalId) => Promise.resolve(organizationId === approval.organizationId && approvalId === approval.approval_id ? approval : null) }, (licenseRef) => store.loadForTenant("org-a", licenseRef))).resolves.toMatchObject([{ authorization: "APPROVED_FOR_REUSE" }]);
      await expect(tenant.query("insert into public.asset_license_records (organization_id,license_ref,source_id,owner_id,status) values ('org-b','cross','source-b','owner-b','VERIFIED')")).rejects.toMatchObject({ code: "42501" });
    } finally { await tenant.end(); }
  }, 60_000);
});
