import { createHash, randomUUID } from "node:crypto";

export type ContentAsset = {
  id: string;
  organization_id: string;
  content_item_id: string | null;
  asset_type: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  byte_size: number;
  checksum: string | null;
  origin_provider: string | null;
  metadata: Record<string, unknown>;
};

export type AssetRepository = {
  create(input: Record<string, unknown>): Promise<ContentAsset>;
};

export const CONTENT_ASSET_BUCKET = "content-assets";
const MIME_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav" };
const MAX_BYTES = 100 * 1024 * 1024;

export class ContentAssetValidationError extends Error { readonly code = "asset_invalid"; }

export function contentAssetObjectKey(input: { organizationId: string; assetId: string; extension: string }): string {
  if (!/^[a-z0-9-]+$/i.test(input.organizationId) || !/^[a-z0-9-]+$/i.test(input.assetId) || !/^[a-z0-9]+$/i.test(input.extension)) throw new ContentAssetValidationError("Invalid asset storage key.");
  return `content-os/${input.organizationId}/${input.assetId}.${input.extension.toLowerCase()}`;
}

export function assertSafeAssetUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new ContentAssetValidationError("Asset URL is invalid."); }
  if (url.protocol !== "https:") throw new ContentAssetValidationError("Asset URL must use HTTPS.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1" || hostname.startsWith("127.") || hostname.startsWith("10.") || hostname.startsWith("192.168.") || hostname.endsWith(".local")) throw new ContentAssetValidationError("Private asset URLs are not accepted.");
  return url;
}

export async function registerContentAsset(repository: AssetRepository, input: { organizationId: string; assetId?: string; assetType: string; mimeType: string; bytes: Uint8Array; contentItemId?: string | null; originProvider?: string | null; metadata?: Record<string, unknown> }): Promise<ContentAsset> {
  const extension = MIME_TYPES[input.mimeType];
  if (!extension || !input.assetType.trim()) throw new ContentAssetValidationError("Unsupported asset type or MIME type.");
  if (input.bytes.byteLength > MAX_BYTES) throw new ContentAssetValidationError("Asset exceeds the maximum size.");
  const assetId = input.assetId ?? randomUUID();
  const storagePath = contentAssetObjectKey({ organizationId: input.organizationId, assetId, extension });
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  return repository.create({ organization_id: input.organizationId, id: assetId, content_item_id: input.contentItemId ?? null, asset_type: input.assetType, storage_bucket: CONTENT_ASSET_BUCKET, storage_path: storagePath, mime_type: input.mimeType, byte_size: input.bytes.byteLength, checksum, origin_provider: input.originProvider ?? null, metadata: input.metadata ?? {} });
}
