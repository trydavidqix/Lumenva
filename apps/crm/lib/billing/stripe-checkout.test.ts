import { describe, expect, it, vi } from "vitest";
import { StripeCheckoutError, createStripeCheckoutBoundary } from "./stripe-checkout";

const basicPrice = { lookupKey: "lumenva_basic_monthly_eur", unitAmountCents: 2_900, currency: "eur" as const, interval: "month" as const };

describe("Stripe checkout boundary", () => {
  it("rejects unknown plans before invoking adapter", async () => {
    const create = vi.fn();
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession: create });
    await expect(boundary.createCheckout({ planSlug: "enterprise", organizationId: "org-1", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel" })).rejects.toMatchObject({ code: "unknown_plan" });
    expect(create).not.toHaveBeenCalled();
  });
  it("fails closed on divergent price", async () => {
    const createCheckoutSession = vi.fn().mockResolvedValue({ sessionId: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1", price: { ...basicPrice, unitAmountCents: 3_000 } });
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession });
    await expect(boundary.createCheckout({ planSlug: "basic", organizationId: "org-1", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel" })).rejects.toMatchObject({ code: "price_mismatch" });
  });
  it("passes canonical trial policy and organization metadata", async () => {
    const createCheckoutSession = vi.fn().mockResolvedValue({ sessionId: "cs_test_2", url: "https://checkout.stripe.test/cs_test_2", price: basicPrice });
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession });
    await expect(boundary.createCheckout({ planSlug: "basic", organizationId: "org-42", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel" })).resolves.toEqual({ sessionId: "cs_test_2", url: "https://checkout.stripe.test/cs_test_2" });
    expect(createCheckoutSession).toHaveBeenCalledWith({ organizationId: "org-42", priceLookupKey: "lumenva_basic_monthly_eur", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel", trialDays: 14, trialRequiresPaymentMethod: false, metadata: { organization_id: "org-42", plan_slug: "basic" } });
  });
  it("cancels at period end without a fee", async () => {
    const cancelSubscription = vi.fn().mockResolvedValue({ subscriptionId: "sub_1" });
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession: vi.fn(), cancelSubscription });
    await expect(boundary.cancelSubscription({ organizationId: "org-42", subscriptionId: "sub_1" })).resolves.toEqual({ subscriptionId: "sub_1" });
    expect(cancelSubscription).toHaveBeenCalledWith({ organizationId: "org-42", subscriptionId: "sub_1", cancelAtPeriodEnd: true, applyCancellationFee: false });
  });
  it("fails closed when cancellation adapter is absent", async () => {
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession: vi.fn() });
    await expect(boundary.cancelSubscription({ organizationId: "org-1", subscriptionId: "sub-1" })).rejects.toEqual(new StripeCheckoutError("adapter_unavailable", "Stripe subscription adapter is not configured"));
  });
});
