export type SourcingSource = 'estimated' | 'provider';

export interface VerifiedQuoteEvidence {
  _type: 'VerifiedProviderQuote';
  provider: string;
  signature?: string;
}

export interface SourcingInput {
  cost: number;
  shipping: number;
  fees: number;
  taxes: number;
  cac: number;
  margin: number;
  currency: string;
  marketCurrency: string;
  provider: string;
  timestamp: string;
  evidence?: VerifiedQuoteEvidence;
}

export interface SourcingOutput {
  status: 'available' | 'unknown' | 'unavailable';
  recommendation?: {
    totalCost: number;
    recommendedPrice: number;
    expectedProfit: number;
    currency: string;
    provider: string;
    timestamp: string;
    source: SourcingSource;
  };
}

const isValidCurrency = (curr: unknown): boolean => typeof curr === 'string' && /^[A-Z]{3}$/.test(curr);
const isValidAmount = (val: unknown): boolean => typeof val === 'number' && Number.isFinite(val) && !Number.isNaN(val) && val >= 0;

export function calculateEconomics(input: Partial<SourcingInput>): SourcingOutput {
  if (
    input.cost === undefined ||
    input.shipping === undefined ||
    input.fees === undefined ||
    input.taxes === undefined ||
    input.cac === undefined ||
    input.margin === undefined ||
    input.currency === undefined ||
    input.marketCurrency === undefined ||
    input.provider === undefined ||
    input.timestamp === undefined
  ) {
    return { status: 'unknown' };
  }

  // Validate negative, NaN, Infinity inputs
  if (
    !isValidAmount(input.cost) ||
    !isValidAmount(input.shipping) ||
    !isValidAmount(input.fees) ||
    !isValidAmount(input.taxes) ||
    !isValidAmount(input.cac)
  ) {
    return { status: 'unknown' };
  }

  // Validate margin bounds (exclusive 0 and 100)
  if (typeof input.margin !== 'number' || Number.isNaN(input.margin) || !Number.isFinite(input.margin) || input.margin <= 0 || input.margin >= 100) {
    return { status: 'unknown' };
  }

  // Validate provider
  if (typeof input.provider !== 'string' || input.provider.trim() === '') {
     return { status: 'unknown' };
  }

  // Currency configurable and validation
  if (!isValidCurrency(input.currency) || !isValidCurrency(input.marketCurrency)) {
     return { status: 'unknown' };
  }
  if (input.currency !== input.marketCurrency) {
     return { status: 'unavailable' };
  }

  // Parse Timestamp and Validate Date correctness and staleness
  const inputTime = Date.parse(input.timestamp);
  if (Number.isNaN(inputTime)) {
    return { status: 'unknown' };
  }

  const now = new Date().getTime();

  if (inputTime > now) {
     return { status: 'unknown' }; // Future timestamp is invalid
  }

  if (now - inputTime > 1000 * 60 * 60 * 24) { // 24 hours stale check
     return { status: 'unknown' };
  }

  const totalCost = input.cost + input.shipping + input.fees + input.taxes + input.cac;
  // Recommended Price = Total Cost / (1 - Margin) -> Margin as a percentage
  const recommendedPrice = Math.ceil(totalCost / (1 - (input.margin / 100)));
  const expectedProfit = recommendedPrice - totalCost;

  // Determine Source (Provenance): only validate 'provider' if a concrete evidence contract is passed
  let finalSource: SourcingSource = 'estimated';
  if (
    input.evidence !== undefined &&
    input.evidence !== null &&
    typeof input.evidence === 'object' &&
    input.evidence._type === 'VerifiedProviderQuote' &&
    input.evidence.provider === input.provider
  ) {
    finalSource = 'provider';
  }

  return {
    status: 'available',
    recommendation: {
      totalCost,
      recommendedPrice,
      expectedProfit,
      currency: input.currency,
      provider: input.provider,
      timestamp: input.timestamp,
      source: finalSource,
    },
  };
}
