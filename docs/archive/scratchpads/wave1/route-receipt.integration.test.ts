import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const { auth, supabase } = vi.hoisted(() => ({
  auth: {
    organizationId: "11111111-1111-4111-8111-111111111111",
    role: "agent" as const,
    actor: { type: "user" as const, id: "actor-a", role: "agent" as const },
    apiTokenId: "token-a",
    scopes: ["mcp:read", "mcp:write"],
  },
  supabase: {} as Record<string, unknown>,
}));
let containerId = "";
let admin: Pool;
let writerUrl = "";

vi.mock("@/lib/mcp/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mcp/auth")>("@/lib/mcp/auth");
  return { ...actual, validateBearerToken: vi.fn().mockResolvedValue(auth) };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => supabase) }));
vi.mock("@/lib/mcp/audit", () => ({ auditMcpToolCall: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth/server", () => ({ loadAuthUser: vi.fn(), resolveActiveOrg: vi.fn() }));

import { POST } from "@/app/api/v1/mcp/tools/route";
import { closeHttpExecutionReceiptStore } from "@/lib/mcp/http-execution-receipt-store";

function queryReturning(data: unknown) {
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
  };
  return query;
}

async function waitForPostgres(url: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const pool = new Pool({ connectionString: url });
      await pool.query("select 1");
      await pool.end();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error("postgres_not_ready");
}

describe("HTTP execution receipt store (real Postgres)", () => {
  beforeAll(async () => {
    if (!process.env.RUN_REAL_POSTGRES_TESTS) return;
    execFileSync("docker", ["image", "inspect", "postgres:16"], { stdio: "ignore" });
    containerId = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", containerId, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_not_found");
    const adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    await waitForPostgres(adminUrl);
    admin = new Pool({ connectionString: adminUrl });
    await admin.query("CREATE ROLE authenticated NOLOGIN");
    await admin.query("CREATE ROLE service_role NOLOGIN");
    await admin.query("CREATE ROLE http_writer LOGIN NOSUPERUSER NOBYPASSRLS IN ROLE authenticated PASSWORD 'writer'");
    await admin.query("CREATE OR REPLACE FUNCTION public.fn_user_org_ids() RETURNS SETOF uuid LANGUAGE SQL STABLE AS $$ SELECT value::uuid FROM unnest(string_to_array(current_setting('app.org_ids', true), ',')) AS value WHERE value <> '' $$");
    await admin.query(readFileSync("supabase/migrations/20260913180000_operating_core_http_execution_receipts.sql", "utf8"));
    writerUrl = `postgres://http_writer:writer@127.0.0.1:${port}/postgres?options=-c%20app.org_ids%3D${orgA}`;
    process.env.WAVE1_RECEIPT_DATABASE_URL = writerUrl;
    const rows = [{ id: "proposal-1", evidence: { source: "fixture" } }];
    (supabase as { from?: unknown }).from = vi.fn(() => queryReturning(rows));
  });

  afterAll(async () => {
    await closeHttpExecutionReceiptStore();
    await admin?.end();
    if (containerId) execFileSync("docker", ["rm", "-f", containerId], { stdio: "ignore" });
  });

  it("persists idempotently, reconstructs after a new pool, enforces RLS, and rejects cross-tenant endpoint input", async () => {
    if (!process.env.RUN_REAL_POSTGRES_TESTS) return;
    const request = () => POST(new Request("http://localhost/api/v1/mcp/tools", {
      method: "POST",
      headers: { authorization: "Bearer dsk_fixture", "x-request-id": "req-real-1" },
      body: JSON.stringify({ toolName: "crm_list_improvement_proposals", args: { limite: 5 } }),
    }) as never);
    const firstResponse = await request();
    const firstBody = await firstResponse.json();
    expect(firstResponse.status).toBe(200);
    expect(firstBody.data.result).toEqual({ propostas: [{ id: "proposal-1", evidence: { source: "fixture" } }] });
    const secondResponse = await request();
    const secondBody = await secondResponse.json();
    expect(secondResponse.status).toBe(200);
    expect(secondBody.data.result).toEqual({ propostas: [{ id: "proposal-1", evidence: { source: "fixture" } }] });

    const reconstructed = new Pool({ connectionString: writerUrl });
    const persisted = await reconstructed.query("select organization_id, request_id, tool_name, outcome, evidence from public.operating_core_http_execution_receipts where organization_id = $1", [orgA]);
    await reconstructed.end();
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]).toMatchObject({ organization_id: orgA, request_id: "req-real-1", tool_name: "crm_list_improvement_proposals", outcome: "SUCCEEDED", evidence: { source: "mcp_http" } });

    const rls = new Pool({ connectionString: `postgres://http_writer:writer@${writerUrl.split("@")[1].split("?")[0]}?options=-c%20app.org_ids%3D${orgB}` });
    const hidden = await rls.query("select * from public.operating_core_http_execution_receipts");
    expect(hidden.rows).toHaveLength(0);
    await expect(rls.query("insert into public.operating_core_http_execution_receipts (organization_id,request_id,tool_name,actor_id,outcome,result,evidence) values ($1,'cross','tool','actor','SUCCEEDED','{}','{}')", [orgA])).rejects.toMatchObject({ code: "42501" });
    await rls.end();

    const crossTenant = await POST(new Request("http://localhost/api/v1/mcp/tools", {
      method: "POST", headers: { authorization: "Bearer dsk_fixture" },
      body: JSON.stringify({ organizationId: orgB, toolName: "crm_list_improvement_proposals", args: { limite: 5 } }),
    }) as never);
    expect(crossTenant.status).toBe(403);
    const count = await admin.query("select count(*)::int as count from public.operating_core_http_execution_receipts where organization_id = $1", [orgA]);
    expect(count.rows[0].count).toBe(1);
  });
});
