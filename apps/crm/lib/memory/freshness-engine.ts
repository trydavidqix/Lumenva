import type { PostgresSourceRegistry, SourceRecord } from "./source-registry";

export type FreshnessStatus = "fresh" | "stale";
export interface FreshnessOptions { now: string; maxAgeMs: number; }
const MAX_DATE_MS = 8.64e15;
function parseTimestamp(value: string): number | null { const parsed = Date.parse(value); return Number.isFinite(parsed) && Math.abs(parsed) <= MAX_DATE_MS ? parsed : null; }
export function evaluateSourceFreshness(sources: readonly SourceRecord[], options: FreshnessOptions): Array<SourceRecord & { freshness: FreshnessStatus }> {
  const nowMs = parseTimestamp(options.now);
  const maxAgeMs = Number.isFinite(options.maxAgeMs) && options.maxAgeMs >= 0 ? options.maxAgeMs : null;
  return sources.map((source) => { const observedMs = parseTimestamp(source.lastVerifiedAt ?? source.createdAt); const fresh = nowMs !== null && maxAgeMs !== null && observedMs !== null && observedMs <= nowMs && nowMs - observedMs <= maxAgeMs; return { ...source, freshness: fresh ? "fresh" : "stale" }; });
}
/** Reads the durable registry before evaluating freshness for the memory pipeline. */
export async function evaluateRegisteredSourceFreshness(registry: Pick<PostgresSourceRegistry, "list">, organizationId: string, options: FreshnessOptions): Promise<Array<SourceRecord & { freshness: FreshnessStatus }>> {
  return evaluateSourceFreshness(await registry.list(organizationId), options);
}
