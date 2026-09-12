/** Provider operations stay behind the official Stripe CLI/MCP boundary. */
export type StripeCatalogEntry = {
  readonly planSlug: string;
  readonly productLookupKey: string;
  readonly monthlyPriceLookupKey: string;
  readonly monthlyAmountCents: number;
  readonly currency: "eur";
  readonly interval: "month";
};

export const STRIPE_CATALOG = [
  { planSlug: "basic", productLookupKey: "lumenva_basic", monthlyPriceLookupKey: "lumenva_basic_monthly_eur", monthlyAmountCents: 2_900, currency: "eur", interval: "month" },
  { planSlug: "medium", productLookupKey: "lumenva_medium", monthlyPriceLookupKey: "lumenva_medium_monthly_eur", monthlyAmountCents: 7_900, currency: "eur", interval: "month" },
  { planSlug: "premium", productLookupKey: "lumenva_premium", monthlyPriceLookupKey: "lumenva_premium_monthly_eur", monthlyAmountCents: 19_900, currency: "eur", interval: "month" },
] as const satisfies readonly StripeCatalogEntry[];

export const STRIPE_CHECKOUT_DEFAULTS = { trialDays: 14, trialRequiresPaymentMethod: false } as const;

export function getStripeCatalogEntry(planSlug: string): StripeCatalogEntry | undefined {
  return STRIPE_CATALOG.find((entry) => entry.planSlug === planSlug);
}
