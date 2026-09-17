import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresAgentDefinitionRegistry } from "./agent-definition-registry-pg";
import { InMemoryAgentBirthAuthorityStore } from "./agent-birth-authority-store";
const tenantId = "00000000-0000-4000-8000-000000000001";
const otherTenantId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000099";
const definition = { id: "sales", version: "1.0.0", status: "CERTIFIED" as const, identity: "Sales", mission: "Qualify", boundaries: ["No send"], authority: "P0", escalation: "Human" };
function input(store: InMemoryAgentBirthAuthorityStore) { return { definition, origin: { actor_id: "author", tenant_id: tenantId }, expectedTenantId: tenantId, approval: { approval_id: "ap-1", approver_id: "reviewer", tenant_id: tenantId, status: "APPROVED" as const, approved_at: "2026-09-13T00:00:00Z", policy_version: "p1" }, authorityStore: store }; }
const databaseUrl = process.env.DATABASE_URL;
describe.skipIf(!databaseUrl)("durable registry migration RLS", () => {
  it("applies migration 0168 and proves authenticated cross-tenant isolation", async () => {
    const url = databaseUrl!;
    const admin = new pg.Pool({ connectionString: url });
    await admin.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await admin.query("CREATE TABLE organizations (id uuid primary key)");
    await admin.query("CREATE TABLE user_organizations (user_id uuid, organization_id uuid)");
    await admin.query("CREATE OR REPLACE FUNCTION fn_user_org_ids() RETURNS SETOF uuid SECURITY DEFINER AS $$ SELECT organization_id FROM user_organizations WHERE user_id = current_setting('app.test_user')::uuid $$ LANGUAGE sql");
    await admin.query("CREATE ROLE service_role NOSUPERUSER NOBYPASSRLS");
    await admin.query("CREATE ROLE authenticated NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'test'");
    await admin.query("INSERT INTO organizations VALUES ($1),($2)", [tenantId, otherTenantId]);
    await admin.query("INSERT INTO user_organizations VALUES ($1,$2)", [userId, tenantId]);
    await admin.query(readFileSync("supabase/migrations/20260913170000_0168_agent_definition_registry.sql", "utf8"));
    const tenant = new pg.Pool({ connectionString: url.replace("postgres:", "authenticated:"), options: "-c app.test_user=" + userId });
    try {
      const auth = new InMemoryAgentBirthAuthorityStore();
      auth.addActor({ actor_id: "author", tenant_id: tenantId, actor_type: "HUMAN", active: true });
      auth.addApproval({ ...input(auth).approval, definition_id: "sales", definition_version: "1.0.0", author_actor_id: "author" });
      const registry = new PostgresAgentDefinitionRegistry(tenant);
      const results = await Promise.all([registry.register(input(auth)).then(() => true).catch(() => false), registry.register(input(auth)).then(() => true).catch(() => false)]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await registry.get(tenantId, "sales", "1.0.0")).toMatchObject({ id: "sales" });
      expect(await registry.get(otherTenantId, "sales", "1.0.0")).toBeNull();
      const cross = await tenant.query("SELECT * FROM agent_definition_registry WHERE organization_id=$1", [otherTenantId]);
      expect(cross.rows).toHaveLength(0);
    } finally { await tenant.end(); await admin.end(); }
  });
});
