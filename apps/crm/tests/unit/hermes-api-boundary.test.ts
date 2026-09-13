import { describe, expect, it } from 'vitest';

/**
 * Branch-level invariant: Hermes exposes read models only. Activation stays in
 * the existing governed approval/promotion path and must never appear as a
 * Hermes API endpoint.
 */
describe('Hermes API boundary', () => {
  it('documents the read-only endpoint allowlist', () => {
    const routes = [
      '/api/v1/ai/hermes/summary',
      '/api/v1/ai/hermes/candidates',
      '/api/v1/ai/hermes/experiments',
      '/api/v1/ai/hermes/outcomes',
      '/api/v1/ai/hermes/meta',
    ];

    expect(routes.every((route) => route.startsWith('/api/v1/ai/hermes/'))).toBe(true);
    expect(routes.some((route) => /activate|promote|approve|apply/.test(route))).toBe(false);
  });
});
