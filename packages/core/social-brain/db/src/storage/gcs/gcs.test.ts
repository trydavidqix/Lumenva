import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGcsObjectStore } from './gcs';

const fileMock = {
  save: vi.fn(),
  download: vi.fn(),
  getMetadata: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
};

const bucketMock = {
  file: vi.fn().mockReturnValue(fileMock),
};

describe('GCS Object Store', () => {
  const store = createGcsObjectStore(bucketMock as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads a file correctly', async () => {
    fileMock.save.mockResolvedValueOnce(undefined);
    await store.put({ provider: 'gcs' as any, bucket: 'test-bucket', key: 'tenant/123/file.jpg' }, new Uint8Array([1, 2, 3]), 'image/jpeg');

    expect(bucketMock.file).toHaveBeenCalledWith('tenant/123/file.jpg');
    expect(fileMock.save).toHaveBeenCalledWith(Buffer.from(new Uint8Array([1, 2, 3])), {
      metadata: { contentType: 'image/jpeg' }
    });
  });

  it('downloads a file correctly', async () => {
    fileMock.download.mockResolvedValueOnce([Buffer.from([1, 2, 3])]);
    const result = await store.get({ provider: 'gcs', bucket: 'test-bucket', key: 'tenant/123/file.jpg' });

    expect(bucketMock.file).toHaveBeenCalledWith('tenant/123/file.jpg');
    expect(fileMock.download).toHaveBeenCalled();
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('heads a file correctly', async () => {
    fileMock.getMetadata.mockResolvedValueOnce([{
      contentType: 'image/jpeg',
      size: '3',
      md5Hash: 'somehash',
    }]);

    const result = await store.head({ provider: 'gcs', bucket: 'test-bucket', key: 'tenant/123/file.jpg' });

    expect(bucketMock.file).toHaveBeenCalledWith('tenant/123/file.jpg');
    expect(fileMock.getMetadata).toHaveBeenCalled();
    expect(result).toEqual({
      contentType: 'image/jpeg',
      sizeBytes: 3,
      sha256: null,
    });
  });

  it('returns null when heading a non-existent file', async () => {
    fileMock.getMetadata.mockRejectedValueOnce({ code: 404 });
    const result = await store.head({ provider: 'gcs', bucket: 'test-bucket', key: 'tenant/123/file.jpg' });
    expect(result).toBeNull();
  });

  it('deletes a file correctly', async () => {
    fileMock.delete.mockResolvedValueOnce(undefined);
    await store.delete({ provider: 'gcs', bucket: 'test-bucket', key: 'tenant/123/file.jpg' });

    expect(bucketMock.file).toHaveBeenCalledWith('tenant/123/file.jpg');
    expect(fileMock.delete).toHaveBeenCalled();
  });

  it('creates a read URL correctly with V4 signed URL', async () => {
    fileMock.getSignedUrl.mockResolvedValueOnce(['https://signed.url']);
    const result = await store.createReadUrl({ provider: 'gcs', bucket: 'test-bucket', key: 'tenant/123/file.jpg' }, 3600);

    expect(bucketMock.file).toHaveBeenCalledWith('tenant/123/file.jpg');
    expect(fileMock.getSignedUrl).toHaveBeenCalledWith(expect.objectContaining({
      version: 'v4',
      action: 'read',
    }));
    expect(result).toBe('https://signed.url');
  });

  it('throws an error for non-GCS locator', async () => {
    await expect(store.get({ provider: 'supabase', bucket: 'b', key: 'k' })).rejects.toThrow('GCS object store received a non-GCS locator');
  });
});
