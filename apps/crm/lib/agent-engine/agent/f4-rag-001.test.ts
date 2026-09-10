import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';

vi.mock('@/lib/env', () => ({ env: {} }));

import { searchKnowledge } from './search-knowledge';

describe('F4-RAG-001 caminho mínimo', () => {
  it('produz retrieval determinístico e fail-closed para embedding indisponível', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{ chunk_id: 'chunk-1', knowledge_source_id: 'source-1', content: 'frete grátis', similarity: 0.91, metadata: null }],
      }),
    } as unknown as pg.Pool;
    const embed = vi.fn().mockResolvedValue({ embedding: [0.1, 0.2] });
    const args = { organizationId: 'org-1', kbVersionId: 'kb-1', query: 'frete', topK: 5, threshold: 0.72 };

    const first = await searchKnowledge(pool, args, { embed: embed as never });
    const second = await searchKnowledge(pool, args, { embed: embed as never });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, results: [{ chunk_id: 'chunk-1', similarity: 0.91 }] });

    const unavailable = await searchKnowledge(pool, args, { embed: vi.fn().mockRejectedValue(new Error('provider unavailable')) as never });
    expect(unavailable).toMatchObject({ ok: false, error: { code: 'knowledge_unavailable' } });
  });
});
