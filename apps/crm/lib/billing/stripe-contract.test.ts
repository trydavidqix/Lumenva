import { describe, expect, it } from "vitest";
import {
  authorizeCheckoutPlan,
  decideWebhook,
  denyWhenProviderUnavailable,
  redactStripePayload,
  requireWebhookSignature,
  type StripeWebhookEnvelope,
  type WebhookState,
} from "./stripe-contract";

const state: WebhookState = {
  eventIds: new Set(),
  latestCreatedByResource: new Map(),
};

const event = (overrides: Partial<StripeWebhookEnvelope> = {}): StripeWebhookEnvelope => ({
  eventId: "evt_1",
  tenantId: "tenant_a",
  resourceId: "sub_1",
  createdAtUnix: 100,
  payload: { metadata: { tenant_id: "tenant_a", safe: "ok" }, card_number: "4242424242424242" },
  ...overrides,
});

describe("Stripe checkout/webhook contract", () => {
  it("requires a non-empty signature and provider verification", () => {
    expect(requireWebhookSignature(undefined)).toBe("missing");
    expect(decideWebhook(event(), undefined, true, state)).toEqual({ action: "DENY", reason: "missing_signature" });
    expect(decideWebhook(event(), "t=1,v1=bad", false, state)).toEqual({ action: "DENY", reason: "invalid_signature" });
    expect(decideWebhook(event(), "t=1,v1=ok", true, state)).toEqual({ action: "ALLOW", reason: "accepted" });
  });

  it("makes duplicate event delivery idempotent and rejects temporal replay", () => {
    expect(decideWebhook(event({ eventId: "evt_seen" }), "sig", true, { ...state, eventIds: new Set(["evt_seen"]) })).toEqual({ action: "ALLOW", reason: "duplicate" });
    expect(decideWebhook(event({ createdAtUnix: 99 }), "sig", true, { ...state, latestCreatedByResource: new Map([["sub_1", 100]]) })).toEqual({ action: "DENY", reason: "out_of_order" });
    expect(decideWebhook(event({ createdAtUnix: 100 }), "sig", true, { ...state, latestCreatedByResource: new Map([["sub_1", 100]]) })).toEqual({ action: "ALLOW", reason: "accepted" });
  });

  it("binds the event tenant to signed payload metadata", () => {
    expect(decideWebhook(event({ payload: { metadata: { tenant_id: "tenant_b" } } }), "sig", true, state)).toEqual({ action: "DENY", reason: "tenant_mismatch" });
    expect(decideWebhook(event({ tenantId: "tenant_b" }), "sig", true, state)).toEqual({ action: "DENY", reason: "tenant_mismatch" });
  });

  it("redacts payload secrets and payment data recursively", () => {
    expect(redactStripePayload({ metadata: { tenant_id: "tenant_a" }, card_number: "4242", nested: [{ email: "a@b.test", ok: 1 }] })).toEqual({ metadata: { tenant_id: "tenant_a" }, card_number: "[REDACTED]", nested: [{ email: "[REDACTED]", ok: 1 }] });
  });

  it("authorizes only canonical plan slugs, never Product/Price IDs", () => {
    expect(authorizeCheckoutPlan({ planSlug: "premium" })).toMatchObject({ action: "ALLOW", planSlug: "premium" });
    expect(authorizeCheckoutPlan({ planSlug: "premium", productId: "prod_live" })).toEqual({ action: "DENY", reason: "provider_ids_not_authoritative" });
    expect(authorizeCheckoutPlan({ priceId: "price_live" })).toEqual({ action: "DENY", reason: "provider_ids_not_authoritative" });
    expect(authorizeCheckoutPlan({ planSlug: "not-canonical" })).toEqual({ action: "DENY", reason: "unknown_plan" });
  });

  it("fails closed when the provider is unavailable", () => {
    expect(denyWhenProviderUnavailable(false)).toEqual({ action: "DENY", reason: "provider_unavailable" });
    expect(denyWhenProviderUnavailable(true)).toEqual({ action: "ALLOW" });
  });
});
