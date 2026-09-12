import { describe, expect, it } from "vitest";
import { parseStripeListJson, verifyStripeCatalog } from "./stripe-cli-contract";
const expected = [{ planSlug: "basic", productLookupKey: "lumenva_basic", priceLookupKey: "lumenva_basic_monthly_eur", amountCents: 2900, currency: "eur", interval: "month" }] as const;
describe("Stripe CLI contract parser", () => {
 it("parses canonical fields", () => expect(verifyStripeCatalog(JSON.stringify({data:[{lookup_key:"lumenva_basic"}]}), JSON.stringify({data:[{lookup_key:"lumenva_basic_monthly_eur",currency:"eur",unit_amount:2900,recurring:{interval:"month"}}]}), expected).ok).toBe(true));
 it("fails closed", () => { expect(() => parseStripeListJson("nope","prices")).toThrow("not valid JSON"); expect(verifyStripeCatalog(JSON.stringify({data:[]}),JSON.stringify({data:[]}),expected).errors).toHaveLength(2); });
});
