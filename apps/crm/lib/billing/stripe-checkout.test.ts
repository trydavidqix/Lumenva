import { describe, expect, it, vi } from "vitest";
import { StripeCheckoutError, createStripeCheckoutBoundary } from "./stripe-checkout";

const basicPrice = { lookupKey: "lumenva_basic_monthly_eur", unitAmountCents: 2_900, currency: "eur" as const, interval: "month" as const };
const input = { planSlug: "basic", organizationId: "org-1", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel" };

describe("Stripe checkout boundary", () => {
  it("rejects unknown plans before invoking adapter", async () => {
    const create = vi.fn();
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession: create });
    await expect(boundary.createCheckout({ ...input, planSlug: "enterprise" })).rejects.toMatchObject({ code: "unknown_plan" });
    expect(create).not.toHaveBeenCalled();
  });
  it("requires a server-resolved tenant", async () => {
    const create = vi.fn();
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession: create });
    await expect(boundary.createCheckout({ ...input, organizationId: "   " })).rejects.toMatchObject({ code: "invalid_tenant" });
    expect(create).not.toHaveBeenCalled();
  });
  it("fails closed on divergent price", async () => {
    const createCheckoutSession = vi.fn().mockResolvedValue({ sessionId: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1", price: { ...basicPrice, unitAmountCents: 3_000 } });
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession });
    await expect(boundary.createCheckout(input)).rejects.toMatchObject({ code: "price_mismatch" });
  });
  it("passes canonical trial policy and organization metadata", async () => {
    const createCheckoutSession = vi.fn().mockResolvedValue({ sessionId: "cs_test_2", url: "https://checkout.stripe.test/cs_test_2", price: basicPrice });
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession });
    await expect(boundary.createCheckout({ ...input, organizationId: "org-42" })).resolves.toEqual({ sessionId: "cs_test_2", url: "https://checkout.stripe.test/cs_test_2" });
    expect(createCheckoutSession).toHaveBeenCalledWith({ organizationId: "org-42", priceLookupKey: "lumenva_basic_monthly_eur", successUrl: input.successUrl, cancelUrl: input.cancelUrl, trialDays: 14, trialRequiresPaymentMethod: false, metadata: { organization_id: "org-42", plan_slug: "basic" } });
  });
  it("fails closed when checkout adapter or response is unavailable", async () => {
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession: vi.fn().mockRejectedValue(new Error("provider down")) });
    await expect(boundary.createCheckout(input)).rejects.toEqual(new StripeCheckoutError("adapter_unavailable", "Stripe checkout adapter is unavailable"));
    const incomplete = createStripeCheckoutBoundary({ createCheckoutSession: vi.fn().mockResolvedValue({ sessionId: "", url: "", price: basicPrice }) });
    await expect(incomplete.createCheckout(input)).rejects.toMatchObject({ code: "adapter_unavailable" });
  });
  it("cancels at period end without a fee", async () => {
    const cancelSubscription = vi.fn().mockResolvedValue({ subscriptionId: "sub_1" });
    const boundary = createStripeCheckoutBoundary({ createCheckoutSession: vi.fn(), cancelSubscription });
    await expect(boundary.cancelSubscription({ organizationId: "org-42", subscriptionId: "sub_1" })).resolves.toEqual({ subscriptionId: "sub_1" });
    expect(cancelSubscription).toHaveBeenCalledWith({ organizationId: "org-42", subscriptionId: "sub_1", cancelAtPeriodEnd: true, applyCancellationFee: false });
  });
  it("fails closed when cancellation adapter is absent or unavailable", async () => {
    const absent = createStripeCheckoutBoundary({ createCheckoutSession: vi.fn() });
    await expect(absent.cancelSubscription({ organizationId: "org-1", subscriptionId: "sub-1" })).rejects.toEqual(new StripeCheckoutError("adapter_unavailable", "Stripe subscription adapter is not configured"));
    const unavailable = createStripeCheckoutBoundary({ createCheckoutSession: vi.fn(), cancelSubscription: vi.fn().mockRejectedValue(new Error("provider down")) });
    await expect(unavailable.cancelSubscription({ organizationId: "org-1", subscriptionId: "sub-1" })).rejects.toMatchObject({ code: "adapter_unavailable" });
  });
});
