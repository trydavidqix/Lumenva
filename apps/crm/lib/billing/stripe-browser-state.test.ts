import { describe, expect, it } from "vitest";
import { consumeCheckoutState, createCheckoutState, createPostgresCheckoutStateStore, type CheckoutStateDb, type CheckoutStateStore } from "./stripe-browser-state";

const secret = "test-secret";
const payload = { organizationId: "org-1", planSlug: "premium", nonce: "nonce-1", issuedAtUnix: 1_000 };
function memoryStore(): CheckoutStateStore { const used = new Set<string>(); return { claim: async (_organizationId, nonce) => { if (used.has(nonce)) return false; used.add(nonce); return true; } }; }

describe("Stripe checkout browser state", () => {
  it("accepts a signed tenant-bound state once", async () => {
    const state = createCheckoutState(payload, secret);
    const store = memoryStore();
    expect(await consumeCheckoutState(state, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store })).toBe(true);
    expect(await consumeCheckoutState(state, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store })).toBe(false);
  });
  it("rejects tampering, tenant/plan mismatch and bad secret", async () => {
    const state = createCheckoutState(payload, secret);
    expect(await consumeCheckoutState(`${state.slice(0, -1)}x`, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: memoryStore() })).toBe(false);
    expect(await consumeCheckoutState(state, { organizationId: "org-2", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: memoryStore() })).toBe(false);
    expect(await consumeCheckoutState(state, { organizationId: "org-1", planSlug: "basic", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: memoryStore() })).toBe(false);
    expect(await consumeCheckoutState(state, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret: "wrong", store: memoryStore() })).toBe(false);
  });
  it("rejects absent, expired and future state", async () => {
    expect(await consumeCheckoutState(null, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: memoryStore() })).toBe(false);
    const expired = createCheckoutState({ ...payload, nonce: "nonce-expired", issuedAtUnix: 0 }, secret);
    expect(await consumeCheckoutState(expired, { organizationId: "org-1", planSlug: "premium", nowUnix: 901, maxAgeSeconds: 900, secret, store: memoryStore() })).toBe(false);
    const future = createCheckoutState({ ...payload, nonce: "nonce-future", issuedAtUnix: 2_000 }, secret);
    expect(await consumeCheckoutState(future, { organizationId: "org-1", planSlug: "premium", nowUnix: 1_100, maxAgeSeconds: 900, secret, store: memoryStore() })).toBe(false);
  });
  it("claims once across two independent Postgres client pools", async () => {
    const claims = new Set<string>();
    const makePool = (): CheckoutStateDb => ({ from: () => ({ insert: async (values) => {
      const key = `${values.organization_id}:${values.endpoint}:${values.key}`;
      if (claims.has(key)) return { error: { code: "23505", message: "unique violation" } };
      claims.add(key);
      return { error: null };
    } }) });
    const poolA = createPostgresCheckoutStateStore(makePool());
    const poolB = createPostgresCheckoutStateStore(makePool());
    const results = await Promise.all([
      poolA.claim("org-1", "replica-nonce", 1_100, 900),
      poolB.claim("org-1", "replica-nonce", 1_100, 900),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(claims).toHaveLength(1);
  });
});
