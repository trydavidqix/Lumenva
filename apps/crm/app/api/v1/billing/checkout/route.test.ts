import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const ORG = "org-a";
const authOk = () => vi.mocked(requireRole).mockResolvedValue({ ok: true, org: { orgId: ORG, role: "admin" }, user: { id: "user-a", role: "admin" } } as never);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/v1/billing/checkout", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}

function dbDouble(planSlug: string, modules: string[]) {
  const calls: string[] = [];
  const assignmentQuery = {
    select: () => assignmentQuery,
    eq: () => assignmentQuery,
    maybeSingle: async () => ({ data: { plan_id: "plan-1", plans: { slug: planSlug } }, error: null }),
  };
  const moduleQuery = {
    select: () => moduleQuery,
    eq: async () => ({ data: modules.map((slug) => ({ modules: { slug } })), error: null }),
  };
  vi.mocked(createClient).mockResolvedValue({ from: (table: string) => { calls.push(table); return table === "organization_plan" ? assignmentQuery : moduleQuery; } } as never);
  return calls;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/v1/billing/checkout", () => {
  it("rejects a browser plan_slug that differs from the active organization plan", async () => {
    authOk();
    const calls = dbDouble("premium", ["billing_checkout"]);
    const { POST } = await import("./route");
    const response = await POST(request({ plan_slug: "basic", organization_id: ORG, success_url: "https://example.test/s", cancel_url: "https://example.test/c" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "plan_mismatch" } });
    expect(calls).toEqual(["organization_plan"]);
  });

  it("derives entitled modules from plan_modules instead of hardcoding billing access", async () => {
    authOk();
    const calls = dbDouble("premium", ["contacts"]);
    const { POST } = await import("./route");
    const response = await POST(request({ plan_slug: "premium", organization_id: ORG, success_url: "https://example.test/s", cancel_url: "https://example.test/c" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "forbidden", details: { reason: "module_not_entitled" } } });
    expect(calls).toEqual(["organization_plan", "plan_modules"]);
  });

  it("reaches the provider seam only after an effective billing entitlement", async () => {
    authOk();
    dbDouble("premium", ["billing_checkout"]);
    const { POST } = await import("./route");
    const response = await POST(request({ plan_slug: "premium", organization_id: ORG, success_url: "https://example.test/s", cancel_url: "https://example.test/c" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "upstream_unavailable" } });
  });
});
