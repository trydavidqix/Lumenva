import { Storage } from '@google-cloud/storage';

/**
 * Google Cloud Storage Adapter.
 * Replaces Supabase Storage.
 */

export function getGcsBucket() {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME is not configured');
  }
  const storage = new Storage();
  return storage.bucket(bucketName);
}
