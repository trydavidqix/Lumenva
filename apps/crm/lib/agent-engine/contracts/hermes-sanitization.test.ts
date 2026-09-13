import { describe, expect, it } from 'vitest';

import { sanitizeLearningSummary } from '../hermes/sanitization';

describe('Hermes learning artifact sanitization', () => {
  it('redacts bearer tokens and obvious contact PII while bounding length', () => {
    expect(sanitizeLearningSummary('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def.ghi');
    expect(sanitizeLearningSummary('alice@example.com +351 912 345 678')).not.toContain('alice@example.com');
    expect(sanitizeLearningSummary('alice@example.com +351 912 345 678')).not.toContain('912 345 678');
    expect(sanitizeLearningSummary('x'.repeat(2000))?.length).toBeLessThanOrEqual(500);
  });

  it('returns null for empty summaries', () => {
    expect(sanitizeLearningSummary('   ')).toBeNull();
  });
});
