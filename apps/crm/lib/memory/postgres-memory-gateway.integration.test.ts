import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { rebuildProjectionViaGateway, type MemoryRecord } from "./gateway-projection";
import { createPostgresMemoryGateway } from "./postgres-memory-gateway";

const orgA = "org-a";
const orgB = "org-b";
const record: MemoryRecord = {
  recordId: "memory-1",
  organizationId: orgA,
  subject: "ana",
  scope: "home:ana",
  namespace: "home:ana",
  content: { note: "persisted" },
  observedAt: "2026-09-13T10:00:00.000Z",
  confidence: 0.9,
};
let container = "";
let admin: Pool;
let adminUrl = "";

async function waitForPostgres(url: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const probe = new Pool({ connectionString: url });
      await probe.query("select 1");
      await probe.end();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("postgres_query_not_ready");
}

describe("Postgres Memory Gateway (real RLS)", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
    admin = new Pool({ connectionString: adminUrl });
    await admin.query("CREATE ROLE authenticated NOLOGIN");
    await admin.query("CREATE ROLE memory_gateway_test LOGIN PASSWORD 'memory-test' NOSUPERUSER NOBYPASSRLS IN ROLE authenticated");
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF text LANGUAGE SQL STABLE AS $$ SELECT unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(readFileSync("supabase/migrations/20260913020000_0165_hermes_memory_gateway.sql", "utf8"));
  });

  afterAll(async () => {
    await admin?.end();
    if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  });

  it("persists/rebuilds after a new pool and rejects cross-tenant reads/writes", async () => {
    const tenantUrl = adminUrl.replace("postgres:test@", "memory_gateway_test:memory-test@");
    const tenantPool = new Pool({ connectionString: tenantUrl });
    const tenantClient = await tenantPool.connect();
    try {
      await tenantClient.query("SET app.org_ids = 'org-a'");
      const gatewayA = createPostgresMemoryGateway(tenantClient, orgA);
      expect((await gatewayA.append(record, "postgres")).created).toBe(true);
      expect((await gatewayA.append(record, "postgres")).created).toBe(false);
      expect(await rebuildProjectionViaGateway(gatewayA, { organizationId: orgA, subject: "ana", scope: "home:ana", namespace: "home:ana" })).toEqual([record]);
    } finally {
      tenantClient.release();
      await tenantPool.end();
    }

    const restartedPool = new Pool({ connectionString: tenantUrl });
    const restartedClient = await restartedPool.connect();
    try {
      await restartedClient.query("SET app.org_ids = 'org-a'");
      const rebuilt = createPostgresMemoryGateway(restartedClient, orgA);
      expect(await rebuilt.read("postgres", { organizationId: orgA, subject: "ana", scope: "home:ana", namespace: "home:ana" })).toEqual([record]);
    } finally {
      restartedClient.release();
      await restartedPool.end();
    }

    const crossTenantPool = new Pool({ connectionString: tenantUrl });
    const crossTenantClient = await crossTenantPool.connect();
    try {
      await crossTenantClient.query("SET app.org_ids = 'org-b'");
      const gatewayB = createPostgresMemoryGateway(crossTenantClient, orgB);
      await expect(gatewayB.read("postgres", { organizationId: orgA, subject: "ana", scope: "home:ana", namespace: "home:ana" })).rejects.toThrow("memory_gateway_tenant_mismatch");
      await expect(gatewayB.append(record, "postgres")).rejects.toThrow("memory_gateway_tenant_mismatch");
      expect((await gatewayB.read("postgres", { organizationId: orgB, subject: "ana", scope: "home:ana", namespace: "home:ana" }))).toEqual([]);
      await expect(crossTenantClient.query("INSERT INTO public.hermes_memory_records (organization_id,record_id,backend,subject,scope,namespace,content,observed_at,confidence) VALUES ('org-a','forged','postgres','ana','home:ana','home:ana','{}',now(),0.5)")).rejects.toMatchObject({ code: "42501" });
    } finally {
      crossTenantClient.release();
      await crossTenantPool.end();
    }
  });
});
