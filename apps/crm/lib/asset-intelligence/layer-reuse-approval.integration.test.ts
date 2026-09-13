import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresLayerReuseApprovalStore } from "./approval-registry";

const migration = readFileSync("supabase/migrations/20260913140000_layer_reuse_approvals.sql", "utf8");

describe("layer reuse approval registry against real Postgres RLS", () => {
  let containerId: string;
  let admin: Pool;
  let tenantUrl: string;

  beforeAll(async () => {
    containerId = execFileSync("docker", [
      "run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test",
      "-p", "127.0.0.1::5432", "postgres:16",
    ], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", containerId, "5432/tcp"], { encoding: "utf8" })
      .trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_dynamic_port_missing");
    const adminUrl = `postgresql://postgres:test@127.0.0.1:${port}/postgres`;
    admin = new Pool({ connectionString: adminUrl });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try { await admin.query("select 1"); break; } catch (error) {
        if (attempt === 29) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    await admin.query("create extension if not exists pgcrypto");
    await admin.query("create role service_role nologin");
    await admin.query("create role authenticated nologin");
    await admin.query("create role layer_approval_test login password 'layer-approval-test' nosuperuser nobypassrls in role authenticated");
    await admin.query(`
      create or replace function public.fn_user_org_ids()
      returns setof text language sql stable as $$
        select unnest(string_to_array(current_setting('app.org_ids', true), ','))
      $$;
    `);
    await admin.query(migration);
    tenantUrl = `postgresql://layer_approval_test:layer-approval-test@127.0.0.1:${port}/postgres`;
  }, 30_000);

  afterAll(async () => {
    await admin?.end();
    if (containerId) execFileSync("docker", ["rm", "-f", containerId], { stdio: "ignore" });
  });

  it("persists across a new pool, is idempotent, and rejects cross-tenant access", async () => {
    const tenantA = new Pool({ connectionString: tenantUrl });
    const tenantB = new Pool({ connectionString: tenantUrl });
    try {
      await tenantA.query("select set_config('app.org_ids', 'org-a', false)");
      await tenantB.query("select set_config('app.org_ids', 'org-b', false)");
      const storeA = new PostgresLayerReuseApprovalStore(tenantA);
      const storeB = new PostgresLayerReuseApprovalStore(tenantB);
      const approval = {
        approval_id: "approval-1",
        organizationId: "org-a",
        status: "APPROVED" as const,
        expires_at: "2099-01-01T00:00:00.000Z",
      };

      await expect(storeA.save(approval)).resolves.toMatchObject(approval);
      await expect(storeA.loadForTenant("org-a", "approval-1")).resolves.toMatchObject(approval);
      const replay = await storeA.save({ ...approval, status: "REVOKED" });
      expect(replay.status).toBe("REVOKED");

      await tenantA.end();
      const restarted = new Pool({ connectionString: tenantUrl });
      try {
        await restarted.query("select set_config('app.org_ids', 'org-a', false)");
        await expect(new PostgresLayerReuseApprovalStore(restarted).loadForTenant("org-a", "approval-1"))
          .resolves.toMatchObject({ status: "REVOKED", organizationId: "org-a" });
      } finally {
        await restarted.end();
      }

      await expect(storeB.loadForTenant("org-b", "approval-1")).resolves.toBeNull();
      await expect(storeB.loadForTenant("org-a", "approval-1")).resolves.toBeNull();
      const crossTenantUpdate = await tenantB.query(
        "update public.layer_reuse_approvals set status='APPROVED' where organization_id='org-a' and approval_id='approval-1' returning approval_id",
      );
      expect(crossTenantUpdate.rows).toEqual([]);
      await expect(tenantB.query(
        "insert into public.layer_reuse_approvals (approval_id, organization_id, status, expires_at) values ('approval-2', 'org-a', 'APPROVED', '2099-01-01T00:00:00Z')",
      )).rejects.toMatchObject({ code: "42501" });
    } finally {
      if (!tenantA.ended) await tenantA.end();
      await tenantB.end();
    }
  }, 30_000);
});
