import { describe, expect, it } from "vitest";

import {
  commerceCampaignRef,
  commerceContentRef,
  commerceProductRef,
  createAttributionDimensions,
  creativeVariantRef,
  creatorProfileRef,
  normalizeLanguage,
  normalizeMarket,
  offerRef,
} from "./contracts";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const CREATOR_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
const OFFER_ID = "44444444-4444-4444-8444-444444444444";
const CAMPAIGN_ID = "55555555-5555-4555-8555-555555555555";
const VARIANT_ID = "66666666-6666-4666-8666-666666666666";
const CONTENT_ID = "77777777-7777-4777-8777-777777777777";

describe("creator commerce contracts", () => {
  it("rejects missing tenant identity", () => {
    expect(() => creatorProfileRef({ organizationId: "", id: CREATOR_ID })).toThrow(
      /organizationId/i,
    );
  });

  it("rejects malformed domain identifiers", () => {
    expect(() => commerceProductRef({ organizationId: ORG_ID, id: "product-1" })).toThrow(
      /id/i,
    );
    expect(() => offerRef({ organizationId: ORG_ID, id: "not-a-uuid" })).toThrow(/id/i);
    expect(() => commerceCampaignRef({ organizationId: ORG_ID, id: "bad" })).toThrow(/id/i);
    expect(() => creativeVariantRef({ organizationId: ORG_ID, id: "bad" })).toThrow(/id/i);
    expect(() => commerceContentRef({ organizationId: ORG_ID, id: "bad" })).toThrow(/id/i);
  });

  it("creates tenant-scoped provider-neutral references", () => {
    expect(creatorProfileRef({ organizationId: ORG_ID, id: CREATOR_ID })).toEqual({
      organizationId: ORG_ID,
      id: CREATOR_ID,
    });
    expect(commerceProductRef({ organizationId: ORG_ID, id: PRODUCT_ID })).toEqual({
      organizationId: ORG_ID,
      id: PRODUCT_ID,
    });
  });

  it("normalizes market and language without provider-specific values", () => {
    expect(normalizeMarket(" pt ")).toBe("PT");
    expect(normalizeLanguage("pt-pt")).toBe("pt-PT");
    expect(() => normalizeMarket("portugal")).toThrow(/market/i);
    expect(() => normalizeLanguage("portuguese")).toThrow(/language/i);
  });

  it("builds a stable attribution dimension object", () => {
    const input = {
      organizationId: ORG_ID,
      creatorId: CREATOR_ID,
      productId: PRODUCT_ID,
      offerId: OFFER_ID,
      campaignId: CAMPAIGN_ID,
      creativeVariantId: VARIANT_ID,
      contentId: CONTENT_ID,
    };

    expect(createAttributionDimensions(input)).toEqual({
      organizationId: ORG_ID,
      creatorId: CREATOR_ID,
      productId: PRODUCT_ID,
      offerId: OFFER_ID,
      campaignId: CAMPAIGN_ID,
      creativeVariantId: VARIANT_ID,
      contentId: CONTENT_ID,
    });
    expect(createAttributionDimensions({ ...input })).toEqual(createAttributionDimensions(input));
  });
});
