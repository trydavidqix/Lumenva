import { describe, expect, it, vi } from 'vitest';
import type pg from 'pg';

vi.mock('@/lib/env', () => ({ env: {} }));

import { citationsFromHits, searchKnowledge } from './search-knowledge';

describe('searchKnowledge mandatory redaction', () => {
  it('redacts PII from every returned card without an opt-out flag', async () => {
    const out = await searchKnowledge(
      { query: vi.fn().mockResolvedValue({ rows: [{
        chunk_id: 'c1',
        knowledge_source_id: 's1',
        content: 'Contacte ana@example.com, +351 912 345 678, CPF 123.456.789-09.',
        similarity: 0.95,
        metadata: {
          email: 'metadata@example.com',
          phone: '+351 911 222 333',
          cpf: '987.654.321-00',
        },
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
    expect(out).toMatchObject({ results: [{ metadata: {
      email: '[EMAIL_REDACTED]',
      phone: '[PHONE_REDACTED]',
      cpf: '[CPF_REDACTED]',
    } }] });
    expect(JSON.stringify(out)).not.toContain('metadata@example.com');
    expect(JSON.stringify(out)).not.toContain('+351 911 222 333');
    expect(JSON.stringify(out)).not.toContain('987.654.321-00');
  });

  it('redacts PII in citations even when called with an unredacted hit', () => {
    const citations = citationsFromHits([{
      chunk_id: 'c2',
      knowledge_source_id: 's2',
      content: 'Citation citation@example.com +351 933 444 555 CPF 111.222.333-44',
      similarity: 0.9,
      metadata: {
        email: 'citation@example.com',
        phone: '+351 933 444 555',
        cpf: '111.222.333-44',
      },
    }]);

    expect(citations[0]).toMatchObject({
      snippet: 'Citation [EMAIL_REDACTED] [PHONE_REDACTED] CPF [CPF_REDACTED]',
      metadata: {
        email: '[EMAIL_REDACTED]',
        phone: '[PHONE_REDACTED]',
        cpf: '[CPF_REDACTED]',
      },
    });
    expect(JSON.stringify(citations)).not.toContain('citation@example.com');
    expect(JSON.stringify(citations)).not.toContain('+351 933 444 555');
    expect(JSON.stringify(citations)).not.toContain('111.222.333-44');
  });
});
