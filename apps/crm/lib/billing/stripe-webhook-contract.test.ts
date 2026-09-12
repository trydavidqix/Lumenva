import { describe, expect, it } from "vitest";
import { decideStripeWebhook, denyWhenStripeProviderUnavailable, redactStripeWebhookPayload, type StripeWebhookEvent, type StripeWebhookState } from "./stripe-webhook-contract";

const state: StripeWebhookState = { eventIds: new Set(), latestCreatedByResource: new Map() };
const event = (overrides: Partial<StripeWebhookEvent> = {}): StripeWebhookEvent => ({ eventId: "evt_1", tenantId: "org_1", resourceId: "sub_1", createdAtUnix: 100, payload: { metadata: { organization_id: "org_1" }, card_number: "4242" }, ...overrides });

describe("Stripe webhook security contract", () => {
  it("requires a present and verified signature", () => {
    expect(decideStripeWebhook(event(), undefined, true, state)).toEqual({ action: "DENY", reason: "missing_signature" });
    expect(decideStripeWebhook(event(), "t=1,v1=bad", false, state)).toEqual({ action: "DENY", reason: "invalid_signature" });
    expect(decideStripeWebhook(event(), "t=1,v1=ok", true, state)).toEqual({ action: "ALLOW", reason: "accepted" });
  });

  it("is idempotent for duplicate events and rejects temporal replay", () => {
    expect(decideStripeWebhook(event({ eventId: "evt_seen" }), "sig", true, { ...state, eventIds: new Set(["evt_seen"]) })).toEqual({ action: "ALLOW", reason: "duplicate" });
    expect(decideStripeWebhook(event({ createdAtUnix: 99 }), "sig", true, { ...state, latestCreatedByResource: new Map([["sub_1", 100]]) })).toEqual({ action: "DENY", reason: "out_of_order" });
  });

  it("binds organization metadata to the server-resolved tenant", () => {
    expect(decideStripeWebhook(event({ payload: { metadata: { organization_id: "org_2" } } }), "sig", true, state)).toEqual({ action: "DENY", reason: "tenant_mismatch" });
    expect(decideStripeWebhook(event({ tenantId: "org_2" }), "sig", true, state)).toEqual({ action: "DENY", reason: "tenant_mismatch" });
  });

  it("redacts secrets and payment/PII fields recursively", () => {
    expect(redactStripeWebhookPayload({ metadata: { organization_id: "org_1" }, card_number: "4242", nested: [{ email: "x@y.test", ok: true }] })).toEqual({ metadata: { organization_id: "org_1" }, card_number: "[REDACTED]", nested: [{ email: "[REDACTED]", ok: true }] });
  });

  it("fails closed when provider availability is false", () => {
    expect(denyWhenStripeProviderUnavailable(false)).toEqual({ action: "DENY", reason: "provider_unavailable" });
    expect(denyWhenStripeProviderUnavailable(true)).toEqual({ action: "ALLOW" });
  });
});
