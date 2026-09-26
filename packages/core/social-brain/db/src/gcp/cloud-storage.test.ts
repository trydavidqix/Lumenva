import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@google-cloud/storage', () => {
  return {
    Storage: class {
      bucket = vi.fn().mockImplementation((name) => ({ name }));
    }
  };
});

import { getGcsBucket } from './cloud-storage';

describe('cloud-storage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('fails closed when configuration is missing', () => {
    delete process.env.GCS_BUCKET_NAME;
    expect(() => getGcsBucket()).toThrow('GCS_BUCKET_NAME is not configured');
  });

  it('returns a bucket instance when configured', () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    const bucket = getGcsBucket();
    expect(bucket.name).toBe('test-bucket');
  });
});
