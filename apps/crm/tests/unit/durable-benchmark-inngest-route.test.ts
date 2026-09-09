import { describe, expect, it } from 'vitest';

import * as route from '@/app/api/inngest/route';

describe('Phase 7 Inngest route', () => {
  it('exposes the Next.js handlers required by the Inngest serve adapter', () => {
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
    expect(typeof route.PUT).toBe('function');
  });
});
