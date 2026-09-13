import { describe, expect, it } from 'vitest';

import { CanonRegistry, type CanonDocument } from './canon';

const document = (overrides: Partial<CanonDocument> = {}): CanonDocument => ({
  documentId: 'doc-canonical-v1',
  tenantId: 'org-a',
  key: 'retrieval.precedence',
  content: 'PROJECT_CANONICAL wins.',
  version: 'v1',
  precedence: 'PROJECT_CANONICAL',
  source: 'plan-master-2026-09-12',
  updatedAt: '2026-09-12T12:00:00.000Z',
  ...overrides,
});

describe('CanonRegistry', () => {
  it('resolves PROJECT_CANONICAL before lower-precedence documents', () => {
    const canon = new CanonRegistry();
    canon.register(document({ documentId: 'vendor-v9', content: 'vendor claim', version: 'v9', precedence: 'OFFICIAL_VENDOR', updatedAt: '2026-09-13T12:00:00.000Z' }));
    canon.register(document());

    expect(canon.resolve('org-a', 'retrieval.precedence')).toEqual(document());
  });

  it('keeps versions and rejects duplicate document ids', () => {
    const canon = new CanonRegistry();
    canon.register(document());
    canon.register(document({ documentId: 'doc-canonical-v2', version: 'v2', content: 'updated' }));

    expect(canon.list('org-a', 'retrieval.precedence')).toHaveLength(2);
    expect(() => canon.register(document())).toThrow('canon document already registered: doc-canonical-v1');
  });

  it('isolates documents by tenant id', () => {
    const canon = new CanonRegistry();
    canon.register(document({ documentId: 'org-a-doc', tenantId: 'org-a', content: 'A' }));
    canon.register(document({ documentId: 'org-b-doc', tenantId: 'org-b', content: 'B' }));

    expect(canon.resolve('org-a', 'retrieval.precedence')?.content).toBe('A');
    expect(canon.resolve('org-b', 'retrieval.precedence')?.content).toBe('B');
    expect(canon.resolve('org-c', 'retrieval.precedence')).toBeUndefined();
  });

  it('rejects unknown precedence instead of allowing a NaN ranking', () => {
    const invalid = document({ precedence: 'UNKNOWN' as never });
    expect(() => new CanonRegistry().register(invalid)).toThrow('invalid canon precedence: UNKNOWN');
  });

  it('rejects invalid updatedAt timestamps', () => {
    expect(() => new CanonRegistry().register(document({ updatedAt: 'not-a-timestamp' }))).toThrow(
      'updatedAt must be a valid timestamp',
    );
  });
});
