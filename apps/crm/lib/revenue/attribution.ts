export interface AttributionCandidate {
  id: string;
  organizationId: string;
  clickId?: string;
  subId?: string;
  providerConversionId?: string;
  utm?: Record<string, string>;
  contentId?: string;
  creatorId?: string;
  productId?: string;
  offerId?: string;
  campaignId?: string;
  variantId?: string;
  evidenceRefs: string[];
}

export interface AttributionInput {
  organizationId: string;
  conversionId: string;
  clickId?: string;
  subId?: string;
  providerConversionId?: string;
  utm?: Record<string, string>;
  candidates: AttributionCandidate[];
}

export interface AttributionResult {
  conversionId: string;
  candidateId: string | null;
  model: "exact_identifier" | "utm" | "unattributed";
  confidence: number;
  evidenceRefs: string[];
  dimensions: Partial<Pick<AttributionCandidate, "contentId" | "creatorId" | "productId" | "offerId" | "campaignId" | "variantId">>;
  touches: Array<{ candidateId: string; model: "exact_identifier" | "utm"; evidenceRefs: string[] }>;
}

function utmMatches(a?: Record<string, string>, b?: Record<string, string>): boolean {
  if (!a || !b) return false;
  const keys = Object.keys(a);
  return keys.length > 0 && keys.every((key) => a[key] === b[key]);
}

export function attributeConversion(input: AttributionInput): AttributionResult[] {
  const candidates = input.candidates.filter((candidate) => candidate.organizationId === input.organizationId);
  const touches: AttributionResult["touches"] = [];

  for (const candidate of candidates) {
    const clickMatch = Boolean(input.clickId && candidate.clickId === input.clickId);
    const subMatch = Boolean(input.subId && candidate.subId === input.subId);
    const providerMatch = Boolean(input.providerConversionId && candidate.providerConversionId === input.providerConversionId);
    if (clickMatch || subMatch || providerMatch) {
      touches.push({ candidateId: candidate.id, model: "exact_identifier", evidenceRefs: [...candidate.evidenceRefs] });
    } else if (utmMatches(input.utm, candidate.utm)) {
      touches.push({ candidateId: candidate.id, model: "utm", evidenceRefs: [...candidate.evidenceRefs] });
    }
  }

  touches.sort((a, b) => (a.model === b.model ? a.candidateId.localeCompare(b.candidateId) : a.model === "exact_identifier" ? -1 : 1));
  const primary = touches[0];
  if (!primary) {
    return [{ conversionId: input.conversionId, candidateId: null, model: "unattributed", confidence: 0, evidenceRefs: [], dimensions: {}, touches: [] }];
  }
  const source = candidates.find((candidate) => candidate.id === primary.candidateId)!;
  return [{
    conversionId: input.conversionId,
    candidateId: source.id,
    model: primary.model,
    confidence: primary.model === "exact_identifier" ? 1 : 0.65,
    evidenceRefs: [...source.evidenceRefs],
    dimensions: {
      contentId: source.contentId,
      creatorId: source.creatorId,
      productId: source.productId,
      offerId: source.offerId,
      campaignId: source.campaignId,
      variantId: source.variantId,
    },
    touches,
  }];
}
