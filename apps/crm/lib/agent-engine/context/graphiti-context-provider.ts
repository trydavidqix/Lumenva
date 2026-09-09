import { contextRequestSchema, type ContextItem } from "../platform/contracts";
import { resolveAiPlatformFeature, type ResolvedAiPlatformFeature } from "../platform/features";
import { mapGraphFact } from "../graph/fact-map";
import type { GraphContextPort } from "../graph/port";
import type { GraphFact } from "../graph/types";
import type { ContextProvider, ContextProviderRequest, ContextRetrievalResult } from "./provider";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

export interface GraphitiShadowMetric {
  provider: "graphiti";
  latencyMs: number;
  resultCount: number;
  selectedCount: number;
  notSelectedCount: number;
  overlappingSourceIds: number;
  nativeSourceCount: number;
  degraded: boolean;
}

export interface GraphitiContextProviderDeps {
  graph: GraphContextPort;
  resolveFeature?: (input: { organizationId: string; feature: "graphiti" }) => Promise<ResolvedAiPlatformFeature>;
  /** Receives counts and timing only: never text, query, contact, or tenant fields. */
  recordShadowMetric?: (metric: GraphitiShadowMetric) => void | Promise<void>;
  now?: () => number;
}

function boundedLimit(config: Record<string, unknown>): number {
  const value = config.limit;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_LIMIT)
    : DEFAULT_LIMIT;
}

/**
 * Delegates the authority/risk envelope entirely to `mapGraphFact` (Task 5) —
 * this provider never re-derives domain/risk itself. A fact that somehow
 * fails `mapGraphFact`'s own `contextItemSchema.parse` (it should not, given
 * `GraphContextPort.search()` only ever returns `graphFactSchema`-valid
 * facts) is dropped instead of granted authority, mirroring
 * `mem0-context-provider.ts`'s handling of malformed provider records.
 */
function toContextItem(fact: GraphFact): ContextItem | null {
  try {
    return mapGraphFact(fact);
  } catch {
    return null;
  }
}

function emptyResult(input: {
  bucket: "disabled" | "shadow";
  degraded?: boolean;
  reason?: string;
}): ContextRetrievalResult {
  return {
    provider: "graphiti",
    items: [],
    shadowItems: [],
    degraded: input.degraded ?? false,
    ...(input.reason ? { reason: input.reason } : {}),
    influencePrompt: false,
    bucket: input.bucket,
  };
}

/**
 * Context provider for the Graphiti temporal graph projection (Phase 4),
 * the graph-read sibling of `Mem0ContextProvider` (Phase 2). Same rollout
 * semantics, same shape:
 * - off: no call to `GraphContextPort.search()` at all;
 * - shadow: retrieval/metrics only — facts land in `shadowItems`, never
 *   `items`, so `influencePrompt` stays `false` and nothing reaches a prompt;
 * - canary/on: facts become fusion candidates (`bucket: "candidate"`,
 *   `influencePrompt: true`), still subject to `mapGraphFact`'s own
 *   `actionable: false` gating for every domain in this phase — a graph fact
 *   entering fusion is not the same as it reaching the prompt;
 * - any failure (including `GraphitiProviderError` timeouts) degrades to an
 *   empty result instead of throwing, with the failure surfaced through
 *   `degraded`/the shadow metric rather than swallowed silently.
 *
 * `GraphContextPort.search()` is only ever called with `organizationId`
 * (plus `query`/`limit`) — never `contactId`/`conversationId`/a raw group id
 * — so the trusted `group_id` derivation inside the adapter (Task 2/4) is
 * the sole source of graph tenant scoping.
 */
export class GraphitiContextProvider implements ContextProvider {
  readonly name = "graphiti";
  private readonly resolveFeature: NonNullable<GraphitiContextProviderDeps["resolveFeature"]>;
  private readonly now: () => number;

  constructor(private readonly deps: GraphitiContextProviderDeps) {
    this.resolveFeature = deps.resolveFeature ?? resolveAiPlatformFeature;
    this.now = deps.now ?? Date.now;
  }

  async retrieve(input: ContextProviderRequest): Promise<ContextRetrievalResult> {
    const request = contextRequestSchema.parse(input);
    const feature = await this.resolveFeature({ organizationId: request.organizationId, feature: "graphiti" });
    if (feature.mode === "off") return emptyResult({ bucket: "disabled" });

    const startedAt = this.now();
    try {
      const facts = await this.deps.graph.search({
        organizationId: request.organizationId,
        query: request.query,
        limit: boundedLimit(feature.config),
      });
      const items = facts.map(toContextItem).filter((item): item is ContextItem => item !== null);
      const invalidResult = items.length !== facts.length;
      const isShadow = feature.mode === "shadow";
      const result: ContextRetrievalResult = isShadow
        ? {
          ...emptyResult({ bucket: "shadow", degraded: invalidResult, reason: invalidResult ? "invalid_provider_result" : undefined }),
          shadowItems: items,
        }
        : {
          provider: "graphiti",
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
        provider: "graphiti",
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
