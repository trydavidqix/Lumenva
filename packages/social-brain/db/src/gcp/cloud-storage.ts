import { Storage } from '@google-cloud/storage';

/**
 * Google Cloud Storage Adapter.
 * Replaces Supabase Storage.
 */

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'lumenva-storage-bucket';

export const bucket = storage.bucket(BUCKET_NAME);

export async function uploadFile(destinationPath: string, fileBuffer: Buffer, contentType: string) {
  const file = bucket.file(destinationPath);
  await file.save(fileBuffer, {
    metadata: { contentType },
  });
  return file.publicUrl();
}

export async function getFileSignedUrl(filePath: string, expiresInMinutes: number = 60) {
  const file = bucket.file(filePath);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });
  return url;
}

export async function deleteFile(filePath: string) {
  await bucket.file(filePath).delete();
}
