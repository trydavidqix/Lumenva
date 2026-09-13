import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createCheckoutState } from "@/lib/billing/stripe-browser-state";
import { stripeCheckoutAdapter } from "./route";
import { authorizeModule } from "@/lib/entitlements/authorize-module";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/auth/require-role", () => ({ requireRole: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/entitlements/authorize-module", () => ({ authorizeModule: vi.fn() }));

const ORG = "org-1";
const USER = "user-1";
const SECRET = "route-test-secret";
let nonce = 0;

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/v1/billing/checkout", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
}
function validState(organizationId = ORG, planSlug = "premium") {
  nonce += 1;
  return createCheckoutState({ organizationId, planSlug, nonce: `route-nonce-${nonce}`, issuedAtUnix: Math.floor(Date.now() / 1000) }, SECRET);
}
function validBody(overrides: Record<string, unknown> = {}) {
  return { plan_slug: "premium", checkout_state: validState(), success_url: "https://example.test/success", cancel_url: "https://example.test/cancel", ...overrides };
}
function db() {
  const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), maybeSingle: vi.fn().mockResolvedValue({ data: { plan_id: "plan-1", plans: { slug: "premium" } }, error: null }) };
  return { from: vi.fn(() => chain) };
}

describe("POST /api/v1/billing/checkout security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_CHECKOUT_STATE_SECRET = SECRET;
    vi.mocked(requireRole).mockResolvedValue({ ok: true, user: { id: USER } as never, org: { orgId: ORG, role: "admin" } as never });
    vi.mocked(createClient).mockResolvedValue(db() as never);
    vi.mocked(authorizeModule).mockReturnValue({ decision: "ALLOW" } as never);
    vi.spyOn(stripeCheckoutAdapter, "resolvePrice").mockResolvedValue({ lookupKey: "lumenva_premium_monthly_eur", unitAmountCents: 19_900, currency: "eur", interval: "month" });
    vi.spyOn(stripeCheckoutAdapter, "createCheckoutSession").mockResolvedValue({ sessionId: "cs_test", url: "https://checkout.example/cs_test" });
  });

  it("allows a signed, tenant-bound, single-use state and calls the adapter", async () => {
    const { POST } = await import("./route");
    const response = await POST(request(validBody()));
    expect(response.status).toBe(200);
    expect(stripeCheckoutAdapter.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, priceLookupKey: "lumenva_premium_monthly_eur" }));
  });

  it("rejects tenant-mismatched state before Supabase or Stripe", async () => {
    const { POST } = await import("./route");
    const response = await POST(request(validBody({ checkout_state: validState("org-2") })));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("invalid_checkout_state");
    expect(createClient).not.toHaveBeenCalled();
    expect(stripeCheckoutAdapter.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects invalid/replayed state and strict browser fields", async () => {
    const { POST } = await import("./route");
    const body = validBody();
    expect((await POST(request({ ...body, checkout_state: `${String(body.checkout_state).slice(0, -1)}x` }))).status).toBe(403);
    const replay = validBody();
    expect((await POST(request(replay))).status).toBe(200);
    expect((await POST(request(replay))).status).toBe(403);
    expect((await POST(request({ ...validBody(), organization_id: ORG }))).status).toBe(422);
  });

  it("returns 503 and never succeeds when the adapter is unavailable", async () => {
    vi.spyOn(stripeCheckoutAdapter, "resolvePrice").mockRejectedValue(new Error("provider down"));
    const { POST } = await import("./route");
    const response = await POST(request(validBody()));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("upstream_unavailable");
  });

  it("returns 422 and does not create a session for divergent Price", async () => {
    vi.spyOn(stripeCheckoutAdapter, "resolvePrice").mockResolvedValue({ lookupKey: "lumenva_premium_monthly_eur", unitAmountCents: 1, currency: "eur", interval: "month" });
    const { POST } = await import("./route");
    const response = await POST(request(validBody()));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("price_mismatch");
    expect(stripeCheckoutAdapter.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns 403 before Stripe when Bronze entitlement is DENY", async () => {
    vi.mocked(authorizeModule).mockReturnValue({ decision: "DENY", reason: "risk_exceeds_policy" } as never);
    const { POST } = await import("./route");
    const response = await POST(request(validBody()));
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("forbidden");
    expect(stripeCheckoutAdapter.createCheckoutSession).not.toHaveBeenCalled();
  });
});
