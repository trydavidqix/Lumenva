const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MARKET_RE = /^[A-Za-z]{2}$/;
const LANGUAGE_RE = /^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$/;

export const creatorStatuses = ["draft", "active", "paused", "archived"] as const;
export const productStatuses = ["discovered", "shortlisted", "active", "paused", "archived"] as const;
export const offerStatuses = ["draft", "active", "paused", "expired", "archived"] as const;
export const campaignStatuses = ["draft", "active", "paused", "completed", "archived"] as const;
export const creativeVariantStatuses = ["draft", "approved", "active", "retired"] as const;

export type CreatorStatus = (typeof creatorStatuses)[number];
export type CommerceProductStatus = (typeof productStatuses)[number];
export type OfferStatus = (typeof offerStatuses)[number];
export type CampaignStatus = (typeof campaignStatuses)[number];
export type CreativeVariantStatus = (typeof creativeVariantStatuses)[number];

export type CreatorProfileRef = Readonly<{ organizationId: string; id: string }>;
export type CommerceProductRef = Readonly<{ organizationId: string; id: string }>;
export type OfferRef = Readonly<{ organizationId: string; id: string }>;
export type CampaignRef = Readonly<{ organizationId: string; id: string }>;
export type CreativeVariantRef = Readonly<{ organizationId: string; id: string }>;
export type CommerceContentRef = Readonly<{ organizationId: string; id: string }>;

export type AttributionDimensions = Readonly<{
  organizationId: string;
  creatorId: string | null;
  productId: string | null;
  offerId: string | null;
  campaignId: string | null;
  creativeVariantId: string | null;
  contentId: string | null;
}>;

export type AttributionDimensionInput = {
  organizationId: string;
  creatorId?: string | null;
  productId?: string | null;
  offerId?: string | null;
  campaignId?: string | null;
  creativeVariantId?: string | null;
  contentId?: string | null;
};

function requireUuid(value: string, field: string): string {
  const normalized = value.trim();
  if (!UUID_RE.test(normalized)) {
    throw new Error(`${field} must be a UUID`);
  }
  return normalized.toLowerCase();
}

function optionalUuid(value: string | null | undefined, field: string): string | null {
  return value == null ? null : requireUuid(value, field);
}

function createRef(input: { organizationId: string; id: string }): Readonly<{ organizationId: string; id: string }> {
  return Object.freeze({
    organizationId: requireUuid(input.organizationId, "organizationId"),
    id: requireUuid(input.id, "id"),
  });
}

export function creatorProfileRef(input: { organizationId: string; id: string }): CreatorProfileRef {
  return createRef(input);
}

export function commerceProductRef(input: { organizationId: string; id: string }): CommerceProductRef {
  return createRef(input);
}

export function offerRef(input: { organizationId: string; id: string }): OfferRef {
  return createRef(input);
}

export function commerceCampaignRef(input: { organizationId: string; id: string }): CampaignRef {
  return createRef(input);
}

export function creativeVariantRef(input: { organizationId: string; id: string }): CreativeVariantRef {
  return createRef(input);
}

export function commerceContentRef(input: { organizationId: string; id: string }): CommerceContentRef {
  return createRef(input);
}

export function normalizeMarket(value: string): string {
  const normalized = value.trim();
  if (!MARKET_RE.test(normalized)) {
    throw new Error("market must be an ISO 3166-1 alpha-2 country code");
  }
  return normalized.toUpperCase();
}

export function normalizeLanguage(value: string): string {
  const normalized = value.trim();
  if (!LANGUAGE_RE.test(normalized)) {
    throw new Error("language must be a BCP 47 language or language-region code");
  }
  const [language, region] = normalized.split("-");
  return region ? `${language.toLowerCase()}-${region.toUpperCase()}` : language.toLowerCase();
}

export function createAttributionDimensions(input: AttributionDimensionInput): AttributionDimensions {
  return Object.freeze({
    organizationId: requireUuid(input.organizationId, "organizationId"),
    creatorId: optionalUuid(input.creatorId, "creatorId"),
    productId: optionalUuid(input.productId, "productId"),
    offerId: optionalUuid(input.offerId, "offerId"),
    campaignId: optionalUuid(input.campaignId, "campaignId"),
    creativeVariantId: optionalUuid(input.creativeVariantId, "creativeVariantId"),
    contentId: optionalUuid(input.contentId, "contentId"),
  });
}
