export type Currency = 'USD' | 'EUR' | 'BRL';

export interface SourcingInput {
  cost: number;
  shipping: number;
  fees: number;
  taxes: number;
  cac: number;
  margin: number;
  currency: Currency;
  marketCurrency: Currency;
  provider: string;
  timestamp: string;
}

export interface SourcingOutput {
  status: 'available' | 'unknown' | 'unavailable';
  recommendation?: {
    totalCost: number;
    recommendedPrice: number;
    expectedProfit: number;
    currency: Currency;
    provider: string;
    timestamp: string;
    source: 'estimated' | 'provider';
  };
}

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

  if (input.currency !== input.marketCurrency) {
     return { status: 'unavailable' };
  }

  const now = new Date().getTime();
  const inputTime = new Date(input.timestamp).getTime();

  if (now - inputTime > 1000 * 60 * 60 * 24) { // 24 hours
     return { status: 'unknown' };
  }

  const totalCost = input.cost + input.shipping + input.fees + input.taxes + input.cac;
  // Recommended Price = Total Cost / (1 - Margin) -> Margin as a percentage
  const recommendedPrice = Math.ceil(totalCost / (1 - (input.margin / 100)));
  const expectedProfit = recommendedPrice - totalCost;

  return {
    status: 'available',
    recommendation: {
      totalCost,
      recommendedPrice,
      expectedProfit,
      currency: input.currency,
      provider: input.provider,
      timestamp: input.timestamp,
      source: 'provider',
    },
  };
}
