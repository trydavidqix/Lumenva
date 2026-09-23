import type { Bucket } from '@google-cloud/storage';
import type { ObjectStore, StorageLocator, StoredObjectMetadata } from '../object-store';

export function createGcsObjectStore(bucket: Bucket): ObjectStore {
  function assertProvider(locator: StorageLocator): void {
    if (locator.provider !== 'gcs') {
      throw new Error('GCS object store received a non-GCS locator');
    }
  }

  return {
    async put(locator, bytes, contentType) {
      assertProvider(locator);
      const file = bucket.file(locator.key);
      try {
        await file.save(Buffer.from(bytes), {
          metadata: { contentType },
        });
      } catch (error) {
        throw new Error('GCS object upload failed');
      }
    },

    async get(locator) {
      assertProvider(locator);
      const file = bucket.file(locator.key);
      try {
        const [data] = await file.download();
        return new Uint8Array(data);
      } catch (error) {
        throw new Error('GCS object download failed');
      }
    },

    async head(locator) {
      assertProvider(locator);
      const file = bucket.file(locator.key);
      try {
        const [metadata] = await file.getMetadata();
        return {
          contentType: typeof metadata.contentType === 'string' ? metadata.contentType : null,
          sizeBytes: typeof metadata.size === 'string' || typeof metadata.size === 'number' ? Number(metadata.size) : null,
          sha256: null,
        };
      } catch (error: any) {
        if (error.code === 404) {
          return null;
        }
        throw new Error('GCS object metadata lookup failed');
      }
    },

    async delete(locator) {
      assertProvider(locator);
      const file = bucket.file(locator.key);
      try {
        await file.delete();
      } catch (error) {
        throw new Error('GCS object delete failed');
      }
    },

    async createReadUrl(locator, expiresInSeconds) {
      assertProvider(locator);
      const file = bucket.file(locator.key);
      try {
        const [url] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + expiresInSeconds * 1000,
        });
        return url;
      } catch (error) {
        throw new Error('GCS signed URL creation failed');
      }
    },
  };
}
