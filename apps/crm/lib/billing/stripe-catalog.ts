/**
 * Provider-free Stripe catalog boundary.
 *
 * The database catalog (plans/modules/plan_modules) remains the source of
 * plan identity. This file only maps those canonical slugs to Stripe
 * lookup keys and checkout-safe commercial parameters; it never creates
 * products/prices or stores provider credentials.
 * Products, Prices, webhooks and Checkout are operated only through the
 * official Stripe CLI/MCP boundary in a separately authorized operation.
 */
export type StripeCatalogEntry = {
  readonly planSlug: string;
  readonly productLookupKey: string;
  readonly monthlyPriceLookupKey: string;
  readonly monthlyAmountCents: number;
  readonly currency: "eur";
  readonly interval: "month";
};

export const STRIPE_CATALOG = [
  {
    planSlug: "basic",
    productLookupKey: "lumenva_basic",
    monthlyPriceLookupKey: "lumenva_basic_monthly_eur",
    monthlyAmountCents: 2_900,
    currency: "eur",
    interval: "month",
  },
  {
    planSlug: "medium",
    productLookupKey: "lumenva_medium",
    monthlyPriceLookupKey: "lumenva_medium_monthly_eur",
    monthlyAmountCents: 7_900,
    currency: "eur",
    interval: "month",
  },
  {
    planSlug: "premium",
    productLookupKey: "lumenva_premium",
    monthlyPriceLookupKey: "lumenva_premium_monthly_eur",
    monthlyAmountCents: 19_900,
    currency: "eur",
    interval: "month",
  },
] as const satisfies readonly StripeCatalogEntry[];

export const STRIPE_CHECKOUT_DEFAULTS = {
  trialDays: 14,
  trialRequiresPaymentMethod: false,
} as const;

export function getStripeCatalogEntry(planSlug: string): StripeCatalogEntry | undefined {
  return STRIPE_CATALOG.find((entry) => entry.planSlug === planSlug);
}
