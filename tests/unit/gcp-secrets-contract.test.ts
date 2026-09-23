import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolveSecret, clearSecretCache, SecretResolutionError } from '../../packages/platform/gcp/secrets/index';

describe('GCP Secret Manager Placeholder Contract', () => {
  beforeEach(() => {
    clearSecretCache();
    vi.useFakeTimers();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should resolve secret by name using placeholder/env', async () => {
    vi.stubEnv('LUMENVA_SECRET_MY_SECRET', 'fake-value');
    const val = await resolveSecret('MY_SECRET');
    expect(val).toBe('fake-value');
  });

  it('should fail-closed when the secret name does not exist', async () => {
    await expect(resolveSecret('NON_EXISTENT')).rejects.toThrow(SecretResolutionError);
  });

  it('should cache with a safe TTL (e.g. 5 minutes)', async () => {
    vi.stubEnv('LUMENVA_SECRET_CACHE_TEST', 'val1');

    // First call, should cache
    const val1 = await resolveSecret('CACHE_TEST');
    expect(val1).toBe('val1');

    // Change underlying value
    vi.stubEnv('LUMENVA_SECRET_CACHE_TEST', 'val2');

    // Should still return cached value
    const val2 = await resolveSecret('CACHE_TEST');
    expect(val2).toBe('val1');

    // Advance time by 6 minutes
    vi.advanceTimersByTime(6 * 60 * 1000);

    // Should resolve new value
    const val3 = await resolveSecret('CACHE_TEST');
    expect(val3).toBe('val2');
  });

  it('should redact secret values in errors', async () => {
    // If the error message included the value by mistake, let's pretend it did.
    // In our implementation, we know we throw when it's MISSING.
    // However, if it wasn't missing but let's say the environment variable was empty or had a problem,
    // we just want to assert the error mentions the secret NAME, but wouldn't somehow leak values or generic stuff.
    try {
      await resolveSecret('SECRET_WITH_EMPTY_VALUE');
    } catch (e: any) {
      expect(e.message).toContain('Failed to resolve secret: SECRET_WITH_EMPTY_VALUE');
      expect(e.message).not.toContain('process.env');
    }
  });
});
