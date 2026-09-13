import { describe, expect, it, vi } from "vitest";
import { StripeCheckoutError, createStripeCheckoutBoundary } from "./stripe-checkout";

const basicPrice = { lookupKey: "lumenva_basic_monthly_eur", unitAmountCents: 2_900, currency: "eur" as const, interval: "month" as const };
const input = { planSlug: "basic", organizationId: "org-1", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel" };
const adapter = (overrides: Record<string, unknown> = {}) => ({ resolvePrice: vi.fn().mockResolvedValue(basicPrice), createCheckoutSession: vi.fn().mockResolvedValue({ sessionId: "cs_test", url: "https://checkout.stripe.test/cs_test" }), ...overrides });

describe("Stripe checkout boundary", () => {
  it("rejects unknown plans before invoking adapter", async () => {
    const a = adapter();
    await expect(createStripeCheckoutBoundary(a).createCheckout({ ...input, planSlug: "enterprise" })).rejects.toMatchObject({ code: "unknown_plan" });
    expect(a.resolvePrice).not.toHaveBeenCalled();
    expect(a.createCheckoutSession).not.toHaveBeenCalled();
  });
  it("resolves and validates canonical Price before creating the session", async () => {
    const a = adapter({ resolvePrice: vi.fn().mockResolvedValue({ ...basicPrice, unitAmountCents: 3_000 }) });
    await expect(createStripeCheckoutBoundary(a).createCheckout(input)).rejects.toMatchObject({ code: "price_mismatch" });
    expect(a.resolvePrice).toHaveBeenCalledWith({ priceLookupKey: basicPrice.lookupKey });
    expect(a.createCheckoutSession).not.toHaveBeenCalled();
  });
  it("passes canonical trial policy and tenant metadata after Price validation", async () => {
    const a = adapter();
    await expect(createStripeCheckoutBoundary(a).createCheckout({ ...input, organizationId: "org-42" })).resolves.toEqual({ sessionId: "cs_test", url: "https://checkout.stripe.test/cs_test" });
    expect(a.createCheckoutSession).toHaveBeenCalledWith({ organizationId: "org-42", priceLookupKey: basicPrice.lookupKey, successUrl: input.successUrl, cancelUrl: input.cancelUrl, trialDays: 14, trialRequiresPaymentMethod: false, metadata: { organization_id: "org-42", plan_slug: "basic" } });
  });
  it("fails closed when Price or checkout adapter is unavailable", async () => {
    const priceDown = adapter({ resolvePrice: vi.fn().mockRejectedValue(new Error("provider down")) });
    await expect(createStripeCheckoutBoundary(priceDown).createCheckout(input)).rejects.toEqual(new StripeCheckoutError("adapter_unavailable", "Stripe price adapter is unavailable"));
    const checkoutDown = adapter({ createCheckoutSession: vi.fn().mockRejectedValue(new Error("provider down")) });
    await expect(createStripeCheckoutBoundary(checkoutDown).createCheckout(input)).rejects.toEqual(new StripeCheckoutError("adapter_unavailable", "Stripe checkout adapter is unavailable"));
  });
  it("cancels at period end without a fee and fails closed when absent", async () => {
    const cancelSubscription = vi.fn().mockResolvedValue({ subscriptionId: "sub_1" });
    await expect(createStripeCheckoutBoundary({ ...adapter(), cancelSubscription }).cancelSubscription({ organizationId: "org-42", subscriptionId: "sub_1" })).resolves.toEqual({ subscriptionId: "sub_1" });
    await expect(createStripeCheckoutBoundary(adapter()).cancelSubscription({ organizationId: "org-1", subscriptionId: "sub-1" })).rejects.toMatchObject({ code: "adapter_unavailable" });
  });
});
