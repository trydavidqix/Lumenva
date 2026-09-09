import { createHash } from "node:crypto";

const MAX_STRING_LENGTH = 2_000;
const MAX_COLLECTION_ITEMS = 100;
const MAX_DEPTH = 8;

const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";
const UNSERIALIZABLE = "[UNSERIALIZABLE]";
const CIRCULAR = "[CIRCULAR]";

const SENSITIVE_KEY = /authorization|bearer|cookie|api[_-]?key|apikey|token|secret|password/i;
const BEARER_VALUE = /\bbearer\s+[^\s,;]+/gi;
const JWT_LIKE_VALUE = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_CANDIDATE = /\+?\d[\d\s().-]{6,}\d/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeString(value: string): string {
  if (value.length > MAX_STRING_LENGTH) return TRUNCATED;

  return value
    .replace(BEARER_VALUE, `Bearer ${REDACTED}`)
    .replace(JWT_LIKE_VALUE, "[JWT]")
    .replace(EMAIL_VALUE, "[EMAIL]")
    .replace(PHONE_CANDIDATE, (candidate) => {
      const digitCount = candidate.replace(/\D/g, "").length;
      return digitCount >= 8 && digitCount <= 15 && !ISO_DATE.test(candidate) ? "[PHONE]" : candidate;
    });
}

function sanitizeValue(value: unknown, depth: number, ancestors: Set<object>): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return sanitizeString(value);
  if (
    typeof value === "undefined" ||
    typeof value === "bigint" ||
    typeof value === "symbol" ||
    typeof value === "function"
  ) {
    return UNSERIALIZABLE;
  }
  if (depth >= MAX_DEPTH) return TRUNCATED;

  if (ancestors.has(value)) return CIRCULAR;
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const sanitized: unknown[] = [];
      const itemCount = Math.min(value.length, MAX_COLLECTION_ITEMS);

      for (let index = 0; index < itemCount; index += 1) {
        try {
          sanitized.push(sanitizeValue(value[index], depth + 1, ancestors));
        } catch {
          sanitized.push(UNSERIALIZABLE);
        }
      }
      if (value.length > MAX_COLLECTION_ITEMS) sanitized.push(TRUNCATED);

      return sanitized;
    }

    const sanitized: Record<string, unknown> = {};
    let keys: string[];
    try {
      keys = Object.keys(value).sort();
    } catch {
      return UNSERIALIZABLE;
    }

    for (const key of keys.slice(0, MAX_COLLECTION_ITEMS)) {
      const safeKey = sanitizeString(key);
      if (SENSITIVE_KEY.test(key)) {
        sanitized[safeKey] = REDACTED;
        continue;
      }

      try {
        sanitized[safeKey] = sanitizeValue(value[key as keyof typeof value], depth + 1, ancestors);
      } catch {
        sanitized[safeKey] = UNSERIALIZABLE;
      }
    }
    if (keys.length > MAX_COLLECTION_ITEMS) sanitized[TRUNCATED] = TRUNCATED;

    return sanitized;
  } finally {
    ancestors.delete(value);
  }
}

/**
 * Produces a JSON-safe, bounded payload for telemetry that can leave the
 * process. The decision is wholly local and deterministic: it never relies on
 * a model or a provider to identify confidential data.
 */
export function sanitizeExternalTraceValue(value: unknown): unknown {
  try {
    return sanitizeValue(value, 0, new Set());
  } catch {
    return UNSERIALIZABLE;
  }
}

/** Returns a stable trace label without exporting the raw organization ID. */
export function opaqueTenantId(organizationId: string): string {
  return `tenant_${createHash("sha256").update(organizationId).digest("hex").slice(0, 16)}`;
}
