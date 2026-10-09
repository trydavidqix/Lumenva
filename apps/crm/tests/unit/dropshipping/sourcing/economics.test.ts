import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateEconomics } from '../../../../lib/ecommerce/dropshipping/sourcing/economics';
import type { SourcingInput } from '../../../../lib/ecommerce/dropshipping/sourcing/economics';

describe('Sourcing Economics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const validInput: SourcingInput = {
    cost: 1000,
    shipping: 500,
    fees: 100,
    taxes: 200,
    cac: 1500,
    margin: 20, // 20% margin
    currency: 'USD',
    marketCurrency: 'USD',
    provider: 'AutoDS',
    timestamp: '2026-10-09T09:00:00Z',
  };

  it('calculates economics correctly with valid inputs', () => {
    const result = calculateEconomics(validInput);

    // totalCost: 1000 + 500 + 100 + 200 + 1500 = 3300
    // recommendedPrice: 3300 / (1 - 0.2) = 4125
    // expectedProfit: 4125 - 3300 = 825

    expect(result.status).toBe('available');
    expect(result.recommendation).toBeDefined();
    expect(result.recommendation?.totalCost).toBe(3300);
    expect(result.recommendation?.recommendedPrice).toBe(4125);
    expect(result.recommendation?.expectedProfit).toBe(825);
    expect(result.recommendation?.currency).toBe('USD');
    expect(result.recommendation?.provider).toBe('AutoDS');
    expect(result.recommendation?.source).toBe('provider');
  });

  it('returns unknown if any input is missing', () => {
    const missingCost = { ...validInput };
    // @ts-expect-error testing missing property
    delete missingCost.cost;
    expect(calculateEconomics(missingCost).status).toBe('unknown');

    const missingCurrency = { ...validInput };
    // @ts-expect-error testing missing property
    delete missingCurrency.currency;
    expect(calculateEconomics(missingCurrency).status).toBe('unknown');
  });

  it('returns unavailable if currency and marketCurrency mismatch', () => {
    const mismatchedInput = { ...validInput, marketCurrency: 'EUR' as const };
    expect(calculateEconomics(mismatchedInput).status).toBe('unavailable');
  });

  it('returns unknown if quote is stale (older than 24h)', () => {
    const staleInput = { ...validInput, timestamp: '2026-10-08T09:00:00Z' }; // 25 hours old
    expect(calculateEconomics(staleInput).status).toBe('unknown');
  });
});
