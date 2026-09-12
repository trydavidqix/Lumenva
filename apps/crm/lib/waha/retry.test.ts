import { describe, expect, it } from "vitest";
import { isRetryableWahaStatus, wahaRetryDelayMs, wahaWebhookIdempotencyKey } from "@/lib/waha/retry";

describe("WAHA retry and idempotency contract", () => {
  it("uses bounded deterministic retry delays", () => {
    expect([0, 1, 2].map(wahaRetryDelayMs)).toEqual([1000, 5000, 30000]);
    expect(wahaRetryDelayMs(3)).toBeNull();
    expect(wahaRetryDelayMs(-1)).toBeNull();
  });

  it("derives stable keys per session and provider event id", () => {
    const key = wahaWebhookIdempotencyKey("session-a", "event-1");
    expect(key).toHaveLength(64);
    expect(wahaWebhookIdempotencyKey("session-a", "event-1")).toBe(key);
    expect(wahaWebhookIdempotencyKey("session-b", "event-1")).not.toBe(key);
  });

  it("retries only transient provider responses", () => {
    expect([408, 425, 429, 500, 503].every(isRetryableWahaStatus)).toBe(true);
    expect([200, 400, 401, 404].some(isRetryableWahaStatus)).toBe(false);
  });
});
