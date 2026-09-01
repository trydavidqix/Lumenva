import { createHash } from "node:crypto";

import type { RawSignal } from "@/lib/content-os/providers/intelligence";

export { signalDedupKey } from "./deduplicate";

type SafeMetadataValue =
  | string
  | number
  | boolean
  | null
  | SafeMetadataValue[]
  | { [key: string]: SafeMetadataValue };

export type NormalizedSignal = Omit<RawSignal, "rawHash" | "metadata"> & {
  rawHash: string;
  metadata: Record<string, SafeMetadataValue>;
};

function normalizeText(value?: string): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeTimestamp(value: string, field: "observedAt" | "publishedAt"): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid ${field} timestamp`);
  }

  return date.toISOString();
}

function canonicalizeUrl(value: string): string {
  const url = new URL(value);

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  url.searchParams.sort();
  return url.toString();
}

function sanitizeMetadata(
  value: unknown,
  seen = new WeakSet<object>(),
): SafeMetadataValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "object") {
    return undefined;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isNaN(timestamp) ? null : value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMetadata(entry, seen) ?? null);
  }

  const result: Record<string, SafeMetadataValue> = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = sanitizeMetadata(
      (value as Record<string, unknown>)[key],
      seen,
    );

    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }

  return result;
}

function stableStringify(value: SafeMetadataValue): string {
  return JSON.stringify(value);
}

/** Converts provider payloads into a deterministic, safe persistence shape. */
export function normalizeSignal(input: RawSignal): NormalizedSignal {
  const sourceUrl = canonicalizeUrl(input.sourceUrl);
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  const publishedAt = input.publishedAt
    ? normalizeTimestamp(input.publishedAt, "publishedAt")
    : undefined;
  const observedAt = normalizeTimestamp(input.observedAt, "observedAt");
  const metadata = sanitizeMetadata(input.metadata);

  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    throw new TypeError("Signal metadata must be an object");
  }

  const canonicalPayload: SafeMetadataValue = {
    externalId: input.externalId,
    sourceType: input.sourceType,
    sourceUrl,
    title,
    body,
    publishedAt: publishedAt ?? null,
    observedAt,
    metadata,
  };

  return {
    externalId: input.externalId,
    sourceType: input.sourceType,
    sourceUrl,
    title,
    body,
    publishedAt,
    observedAt,
    rawHash: createHash("sha256")
      .update(stableStringify(canonicalPayload), "utf8")
      .digest("hex"),
    metadata,
  };
}
