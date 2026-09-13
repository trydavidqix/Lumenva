import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresAgentDefinitionRegistry } from "@/lib/agent-engine/agent-birth/agent-definition-registry-pg";
import { InMemoryAgentBirthAuthorityStore } from "@/lib/agent-engine/agent-birth/agent-birth-authority-store";

const tenantId = "00000000-0000-4000-8000-000000000001";
const otherTenantId = "00000000-0000-4000-8000-000000000002";
const definition = { id: "sales", version: "1.0.0", status: "CERTIFIED" as const, identity: "Sales", mission: "Qualify", boundaries: ["No send"], authority: "P0", escalation: "Human" };

describe("Wave 2 durable AgentDefinition registry against real Postgres RLS", () => {
  let container = "";
  let admin: pg.Pool;
  let tenantUrl = "";

  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_missing");
    const adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    admin = new pg.Pool({ connectionString: adminUrl });
    for (let attempt = 0; attempt < 90; attempt += 1) {
      try { await admin.query("select 1"); break; } catch (error) {
        if (attempt === 89) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    await admin.query("create extension if not exists pgcrypto");
    await admin.query("create table organizations (id uuid primary key)");
    await admin.query("create table user_organizations (user_id uuid, organization_id uuid)");
    await admin.query("create or replace function public.fn_user_org_ids() returns setof uuid security definer language sql as $$ select organization_id from user_organizations where user_id = current_setting('app.test_user')::uuid $$");
    await admin.query("create role service_role nologin");
    await admin.query("create role authenticated nologin");
    await admin.query("create role agent_registry_test login password 'agent-registry-test' nosuperuser nobypassrls in role authenticated");
    await admin.query("insert into organizations values ($1),($2)", [tenantId, otherTenantId]);
    await admin.query("insert into user_organizations values ('00000000-0000-4000-8000-000000000099',$1)", [tenantId]);
    await admin.query(readFileSync("supabase/migrations/20260913170000_0168_agent_definition_registry.sql", "utf8"));
    tenantUrl = `postgres://agent_registry_test:agent-registry-test@127.0.0.1:${port}/postgres`;
  }, 60_000);

  afterAll(async () => {
    await admin?.end();
    if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  });

  it("stores one certified version atomically and hides other tenants from a non-superuser", async () => {
    const tenant = new pg.Pool({ connectionString: tenantUrl });
    try {
      await tenant.query("select set_config('app.test_user', '00000000-0000-4000-8000-000000000099', false)");
      const authority = new InMemoryAgentBirthAuthorityStore();
      authority.addActor({ actor_id: "author", tenant_id: tenantId, actor_type: "HUMAN", active: true });
      authority.addApproval({ approval_id: "ap-1", approver_id: "reviewer", tenant_id: tenantId, status: "APPROVED", approved_at: "2026-09-13T00:00:00Z", policy_version: "p1", definition_id: "sales", definition_version: "1.0.0", author_actor_id: "author" });
      const registration = { definition, origin: { actor_id: "author", tenant_id: tenantId }, expectedTenantId: tenantId, approval: { approval_id: "ap-1", approver_id: "reviewer", tenant_id: tenantId, status: "APPROVED" as const, approved_at: "2026-09-13T00:00:00Z", policy_version: "p1" }, authorityStore: authority };
      const registry = new PostgresAgentDefinitionRegistry(tenant);
      const results = await Promise.all([registry.register(registration).then(() => true).catch(() => false), registry.register(registration).then(() => true).catch(() => false)]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await registry.get(tenantId, "sales", "1.0.0")).toMatchObject({ id: "sales" });
      expect(await registry.get(otherTenantId, "sales", "1.0.0")).toBeNull();
      expect((await tenant.query("select organization_id from public.agent_definition_registry where organization_id=$1", [otherTenantId])).rows).toEqual([]);
      await expect(tenant.query("insert into public.agent_definition_registry (organization_id, definition_id, definition_version, identity, mission, boundaries, authority, escalation, status, origin_actor_id, approval_id, approver_id, policy_version, approved_at) values ($1,'cross','1.0.0','Cross','Cross','[]','P0','Human','CERTIFIED','actor','ap-cross','reviewer','p1','2026-09-13T00:00:00Z')", [otherTenantId])).rejects.toMatchObject({ code: "42501" });
    } finally {
      await tenant.end();
    }
  }, 60_000);
});
