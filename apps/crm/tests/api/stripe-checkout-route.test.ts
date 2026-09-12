import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ order: [] as string[], decision: "ALLOW" as "ALLOW" | "DENY", adapter: vi.fn() }));

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn(async () => ({ ok: true, user: { id: "user-1" }, org: { orgId: "org-1", role: "admin" } })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { plans: [{ slug: "premium" }] }, error: null }) }) }) }) }) })) }));
vi.mock("@/lib/entitlements/authorize-module", () => ({ authorizeModule: vi.fn(() => { state.order.push("authorizeModule"); return state.decision === "ALLOW" ? { decision: "ALLOW", policyVersion: "entitlements.v1", audit: {} } : { decision: "DENY", reason: "module_not_entitled", policyVersion: "entitlements.v1", audit: {} }; }) }));

import { configureStripeCheckoutAdapter, POST } from "@/app/api/v1/billing/checkout/route";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/v1/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/v1/billing/checkout integration", () => {
  it("uses the central gate before a fake provider checkout and binds organization", async () => {
    state.order = [];
    state.decision = "ALLOW";
    state.adapter.mockImplementation(async (input) => { state.order.push("adapter"); return { sessionId: "cs_fake", url: "https://checkout.test/cs_fake", price: { lookupKey: input.priceLookupKey, unitAmountCents: 19_900, currency: "eur", interval: "month" } }; });
    configureStripeCheckoutAdapter({ createCheckoutSession: state.adapter });
    const response = await POST(request({ plan_slug: "premium", organization_id: "org-1", success_url: "https://app.test/success", cancel_url: "https://app.test/cancel" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { sessionId: "cs_fake" } });
    expect(state.order).toEqual(["authorizeModule", "adapter"]);
    expect(state.adapter).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", trialDays: 14, trialRequiresPaymentMethod: false, metadata: { organization_id: "org-1", plan_slug: "premium" } }));
  });

  it("fails closed when the central gate denies", async () => {
    state.order = [];
    state.decision = "DENY";
    state.adapter.mockClear();
    const response = await POST(request({ plan_slug: "basic", organization_id: "org-1", success_url: "https://app.test/success", cancel_url: "https://app.test/cancel" }));
    expect(response.status).toBe(403);
    expect(state.order).toEqual(["authorizeModule"]);
    expect(state.adapter).not.toHaveBeenCalled();
  });

  it("rejects a body organization outside the active tenant", async () => {
    state.decision = "ALLOW";
    state.adapter.mockClear();
    const response = await POST(request({ plan_slug: "basic", organization_id: "org-other", success_url: "https://app.test/success", cancel_url: "https://app.test/cancel" }));
    expect(response.status).toBe(403);
    expect(state.adapter).not.toHaveBeenCalled();
  });
});
