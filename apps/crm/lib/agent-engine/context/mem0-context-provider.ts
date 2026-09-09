import {
  contextItemSchema,
  contextRequestSchema,
  type AuthorityDomain,
  type ContextItem,
} from "../platform/contracts";
import { resolveAiPlatformFeature, type ResolvedAiPlatformFeature } from "../platform/features";
import { type MemoryPort } from "../memory/port";
import { semanticMemoryRecordSchema } from "../memory/types";
import type { ContextProvider, ContextProviderRequest, ContextRetrievalResult } from "./provider";

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 10;

const authorityLevels: Record<AuthorityDomain, number> = {
  commercial_status: 90,
  consent: 85,
  legal: 85,
  operational_state: 80,
  product_policy: 70,
  relationship: 55,
  behavior: 50,
  customer_preference: 40,
};

/**
 * Reads this provider's canonical authority-level mapping. Exported (as a
 * narrow accessor rather than the map itself) so callers building a
 * ContextItem for another domain — e.g. a published knowledge document —
 * can rank it against Mem0 output using the SAME live constant this file
 * assigns to Mem0 records, instead of a mirrored literal that would drift
 * silently if this map ever changes.
 */
export function getAuthorityLevel(domain: AuthorityDomain): number {
  return authorityLevels[domain];
}

export interface Mem0ShadowMetric {
  provider: "mem0";
  latencyMs: number;
  resultCount: number;
  selectedCount: number;
  notSelectedCount: number;
  overlappingSourceIds: number;
  nativeSourceCount: number;
  degraded: boolean;
}

export interface Mem0ContextProviderDeps {
  memory: MemoryPort;
  resolveFeature?: (input: { organizationId: string; feature: "mem0" }) => Promise<ResolvedAiPlatformFeature>;
  /** Receives counts and timing only: never text, query, contact, or tenant fields. */
  recordShadowMetric?: (metric: Mem0ShadowMetric) => void | Promise<void>;
  now?: () => number;
}

function boundedTopK(config: Record<string, unknown>): number {
  const value = config.topK;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_TOP_K)
    : DEFAULT_TOP_K;
}

function toContextItem(record: unknown): ContextItem | null {
  const parsed = semanticMemoryRecordSchema.safeParse(record);
  if (!parsed.success) return null;

  const memory = parsed.data;
  const result = contextItemSchema.safeParse({
    id: memory.id,
    provider: "mem0",
    authorityDomain: memory.authorityDomain,
    authorityLevel: authorityLevels[memory.authorityDomain],
    confidence: memory.confidence,
    occurredAt: memory.validFrom,
    expiresAt: memory.validUntil,
    risk: memory.risk,
    actionable: memory.actionable,
    sourceId: memory.sourceId,
    text: memory.text,
  });
  return result.success ? result.data : null;
}

function emptyResult(input: {
  bucket: "disabled" | "shadow";
  degraded?: boolean;
  reason?: string;
}): ContextRetrievalResult {
  return {
    provider: "mem0",
    items: [],
    shadowItems: [],
    degraded: input.degraded ?? false,
    ...(input.reason ? { reason: input.reason } : {}),
    influencePrompt: false,
    bucket: input.bucket,
  };
}

export class Mem0ContextProvider implements ContextProvider {
  readonly name = "mem0";
  private readonly resolveFeature: NonNullable<Mem0ContextProviderDeps["resolveFeature"]>;
  private readonly now: () => number;

  constructor(private readonly deps: Mem0ContextProviderDeps) {
    this.resolveFeature = deps.resolveFeature ?? resolveAiPlatformFeature;
    this.now = deps.now ?? Date.now;
  }

  async retrieve(input: ContextProviderRequest): Promise<ContextRetrievalResult> {
    const request = contextRequestSchema.parse(input);
    const feature = await this.resolveFeature({ organizationId: request.organizationId, feature: "mem0" });
    if (feature.mode === "off") return emptyResult({ bucket: "disabled" });

    const startedAt = this.now();
    try {
      const records = await this.deps.memory.search({
        organizationId: request.organizationId,
        contactId: request.contactId,
        query: request.query,
        topK: boundedTopK(feature.config),
      });
      const items = records.map(toContextItem).filter((item): item is ContextItem => item !== null);
      const invalidResult = items.length !== records.length;
      const isShadow = feature.mode === "shadow";
      const result: ContextRetrievalResult = isShadow
        ? {
          ...emptyResult({ bucket: "shadow", degraded: invalidResult, reason: invalidResult ? "invalid_provider_result" : undefined }),
          shadowItems: items,
        }
        : {
          provider: "mem0",
          items,
          shadowItems: [],
          degraded: invalidResult,
          ...(invalidResult ? { reason: "invalid_provider_result" } : {}),
          influencePrompt: true,
          bucket: "candidate",
        };

      if (isShadow) await this.recordShadowMetric(input, items, this.now() - startedAt, result.degraded);
      return result;
    } catch {
      const result = emptyResult({ bucket: feature.mode === "shadow" ? "shadow" : "disabled", degraded: true, reason: "provider_unavailable" });
      if (feature.mode === "shadow") await this.recordShadowMetric(input, [], this.now() - startedAt, true);
      return result;
    }
  }

  private async recordShadowMetric(
    input: ContextProviderRequest,
    items: ContextItem[],
    latencyMs: number,
    degraded: boolean,
  ): Promise<void> {
    if (!this.deps.recordShadowMetric) return;
    const nativeIds = new Set(input.nativeSourceIds ?? []);
    try {
      await this.deps.recordShadowMetric({
        provider: "mem0",
        latencyMs: Math.max(0, latencyMs),
        resultCount: items.length,
        selectedCount: 0,
        notSelectedCount: items.length,
        overlappingSourceIds: items.filter((item) => nativeIds.has(item.sourceId)).length,
        nativeSourceCount: nativeIds.size,
        degraded,
      });
    } catch {
      // Telemetry is strictly best-effort: it must never alter a reply/context.
    }
  }
}
