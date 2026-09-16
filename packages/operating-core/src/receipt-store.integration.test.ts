import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "../../../apps/crm/node_modules/pg";
import { createPostgresExecutionReceiptStore } from "./receipt-store.js";
import type { ReceiptInput } from "./receipt-store.js";

let container = "";
let admin: Pool;
let adminUrl = "";

async function waitForPostgres(connectionString: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const probe = new Pool({ connectionString });
      await probe.query("select 1");
      await probe.end();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("postgres_query_not_ready");
}

const base: ReceiptInput = {
  organizationId: "11111111-1111-1111-1111-111111111111",
  executionId: "exec-concurrent",
  jobId: "job-concurrent",
  action: "job.complete",
  status: "SUCCEEDED",
  actorId: "worker-a",
  policyVersion: "policy-v1",
  permissionLevel: "P2",
  riskLevel: "R1",
  idempotencyKey: "idem-concurrent",
  result: { completed: true },
  evidenceRefs: ["evidence-concurrent"],
  createdAt: "2026-09-13T00:00:00.000Z",
};

describe("Wave 1 receipt Postgres integration", () => {
  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
    admin = new Pool({ connectionString: adminUrl });
    await admin.query("create table public.organizations (id uuid primary key)");
    await admin.query("insert into public.organizations (id) values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222')");
    await admin.query("create role authenticated nologin");
    await admin.query("create role service_role nologin");
    await admin.query("create role receipt_test login password 'receipt-test' nosuperuser nobypassrls in role authenticated");
    await admin.query("create or replace function public.fn_user_org_ids() returns setof uuid language sql stable as $$ select unnest(string_to_array(current_setting('app.org_ids', true), ','))::uuid $$");
    await admin.query(await readFile(join(process.cwd(), "supabase/migrations/20260913140000_0180_operating_core_receipts.sql"), "utf8"));
  }, 30_000);

  afterAll(async () => {
    await admin?.end();
    if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  });

  it("coalesces concurrent writes and isolates tenant rows with real RLS", async () => {
    const url = adminUrl.replace("postgres:test@", "receipt_test:receipt-test@");
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query("set app.org_ids = '11111111-1111-1111-1111-111111111111'");
      const store = createPostgresExecutionReceiptStore(client);
      const receipts = await Promise.all(Array.from({ length: 16 }, (_, index) => store.save({ ...base, id: `concurrent-${index}` })));
      expect(new Set(receipts.map((receipt) => receipt.id)).size).toBe(1);
      const result = await client.query("select count(*)::int as count from public.operating_core_receipts where organization_id = $1 and idempotency_key = $2", [base.organizationId, base.idempotencyKey]);
      expect(result.rows[0]?.count).toBe(1);
      const crossTenant = await client.query("select count(*)::int as count from public.operating_core_receipts where organization_id = '22222222-2222-2222-2222-222222222222'");
      expect(crossTenant.rows[0]?.count).toBe(0);
      await expect(client.query("insert into public.operating_core_receipts (id, organization_id, execution_id, action, status, actor_id, policy_version, permission_level, risk_level, idempotency_key, created_at) values ('cross', '22222222-2222-2222-2222-222222222222', 'exec', 'act', 'SUCCEEDED', 'actor', 'policy', 'P2', 'R1', 'cross', now())")).rejects.toMatchObject({ code: "42501" });
    } finally {
      client.release();
      await pool.end();
    }
  }, 30_000);
});
