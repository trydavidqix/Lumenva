import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createCheckoutState } from "@/lib/billing/stripe-browser-state";
import { stripeCheckoutAdapter } from "./route";
import { authorizeModule } from "@/lib/entitlements/authorize-module";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/entitlements/authorize-module", () => ({ authorizeModule: vi.fn() }));

const exec = promisify(execFile);
const ORG = "00000000-0000-0000-0000-000000000001";
const SECRET = "real-postgres-route-secret";
let container = "";

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/v1/billing/checkout", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

function realDb(poolLabel: string) {
  const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn().mockResolvedValue({ data: { plan_id: "plan-1", plans: { slug: "premium" } }, error: null }) };
  return {
    poolLabel,
    from: vi.fn((table: string) => table === "idempotency_keys" ? {
      insert: async (values: { organization_id: string; key: string; endpoint: string; request_hash: string; response_body: Record<string, never>; status_code: number; expires_at: string }) => {
        try {
          const quote = (value: string) => value.replace(/'/g, "''");
          const sql = "INSERT INTO idempotency_keys (organization_id,key,endpoint,request_hash,response_body,status_code,expires_at) VALUES ('" +
            quote(values.organization_id) + "','" + quote(values.key) + "','" + quote(values.endpoint) + "',decode('" + quote(values.request_hash) + "','hex'),'" +
            quote(JSON.stringify(values.response_body)) + "'::jsonb," + String(values.status_code) + ",'" + quote(values.expires_at) + "');";
          await exec("docker", ["exec", container, "psql", "-U", "postgres", "-d", "test", "-v", "ON_ERROR_STOP=1", "-c", sql]);
          return { error: null };
        } catch (error) {
          const stderr = String((error as { stderr?: string }).stderr ?? error);
          if (stderr.includes("duplicate key")) return { error: { code: "23505", message: stderr } };
          return { error: { code: "XX000", message: stderr } };
        }
      },
    } : chain),
  };
}

describe("POST /api/v1/billing/checkout with real PostgreSQL", () => {
  beforeAll(async () => {
    container = `lumenva-checkout-pg-${process.pid}`;
    await exec("docker", ["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=test", "-e", "POSTGRES_DB=test", "postgres:16"]);
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        await exec("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "test"]);
        await new Promise((resolve) => setTimeout(resolve, 250));
        await exec("docker", ["exec", container, "psql", "-U", "postgres", "-d", "test", "-Atqc", "select 1"]);
        break;
      } catch {
        if (attempt === 59) throw new Error("Postgres 16 did not become ready");
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    await exec("docker", ["exec", container, "psql", "-U", "postgres", "-d", "test", "-v", "ON_ERROR_STOP=1", "-c", "CREATE TABLE idempotency_keys (id uuid primary key default gen_random_uuid(), organization_id uuid not null, key text not null, endpoint text not null, request_hash bytea not null, status_code integer not null, response_body jsonb not null, created_at timestamptz not null default now(), expires_at timestamptz not null, UNIQUE (organization_id,key,endpoint));"]);
  }, 120_000);

  afterAll(async () => {
    if (container) await exec("docker", ["rm", "-f", container]).catch(() => undefined);
  });

  it("allows exactly one of two concurrent endpoint requests using two real PostgreSQL clients", async () => {
    process.env.STRIPE_CHECKOUT_STATE_SECRET = SECRET;
    vi.mocked(requireRole).mockResolvedValue({ ok: true, user: { id: "user-real" } as never, org: { orgId: ORG, role: "admin" } as never });
    vi.mocked(authorizeModule).mockReturnValue({ decision: "ALLOW" } as never);
    vi.spyOn(stripeCheckoutAdapter, "resolvePrice").mockResolvedValue({ lookupKey: "lumenva_premium_monthly_eur", unitAmountCents: 19_900, currency: "eur", interval: "month" });
    vi.spyOn(stripeCheckoutAdapter, "createCheckoutSession").mockResolvedValue({ sessionId: "cs_real", url: "https://checkout.example/cs_real" });
    const body = { plan_slug: "premium", checkout_state: createCheckoutState({ organizationId: ORG, planSlug: "premium", nonce: "real-pg-replica-nonce", issuedAtUnix: Math.floor(Date.now() / 1000) }, SECRET), success_url: "https://example.test/success", cancel_url: "https://example.test/cancel" };
    vi.mocked(createClient).mockReset().mockResolvedValueOnce(realDb("pool-a") as never).mockResolvedValueOnce(realDb("pool-b") as never);
    const { POST } = await import("./route");
    const [first, second] = await Promise.all([POST(request(body)), POST(request(body))]);
    expect([first.status, second.status].sort()).toEqual([200, 403]);
    const { stdout } = await exec("docker", ["exec", container, "psql", "-U", "postgres", "-d", "test", "-Atqc", "SELECT count(*) FROM idempotency_keys WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND key = 'real-pg-replica-nonce' AND endpoint = 'stripe_checkout_state'"]);
    expect(stdout.trim()).toBe("1");
  }, 120_000);
});
