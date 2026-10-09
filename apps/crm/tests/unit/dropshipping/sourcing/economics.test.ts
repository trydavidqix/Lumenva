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
    source: 'estimated', // Ensure manual input is not labelled as real provider
  };

  it('calculates economics correctly with valid inputs', () => {
    const result = calculateEconomics(validInput);

    expect(result.status).toBe('available');
    expect(result.recommendation).toBeDefined();
    expect(result.recommendation?.totalCost).toBe(3300);
    expect(result.recommendation?.recommendedPrice).toBe(4125);
    expect(result.recommendation?.expectedProfit).toBe(825);
    expect(result.recommendation?.currency).toBe('USD');
    expect(result.recommendation?.provider).toBe('AutoDS');
    expect(result.recommendation?.source).toBe('estimated');
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
    const mismatchedInput = { ...validInput, currency: 'GBP', marketCurrency: 'EUR' };
    expect(calculateEconomics(mismatchedInput).status).toBe('unavailable');
  });

  it('returns unknown if quote is stale (older than 24h)', () => {
    const staleInput = { ...validInput, timestamp: '2026-10-08T09:00:00Z' }; // 25 hours old
    expect(calculateEconomics(staleInput).status).toBe('unknown');
  });

  it('returns unknown for invalid numeric amounts (negative, NaN, Infinity)', () => {
    expect(calculateEconomics({ ...validInput, cost: -100 }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, shipping: NaN }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, fees: Infinity }).status).toBe('unknown');
  });

  it('returns unknown for invalid margins (<= 0 or >= 100)', () => {
    expect(calculateEconomics({ ...validInput, margin: 0 }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, margin: -10 }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, margin: 100 }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, margin: 150 }).status).toBe('unknown');
  });

  it('returns unknown for empty or whitespace provider', () => {
    expect(calculateEconomics({ ...validInput, provider: '' }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, provider: '   ' }).status).toBe('unknown');
  });

  it('returns unknown for invalid ISO currency format', () => {
    expect(calculateEconomics({ ...validInput, currency: 'US', marketCurrency: 'US' }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, currency: 'EURO', marketCurrency: 'EURO' }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, currency: 'usd', marketCurrency: 'usd' }).status).toBe('unknown');
  });

  it('returns unknown for invalid or future timestamps', () => {
    expect(calculateEconomics({ ...validInput, timestamp: 'invalid-date' }).status).toBe('unknown');
    expect(calculateEconomics({ ...validInput, timestamp: '2026-10-10T10:00:00Z' }).status).toBe('unknown'); // Future
  });

  it('preserves the provided source explicitly', () => {
    const realQuote = { ...validInput, source: 'provider' as const };
    const result = calculateEconomics(realQuote);
    expect(result.status).toBe('available');
    expect(result.recommendation?.source).toBe('provider');
  });
});
