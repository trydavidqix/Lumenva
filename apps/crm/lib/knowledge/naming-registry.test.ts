import { describe, expect, it } from 'vitest';

import { NamingRegistry } from './naming-registry';

describe('NamingRegistry', () => {
  it('rejects separator, case and whitespace variants of the same name', () => {
    const registry = new NamingRegistry();
    registry.register('SessionService');

    expect(() => registry.register('sessionservice')).toThrow(
      'similar component name already registered: sessionservice',
    );
    expect(() => registry.register(' session_service ')).toThrow(
      'similar component name already registered: session_service',
    );
  });

  it('uses Unicode NFKC and keeps genuinely different names available', () => {
    const registry = new NamingRegistry();
    registry.register(' Ｓｅｓｓｉｏｎ-Service ');

    expect(registry.has('sessionservice')).toBe(true);
    expect(() => registry.register('Session-Worker')).not.toThrow();
    expect(registry.list()).toEqual(['Ｓｅｓｓｉｏｎ-Service', 'Session-Worker']);
  });
});
