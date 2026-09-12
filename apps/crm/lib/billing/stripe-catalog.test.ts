import { describe, expect, it } from "vitest";
import {
  STRIPE_CATALOG,
  STRIPE_CHECKOUT_DEFAULTS,
  getStripeCatalogEntry,
} from "./stripe-catalog";

describe("Stripe catalog mapping", () => {
  it("maps canonical plan slugs to EUR monthly Product/Price lookup keys", () => {
    expect(STRIPE_CATALOG).toEqual([
      expect.objectContaining({
        planSlug: "basic",
        monthlyAmountCents: 2900,
        currency: "eur",
        interval: "month",
      }),
      expect.objectContaining({
        planSlug: "medium",
        monthlyAmountCents: 7900,
        currency: "eur",
        interval: "month",
      }),
      expect.objectContaining({
        planSlug: "premium",
        monthlyAmountCents: 19900,
        currency: "eur",
        interval: "month",
      }),
    ]);

    const slugs = STRIPE_CATALOG.map((entry) => entry.planSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const entry of STRIPE_CATALOG) {
      expect(entry.productLookupKey).toBeTruthy();
      expect(entry.monthlyPriceLookupKey).toBeTruthy();
    }
  });

  it("keeps the trial at 14 days without requiring a payment method", () => {
    expect(STRIPE_CHECKOUT_DEFAULTS).toEqual({
      trialDays: 14,
      trialRequiresPaymentMethod: false,
    });
  });

  it("resolves only canonical slugs and fails closed for unknown plans", () => {
    expect(getStripeCatalogEntry("premium")?.monthlyAmountCents).toBe(19900);
    expect(getStripeCatalogEntry("unknown")).toBeUndefined();
  });
});
