import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresLayerReuseApprovalStore } from "./approval-registry";

const databaseUrl = process.env.DATABASE_URL;
const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase("durable layer reuse approval registry", () => {
  const admin = new Pool({ connectionString: databaseUrl });
  let tenantA: Pool;
  let tenantB: Pool;

  beforeAll(async () => {
    await admin.query("truncate public.layer_reuse_approvals");
    const tenantDatabaseUrl = databaseUrl!.replace("postgres:test@", "authenticated:test@");
    tenantA = new Pool({ connectionString: tenantDatabaseUrl, options: "-c app.test_org=org-a" });
    tenantB = new Pool({ connectionString: tenantDatabaseUrl, options: "-c app.test_org=org-b" });
  });

  afterAll(async () => { await tenantA?.end(); await tenantB?.end(); await admin.end(); });

  it("persists approval atomically and isolates tenants under RLS", async () => {
    const storeA = new PostgresLayerReuseApprovalStore(tenantA);
    const storeB = new PostgresLayerReuseApprovalStore(tenantB);
    const approval = { approval_id: "approval-1", organizationId: "org-a", status: "APPROVED" as const, expires_at: "2099-01-01T00:00:00.000Z" };
    await expect(storeA.save(approval)).resolves.toMatchObject(approval);
    await expect(storeB.loadForTenant("org-b", "approval-1")).resolves.toBeNull();
    const crossTenantUpdate = await tenantB.query("update public.layer_reuse_approvals set status='REVOKED' where organization_id='org-a' and approval_id='approval-1' returning approval_id");
    expect(crossTenantUpdate.rows).toEqual([]);
    await expect(storeA.loadForTenant("org-a", "approval-1")).resolves.toMatchObject({ status: "APPROVED", organizationId: "org-a" });
    const replay = await storeA.save({ ...approval, status: "REVOKED" });
    expect(replay.status).toBe("REVOKED");
    await expect(storeA.loadForTenant("org-a", "approval-1")).resolves.toMatchObject({ status: "REVOKED" });
  });
});
