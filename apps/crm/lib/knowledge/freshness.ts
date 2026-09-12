export type FreshnessState = 'current' | 'stale' | 'unknown';

export interface FreshnessCard {
  cardId: string;
  freshness: FreshnessState;
  reviewedAt?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Marks cards stale when their last successful revalidation exceeds maxAgeDays. */
export function checkFreshness<T extends FreshnessCard>(
  card: T,
  now: Date,
  maxAgeDays: number,
): T {
  if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0) {
    throw new Error('maxAgeDays must be a non-negative finite number');
  }
  const reviewedAt = card.reviewedAt === undefined ? NaN : Date.parse(card.reviewedAt);
  const isFresh = Number.isFinite(reviewedAt)
    && Number.isFinite(now.getTime())
    && now.getTime() - reviewedAt < maxAgeDays * DAY_MS;
  return { ...card, freshness: isFresh ? 'current' : 'stale' };
}
