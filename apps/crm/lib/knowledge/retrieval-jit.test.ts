import { describe, expect, it } from 'vitest';

import { retrieveJit, type KnowledgeCard } from './retrieval-jit';

const card = (id: string, precedence: KnowledgeCard['precedence'], claim: string): KnowledgeCard => ({
  cardId: id,
  claim,
  precedence,
  confidence: 0.9,
  freshness: 'current',
});

describe('retrieveJit', () => {
  it('returns 3 to 8 relevant cards ordered by precedence before lexical relevance', () => {
    const cards = [
      card('derived', 'derived', 'frete e entrega'),
      card('vendor', 'OFFICIAL_VENDOR', 'frete e entrega'),
      card('canonical', 'PROJECT_CANONICAL', 'frete e entrega'),
      card('internal', 'APPROVED_INTERNAL_DOC', 'frete e entrega'),
      card('irrelevant', 'PROJECT_CANONICAL', 'política de férias'),
    ];

    expect(retrieveJit('frete entrega', cards)).toEqual([
      cards[2], cards[1], cards[3], cards[0],
    ]);
  });

  it('clamps requested limits to the safe 3-8 range and rejects invalid limits', () => {
    const cards = Array.from({ length: 10 }, (_, i) => card(`c${i}`, 'PROJECT_CANONICAL', `frete ${i}`));
    expect(retrieveJit('frete', cards, 1)).toHaveLength(3);
    expect(retrieveJit('frete', cards, 20)).toHaveLength(8);
    expect(() => retrieveJit('frete', cards, 0)).toThrow('limit must be between 3 and 8');
  });
});
