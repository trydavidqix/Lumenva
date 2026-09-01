export type SignalDedupKeyInput = {
  organizationId: string;
  provider: string;
  sourceId: string;
  externalId?: string;
  rawHash: string;
};

/**
 * Identifies a signal within a single tenant, provider, and configured source.
 *
 * Providers that expose stable item IDs use those IDs. A canonical payload hash
 * is used as the fallback for sources without one.
 */
export function signalDedupKey({
  organizationId,
  provider,
  sourceId,
  externalId,
  rawHash,
}: SignalDedupKeyInput): string {
  return [organizationId, provider, sourceId, externalId || rawHash].join(":");
}
