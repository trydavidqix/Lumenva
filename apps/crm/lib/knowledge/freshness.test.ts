import { describe, expect, it } from 'vitest';

import { checkFreshness, type FreshnessCard } from './freshness';

const card = (reviewedAt?: string): FreshnessCard => ({
  cardId: 'card-1',
  freshness: 'current',
  ...(reviewedAt === undefined ? {} : { reviewedAt }),
});

describe('checkFreshness', () => {
  const now = new Date('2026-09-12T12:00:00.000Z');

  it('keeps a card current when it was revalidated within the age limit', () => {
    expect(checkFreshness(card('2026-09-10T12:00:00.000Z'), now, 3).freshness).toBe('current');
  });

  it('marks a card stale after the configured number of days without revalidation', () => {
    expect(checkFreshness(card('2026-09-08T11:59:59.999Z'), now, 4).freshness).toBe('stale');
  });

  it('marks a card without a valid revalidation timestamp stale conservatively', () => {
    expect(checkFreshness(card(), now, 30).freshness).toBe('stale');
    expect(checkFreshness(card('not-a-date'), now, 30).freshness).toBe('stale');
  });
});
