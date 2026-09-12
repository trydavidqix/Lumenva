import type { MemoryEvent } from "./context-compiler";

export interface MemoryTtlOptions {
  now: string;
  workingTtlMs: number;
  episodicTtlDays: number;
}

function ttlExpiry(event: MemoryEvent, ttlMs: number): string {
  return new Date(Date.parse(event.observedAt) + ttlMs).toISOString();
}

export function applyMemoryTtl(
  events: readonly MemoryEvent[],
  options: MemoryTtlOptions,
): MemoryEvent[] {
  const workingTtlMs = Math.max(0, options.workingTtlMs);
  const episodicTtlMs = Math.max(0, options.episodicTtlDays) * 24 * 60 * 60 * 1000;
  const nowMs = Date.parse(options.now);

  return events.map((event) => {
    if (
      event.lifecycle !== "active" ||
      (event.kind !== "WORKING" && event.kind !== "EPISODIC")
    ) {
      return { ...event };
    }

    const ttlMs = event.kind === "WORKING" ? workingTtlMs : episodicTtlMs;
    const computedExpiry = ttlExpiry(event, ttlMs);
    const validUntil =
      event.validUntil === null || computedExpiry < event.validUntil
        ? computedExpiry
        : event.validUntil;

    return {
      ...event,
      validUntil,
      lifecycle: nowMs >= Date.parse(validUntil) ? "expired" : "active",
    };
  });
}
