import { describe, expect, it } from "vitest";
import { consumeCheckoutState, createCheckoutState, type CheckoutStateStore } from "./stripe-browser-state";

const secret = "test-secret";
const payload = { organizationId: "org-1", planSlug: "premium", nonce: "nonce-1", issuedAtUnix: 1_000 };
function store(): CheckoutStateStore { const used = new Set<string>(); return { has: (nonce) => used.has(nonce), add: (nonce) => { used.add(nonce); } }; }

describe("Stripe checkout browser state", () => {
  it("accepts a signed tenant-bound state once", () => {
    const state = createCheckoutState(payload, secret);
    const s = store();
    expect(consumeCheckoutState(state, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: s })).toBe(true);
    expect(consumeCheckoutState(state, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: s })).toBe(false);
  });
  it("rejects tampering, tenant/plan mismatch and bad secret", () => {
    const state = createCheckoutState(payload, secret);
    const tampered = `${state.slice(0, -1)}x`;
    expect(consumeCheckoutState(tampered, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: store() })).toBe(false);
    expect(consumeCheckoutState(state, { organizationId: "org-2", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: store() })).toBe(false);
    expect(consumeCheckoutState(state, { organizationId: "org-1", planSlug: "basic", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: store() })).toBe(false);
    expect(consumeCheckoutState(state, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret: "wrong", store: store() })).toBe(false);
  });
  it("rejects absent, expired and future state", () => {
    expect(consumeCheckoutState(null, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: store() })).toBe(false);
    const expired = createCheckoutState({ ...payload, nonce: "nonce-expired", issuedAtUnix: 0 }, secret);
    expect(consumeCheckoutState(expired, { organizationId: "org-1", planSlug: "premium", nowUnix: 901, maxAgeSeconds: 900, secret, store: store() })).toBe(false);
    const future = createCheckoutState({ ...payload, nonce: "nonce-future", issuedAtUnix: 2_000 }, secret);
    expect(consumeCheckoutState(future, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: store() })).toBe(false);
  });
});
