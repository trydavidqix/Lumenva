import { describe, expect, it } from 'vitest';

import { config } from '@/proxy';

function matchesProxy(pathname: string): boolean {
  const matcher = config.matcher[0];
  if (!matcher) throw new Error('proxy_matcher_missing');
  return new RegExp(`^${matcher}$`).test(pathname);
}

describe('Phase 7 Vercel Workflow proxy boundary', () => {
  it('excludes Workflow internal Local World requests from the Next proxy', () => {
    expect(matchesProxy('/.well-known/workflow/v1/step')).toBe(false);
    expect(matchesProxy('/.well-known/workflow/executor')).toBe(false);
  });

  it('keeps normal application and API routes behind the proxy matcher', () => {
    expect(matchesProxy('/app/inbox')).toBe(true);
    expect(matchesProxy('/api/v1/conversations')).toBe(true);
  });
});
