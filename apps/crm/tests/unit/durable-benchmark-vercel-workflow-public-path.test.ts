import { describe, expect, it } from 'vitest';

import { isPublicPath } from '@/lib/auth/public-paths';

describe('Phase 7 Vercel Workflow local public route boundary', () => {
  it('allows only the dedicated local benchmark route family through cookie auth', () => {
    expect(isPublicPath('/api/phase7/vercel-workflow')).toBe(true);
    expect(isPublicPath('/api/phase7/vercel-workflow/approval')).toBe(true);
    expect(isPublicPath('/api/phase7/vercel-workflow/run_123')).toBe(true);
  });

  it('does not make neighboring Phase 7 or arbitrary API paths public', () => {
    expect(isPublicPath('/api/phase7/private')).toBe(false);
    expect(isPublicPath('/api/private')).toBe(false);
    expect(isPublicPath('/api/v1/contacts')).toBe(false);
  });
});
