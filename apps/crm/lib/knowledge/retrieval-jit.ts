export type KnowledgePrecedence =
  | 'PROJECT_CANONICAL'
  | 'OFFICIAL_VENDOR'
  | 'APPROVED_INTERNAL_DOC'
  | 'derived'
  | 'model';

export interface KnowledgeCard {
  cardId: string;
  claim: string;
  precedence: KnowledgePrecedence;
  confidence: number;
  freshness: 'current' | 'stale' | 'unknown';
}

const precedenceRank: Record<KnowledgePrecedence, number> = {
  PROJECT_CANONICAL: 5,
  OFFICIAL_VENDOR: 4,
  APPROVED_INTERNAL_DOC: 3,
  derived: 2,
  model: 1,
};

const tokenize = (value: string): Set<string> =>
  new Set(value.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]+/gu) ?? []);

export function retrieveJit(query: string, cards: KnowledgeCard[], limit = 8): KnowledgeCard[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be between 3 and 8');
  const boundedLimit = Math.min(8, Math.max(3, limit));
  const queryTokens = tokenize(query);

  return cards
    .map((card, index) => {
      const claimTokens = tokenize(card.claim);
      const matches = [...queryTokens].filter((token) => claimTokens.has(token)).length;
      const relevance = queryTokens.size === 0 ? 0 : matches / queryTokens.size;
      return { card, index, relevance };
    })
    .filter(({ relevance }) => relevance > 0)
    .sort((a, b) =>
      precedenceRank[b.card.precedence] - precedenceRank[a.card.precedence]
      || b.relevance - a.relevance
      || b.card.confidence - a.card.confidence
      || (a.card.freshness === 'current' ? -1 : 0) - (b.card.freshness === 'current' ? -1 : 0)
      || a.index - b.index,
    )
    .slice(0, boundedLimit)
    .map(({ card }) => card);
}
