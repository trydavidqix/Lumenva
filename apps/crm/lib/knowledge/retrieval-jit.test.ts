import { describe, expect, it } from 'vitest';

import { redactKnowledgeCard, retrieveJit, type KnowledgeCard } from './retrieval-jit';

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

describe('redactKnowledgeCard', () => {
  it('masks email, phone and CPF before the card reaches the consumer', () => {
    const sensitive = 'Contacte ana.silva@example.com ou +351 912 345 678; CPF 123.456.789-09.';
    const result = redactKnowledgeCard(card('sensitive', 'PROJECT_CANONICAL', sensitive));

    expect(result.claim).toContain('[EMAIL_REDACTED]');
    expect(result.claim).toContain('[PHONE_REDACTED]');
    expect(result.claim).toContain('[CPF_REDACTED]');
    expect(result.claim).not.toContain('ana.silva@example.com');
    expect(result.claim).not.toContain('+351 912 345 678');
    expect(result.claim).not.toContain('123.456.789-09');
    expect(result.cardId).toBe('sensitive');
  });
});
