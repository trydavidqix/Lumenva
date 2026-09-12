import type { MemoryEvent } from "./context-compiler";

export interface MemoryTtlOptions {
  now: string;
  workingTtlMs: number;
  episodicTtlDays: number;
}

const MAX_DATE_MS = 8.64e15;

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= MAX_DATE_MS ? parsed : null;
}

function ttlExpiry(event: MemoryEvent, ttlMs: number): string | null {
  const observedMs = parseTimestamp(event.observedAt);
  const expiryMs = observedMs === null ? Number.NaN : observedMs + ttlMs;
  return Number.isFinite(expiryMs) && Math.abs(expiryMs) <= MAX_DATE_MS ? new Date(expiryMs).toISOString() : null;
}

export function applyMemoryTtl(
  events: readonly MemoryEvent[],
  options: MemoryTtlOptions,
): MemoryEvent[] {
  const workingTtlMs = Math.max(0, options.workingTtlMs);
  const episodicTtlMs = Math.max(0, options.episodicTtlDays) * 24 * 60 * 60 * 1000;
  const nowMs = parseTimestamp(options.now);

  return events.map((event) => {
    if (nowMs === null) {
      return { ...event, lifecycle: "expired" };
    }
    if (
      event.lifecycle !== "active" ||
      (event.kind !== "WORKING" && event.kind !== "EPISODIC")
    ) {
      return { ...event };
    }

    const ttlMs = event.kind === "WORKING" ? workingTtlMs : episodicTtlMs;
    const computedExpiry = ttlExpiry(event, ttlMs);
    if (computedExpiry === null) {
      return { ...event, lifecycle: "expired" };
    }
    const validUntil =
      event.validUntil === null || computedExpiry < event.validUntil
        ? computedExpiry
        : event.validUntil;

    return {
      ...event,
      validUntil,
      lifecycle: nowMs >= (parseTimestamp(validUntil) ?? Number.NEGATIVE_INFINITY) ? "expired" : "active",
    };
  });
}
