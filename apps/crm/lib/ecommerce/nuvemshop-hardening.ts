export interface NuvemshopWebhookInput {
  store_id: string;
  body: Record<string, unknown>;
}

export type NuvemshopInputResult =
  | { ok: true; value: NuvemshopWebhookInput }
  | { ok: false; code: "invalid_json" | "invalid_payload" | "payload_too_large" };

const MAX_WEBHOOK_BYTES = 256 * 1024;
const STORE_ID = /^[0-9]{1,32}$/;

export function validateNuvemshopWebhookInput(rawBody: string, maxBytes = MAX_WEBHOOK_BYTES): NuvemshopInputResult {
  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) return { ok: false, code: "payload_too_large" };
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return { ok: false, code: "invalid_json" }; }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, code: "invalid_payload" };
  const body = parsed as Record<string, unknown>;
  const storeId = body.store_id === undefined ? "" : String(body.store_id);
  if (!STORE_ID.test(storeId)) return { ok: false, code: "invalid_payload" };
  return { ok: true, value: { store_id: storeId, body } };
}

export interface NuvemshopRateLimitResult { allowed: boolean; count: number; retryAfterSec: number; }

export class NuvemshopRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly limit = 60, private readonly windowMs = 60_000, private readonly now: () => number = Date.now) {}
  check(key: string): NuvemshopRateLimitResult {
    const current = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      this.buckets.set(key, { count: 1, resetAt: current + this.windowMs });
      return { allowed: true, count: 1, retryAfterSec: Math.ceil(this.windowMs / 1000) };
    }
    bucket.count += 1;
    return { allowed: bucket.count <= this.limit, count: bucket.count, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)) };
  }
}

export function safeNuvemshopError(error: unknown): { code: "nuvemshop_unavailable"; message: "Nuvemshop request failed" } {
  void error;
  return { code: "nuvemshop_unavailable", message: "Nuvemshop request failed" };
}

export const NUVEMSHOP_SECURITY_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
} as const;
