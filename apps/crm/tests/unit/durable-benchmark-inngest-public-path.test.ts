import { describe, expect, it } from 'vitest';

import { isPublicPath } from '@/lib/auth/public-paths';

describe('Phase 7 Inngest public route boundary', () => {
  it('allows the Inngest serve endpoint to bypass cookie auth', () => {
    expect(isPublicPath('/api/inngest')).toBe(true);
  });

  it('does not accidentally make arbitrary API paths public', () => {
    expect(isPublicPath('/api/private')).toBe(false);
    expect(isPublicPath('/api/v1/contacts')).toBe(false);
  });
});
