import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { createCheckoutState } from "@/lib/billing/stripe-browser-state";

const state = vi.hoisted(() => ({ order: [] as string[], decision: "ALLOW" as "ALLOW" | "DENY", adapter: vi.fn() }));

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn(async () => ({ ok: true, user: { id: "user-1" }, org: { orgId: "org-1", role: "admin" } })) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: (table: string) => table === "idempotency_keys" ? { insert: vi.fn(async () => ({ error: null })) } : { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { plans: [{ slug: "premium" }] }, error: null }) }) }) }) } })) }));
vi.mock("@/lib/entitlements/authorize-module", () => ({ authorizeModule: vi.fn(() => { state.order.push("authorizeModule"); return state.decision === "ALLOW" ? { decision: "ALLOW", policyVersion: "entitlements.v1", audit: {} } : { decision: "DENY", reason: "module_not_entitled", policyVersion: "entitlements.v1", audit: {} }; }) }));

import { configureStripeCheckoutAdapter, POST } from "@/app/api/v1/billing/checkout/route";

const CHECKOUT_SECRET = "test-checkout-secret";
vi.stubEnv("STRIPE_CHECKOUT_STATE_SECRET", CHECKOUT_SECRET);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/v1/billing/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function checkoutState(organizationId: string, planSlug: string, nonce = `${organizationId}-${planSlug}`) {
  return createCheckoutState({ organizationId, planSlug, nonce, issuedAtUnix: Math.floor(Date.now() / 1000) }, CHECKOUT_SECRET);
}

describe("POST /api/v1/billing/checkout integration", () => {
  it("uses the central gate before a fake provider checkout and binds organization", async () => {
    state.order = [];
    state.decision = "ALLOW";
    state.adapter.mockImplementation(async (input) => { state.order.push("adapter"); return { sessionId: "cs_fake", url: "https://checkout.test/cs_fake", price: { lookupKey: input.priceLookupKey, unitAmountCents: 19_900, currency: "eur", interval: "month" } }; });
    configureStripeCheckoutAdapter({ createCheckoutSession: state.adapter });
    const response = await POST(request({ plan_slug: "premium", checkout_state: checkoutState("org-1", "premium"), success_url: "https://app.test/success", cancel_url: "https://app.test/cancel" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { sessionId: "cs_fake" } });
    expect(state.order).toEqual(["authorizeModule", "adapter"]);
    expect(state.adapter).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "org-1", trialDays: 14, trialRequiresPaymentMethod: false, metadata: { organization_id: "org-1", plan_slug: "premium" } }));
  });

  it("fails closed when the central gate denies", async () => {
    state.order = [];
    state.decision = "DENY";
    state.adapter.mockClear();
    const response = await POST(request({ plan_slug: "basic", checkout_state: checkoutState("org-1", "basic", "deny-basic"), success_url: "https://app.test/success", cancel_url: "https://app.test/cancel" }));
    expect(response.status).toBe(403);
    expect(state.order).toEqual(["authorizeModule"]);
    expect(state.adapter).not.toHaveBeenCalled();
  });

  it("rejects a body organization outside the active tenant", async () => {
    state.order = [];
    state.decision = "ALLOW";
    state.adapter.mockClear();
    const response = await POST(request({ plan_slug: "basic", checkout_state: checkoutState("org-other", "basic", "cross-tenant"), success_url: "https://app.test/success", cancel_url: "https://app.test/cancel" }));
    expect(response.status).toBe(403);
    expect(state.order).toEqual([]);
    expect(state.adapter).not.toHaveBeenCalled();
  });
});
