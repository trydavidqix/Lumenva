import { getStripeCatalogEntry, STRIPE_CHECKOUT_DEFAULTS, type StripeCatalogEntry } from "./stripe-catalog";

export class StripeCheckoutError extends Error {
  constructor(readonly code: "unknown_plan" | "price_mismatch" | "adapter_unavailable", message: string) {
    super(message);
    this.name = "StripeCheckoutError";
  }
}

type RuntimePrice = { lookupKey: string; unitAmountCents: number; currency: string; interval: string };
type CreateInput = { organizationId: string; priceLookupKey: string; successUrl: string; cancelUrl: string; trialDays: number; trialRequiresPaymentMethod: boolean; metadata: { organization_id: string; plan_slug: string } };
export type StripeCheckoutAdapter = {
  resolvePrice(input: { priceLookupKey: string }): Promise<RuntimePrice>;
  createCheckoutSession(input: CreateInput): Promise<{ sessionId: string; url: string }>;
  cancelSubscription?(input: { organizationId: string; subscriptionId: string; cancelAtPeriodEnd: true; applyCancellationFee: false }): Promise<{ subscriptionId: string }>;
};

export function createStripeCheckoutBoundary(adapter: StripeCheckoutAdapter) {
  return {
    async createCheckout(input: { planSlug: string; organizationId: string; successUrl: string; cancelUrl: string }) {
      const entry = getStripeCatalogEntry(input.planSlug);
      if (!entry) throw new StripeCheckoutError("unknown_plan", `Unknown Stripe plan: ${input.planSlug}`);
      let price: RuntimePrice;
      try {
        price = await adapter.resolvePrice({ priceLookupKey: entry.monthlyPriceLookupKey });
      } catch {
        throw new StripeCheckoutError("adapter_unavailable", "Stripe price adapter is unavailable");
      }
      assertCanonicalPrice(entry, price);
      try {
        return await adapter.createCheckoutSession({
          organizationId: input.organizationId,
          priceLookupKey: entry.monthlyPriceLookupKey,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          ...STRIPE_CHECKOUT_DEFAULTS,
          metadata: { organization_id: input.organizationId, plan_slug: entry.planSlug },
        });
      } catch {
        throw new StripeCheckoutError("adapter_unavailable", "Stripe checkout adapter is unavailable");
      }
    },
    async cancelSubscription(input: { organizationId: string; subscriptionId: string }) {
      if (!adapter.cancelSubscription) throw new StripeCheckoutError("adapter_unavailable", "Stripe subscription adapter is not configured");
      try {
        return await adapter.cancelSubscription({ ...input, cancelAtPeriodEnd: true, applyCancellationFee: false });
      } catch {
        throw new StripeCheckoutError("adapter_unavailable", "Stripe subscription adapter is unavailable");
      }
    },
  };
}

function assertCanonicalPrice(entry: StripeCatalogEntry, price: RuntimePrice): void {
  if (price.lookupKey !== entry.monthlyPriceLookupKey || price.unitAmountCents !== entry.monthlyAmountCents || price.currency !== entry.currency || price.interval !== entry.interval) {
    throw new StripeCheckoutError("price_mismatch", `Stripe price does not match canonical plan: ${entry.planSlug}`);
  }
}
