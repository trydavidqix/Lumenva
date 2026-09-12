import { createHash } from "node:crypto";

export const WAHA_RETRY_DELAYS_MS = [1_000, 5_000, 30_000] as const;

export function wahaRetryDelayMs(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0) return null;
  return WAHA_RETRY_DELAYS_MS[attempt] ?? null;
}

export function wahaWebhookIdempotencyKey(session: string, eventId: string): string {
  return createHash("sha256").update(`${session}\n${eventId}`, "utf8").digest("hex");
}

export function isRetryableWahaStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
