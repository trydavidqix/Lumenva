import { describe, expect, it } from "vitest";
import { guardStripeCheckoutRoute, guardStripeWebhookRoute, type BrowserCheckoutState } from "./stripe-route-contract";
import type { StripeWebhookEvent } from "./stripe-webhook-contract";

const state = { eventIds: new Set<string>(), latestCreatedByResource: new Map<string, number>() };
const browser = (overrides: Partial<BrowserCheckoutState> = {}): BrowserCheckoutState => ({ organizationId: "org-1", planSlug: "premium", issuedAtUnix: 1_000, ...overrides });
const event = (overrides: Partial<StripeWebhookEvent> = {}): StripeWebhookEvent => ({ eventId: "evt_1", tenantId: "org-1", resourceId: "sub-1", createdAtUnix: 100, payload: { metadata: { organization_id: "org-1" } }, ...overrides });

describe("Stripe route contracts linked to Torno/Bronze decisions", () => {
  it("uses trusted tenant plus explicit ALLOW entitlement from Bronze or Torno", () => {
    expect(guardStripeCheckoutRoute({ planSlug: "premium" }, "org-1", { decision: "ALLOW" }, browser(), 1_100)).toMatchObject({ action: "ALLOW", organizationId: "org-1" });
    expect(guardStripeCheckoutRoute({ planSlug: "premium" }, "org-1", { kind: "ALLOW" }, browser(), 1_100)).toMatchObject({ action: "ALLOW", organizationId: "org-1" });
    expect(guardStripeCheckoutRoute({ planSlug: "premium" }, "org-2", { decision: "ALLOW" }, browser(), 1_100)).toEqual({ action: "DENY", reason: "tenant_mismatch" });
    expect(guardStripeCheckoutRoute({ planSlug: "premium" }, "org-1", { decision: "DENY", reason: "risk_exceeds_policy" }, browser(), 1_100)).toEqual({ action: "DENY", reason: "entitlement_denied" });
  });

  it("requires non-stale browser state and rejects browser Product/Price IDs or plan drift", () => {
    expect(guardStripeCheckoutRoute({ planSlug: "premium" }, "org-1", { decision: "ALLOW" }, null, 1_100)).toEqual({ action: "DENY", reason: "invalid_browser_state" });
    expect(guardStripeCheckoutRoute({ planSlug: "premium" }, "org-1", { decision: "ALLOW" }, browser({ issuedAtUnix: 0 }), 1_000)).toEqual({ action: "DENY", reason: "invalid_browser_state" });
    expect(guardStripeCheckoutRoute({ planSlug: "premium" }, "org-1", { decision: "ALLOW" }, browser({ productId: "prod_live" }), 1_100)).toEqual({ action: "DENY", reason: "invalid_browser_state" });
    expect(guardStripeCheckoutRoute({ planSlug: "basic" }, "org-1", { decision: "ALLOW" }, browser(), 1_100)).toEqual({ action: "DENY", reason: "invalid_browser_state" });
    expect(guardStripeCheckoutRoute({ planSlug: "premium", priceId: "price_live" }, "org-1", { decision: "ALLOW" }, browser(), 1_100)).toEqual({ action: "DENY", reason: "provider_ids_not_authoritative" });
  });

  it("fails closed for missing tenant or unknown plan", () => {
    expect(guardStripeCheckoutRoute({ planSlug: "premium" }, null, { decision: "ALLOW" }, browser(), 1_100)).toEqual({ action: "DENY", reason: "unauthenticated_tenant" });
    expect(guardStripeCheckoutRoute({ planSlug: "unknown" }, "org-1", { decision: "ALLOW" }, browser({ planSlug: "unknown" }), 1_100)).toEqual({ action: "DENY", reason: "unknown_plan" });
  });

  it("rejects invalid webhook signatures and allows only verified delivery", () => {
    expect(guardStripeWebhookRoute(event(), undefined, true, state)).toEqual({ action: "DENY", reason: "missing_signature" });
    expect(guardStripeWebhookRoute(event(), "bad", false, state)).toEqual({ action: "DENY", reason: "invalid_signature" });
    expect(guardStripeWebhookRoute(event(), "valid", true, state)).toEqual({ action: "ALLOW", reason: "accepted" });
  });

  it("rejects replay and cross-tenant webhook delivery", () => {
    expect(guardStripeWebhookRoute(event({ eventId: "seen" }), "valid", true, { ...state, eventIds: new Set(["seen"]) })).toEqual({ action: "ALLOW", reason: "duplicate" });
    expect(guardStripeWebhookRoute(event({ payload: { metadata: { organization_id: "org-2" } } }), "valid", true, state)).toEqual({ action: "DENY", reason: "tenant_mismatch" });
  });
});
