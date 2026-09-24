import { describe, it, expect, vi } from "vitest";
import { StripeAdapter } from "./adapter";
import Stripe from "stripe";

vi.mock("stripe");

describe("StripeAdapter", () => {
  it("fails if instantiated without api key", () => {
    expect(() => new StripeAdapter({ apiKey: "" })).toThrow();
  });

  it("createCheckoutSession works with dryRun / fake mode", async () => {
    const adapter = new StripeAdapter({ apiKey: "fake" });
    const result = await adapter.createCheckoutSession(
      { organizationId: "org-1", requestId: "req-1", dryRun: true },
      {
        organizationId: "org-1",
        priceLookupKey: "price_monthly",
        successUrl: "http://success",
        cancelUrl: "http://cancel",
        trialDays: 14,
        trialRequiresPaymentMethod: true,
        metadata: { organization_id: "org-1", plan_slug: "pro" }
      }
    );

    expect(result.sessionId).toBeDefined();
    expect(result.url).toBe("http://success"); // fake mode returns successUrl
    expect(result.price.lookupKey).toBe("price_monthly");
  });

  it("calls Stripe API for createCheckoutSession when not dryRun", async () => {
    const mockList = vi.fn().mockResolvedValue({
      data: [{ id: "price_123", unit_amount: 2000, currency: "usd", recurring: { interval: "month" } }]
    });
    const mockCreate = vi.fn().mockResolvedValue({ id: "cs_123", url: "http://stripe/checkout" });

    // Override the mock instance methods
    vi.mocked(Stripe).mockImplementation(() => ({
      prices: { list: mockList },
      checkout: { sessions: { create: mockCreate } }
    } as unknown as Stripe));

    const adapter = new StripeAdapter({ apiKey: "fake" });
    const result = await adapter.createCheckoutSession(
      { organizationId: "org-1", requestId: "req-1", idempotencyKey: "idem-1" },
      {
        organizationId: "org-1",
        priceLookupKey: "price_monthly",
        successUrl: "http://success",
        cancelUrl: "http://cancel",
        trialDays: 0,
        trialRequiresPaymentMethod: true,
        metadata: { organization_id: "org-1", plan_slug: "pro" }
      }
    );

    expect(mockList).toHaveBeenCalledWith({ lookup_keys: ["price_monthly"] });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      success_url: "http://success",
      cancel_url: "http://cancel",
      client_reference_id: "org-1",
      mode: "subscription"
    }), { idempotencyKey: "idem-1" });
    expect(result.sessionId).toBe("cs_123");
    expect(result.url).toBe("http://stripe/checkout");
  });

  it("calls Stripe API for cancelSubscription when not dryRun", async () => {
    const mockUpdate = vi.fn().mockResolvedValue({ id: "sub_123" });
    vi.mocked(Stripe).mockImplementation(() => ({
      subscriptions: { update: mockUpdate }
    } as unknown as Stripe));

    const adapter = new StripeAdapter({ apiKey: "fake" });
    await adapter.cancelSubscription(
      { organizationId: "org-1", requestId: "req-1", idempotencyKey: "idem-2" },
      { organizationId: "org-1", subscriptionId: "sub_123", cancelAtPeriodEnd: true, applyCancellationFee: false }
    );

    expect(mockUpdate).toHaveBeenCalledWith("sub_123", { cancel_at_period_end: true }, { idempotencyKey: "idem-2" });
  });

  it("throws standard error on Stripe timeout or failure", async () => {
    const mockList = vi.fn().mockRejectedValue(new Error("Stripe timeout"));
    vi.mocked(Stripe).mockImplementation(() => ({
      prices: { list: mockList }
    } as unknown as Stripe));

    const adapter = new StripeAdapter({ apiKey: "fake" });
    await expect(adapter.createCheckoutSession(
      { organizationId: "org-1", requestId: "req-1" },
      {
        organizationId: "org-1",
        priceLookupKey: "price_monthly",
        successUrl: "http://success",
        cancelUrl: "http://cancel",
        trialDays: 0,
        trialRequiresPaymentMethod: true,
        metadata: { organization_id: "org-1", plan_slug: "pro" }
      }
    )).rejects.toThrow("Stripe API Error: Stripe timeout");
  });
});
