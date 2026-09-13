import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';

vi.mock('@/lib/env', () => ({ env: {} }));

import { searchKnowledge } from './search-knowledge';

describe('searchKnowledge mandatory redaction', () => {
  it('redacts PII from every returned card without an opt-out flag', async () => {
    const out = await searchKnowledge(
      { query: vi.fn().mockResolvedValue({ rows: [{
        chunk_id: 'c1',
        knowledge_source_id: 's1',
        content: 'Contacte ana@example.com, +351 912 345 678, CPF 123.456.789-09.',
        similarity: 0.95,
        metadata: null,
      }] }) } as unknown as pg.Pool,
      { organizationId: 'org-1', kbVersionId: 'kb-1', query: 'contacto', topK: 3, threshold: 0.7 },
      { embed: vi.fn().mockResolvedValue({ embedding: [0.1] }) },
    );

    expect(out).toMatchObject({ ok: true, results: [{
      content: 'Contacte [EMAIL_REDACTED], [PHONE_REDACTED], CPF [CPF_REDACTED].',
    }] });
    expect(JSON.stringify(out)).not.toContain('ana@example.com');
    expect(JSON.stringify(out)).not.toContain('+351 912 345 678');
    expect(JSON.stringify(out)).not.toContain('123.456.789-09');
  });
});
