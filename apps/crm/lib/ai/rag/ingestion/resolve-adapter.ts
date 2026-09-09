import { resolveAiPlatformFeature, type ResolvedAiPlatformFeature } from "@/lib/agent-engine/platform/features";

import { LlamaIndexIngestionAdapter } from "./llamaindex-adapter";
import { NativeIngestionAdapter } from "./native-adapter";
import type { IngestionDocument, IngestionNode, KnowledgeIngestionPort } from "./port";

export type IngestionAdapterMode = "native" | "llamaindex" | "shadow";

/**
 * Counts and a boolean only — text is intentionally excluded so shadow
 * telemetry can never leak tenant document content, matching the mem0
 * shadow-metric contract in lib/agent-engine/context/mem0-context-provider.ts.
 */
export interface ShadowIngestionComparison {
  nativeNodeCount: number;
  llamaIndexNodeCount: number;
  nodeCountDelta: number;
  textMatches: boolean;
  degraded: boolean;
  reason?: string;
}

/** Emitted when canary/on falls back to native after the LlamaIndex adapter throws. */
export interface IngestionAdapterFailure {
  mode: "canary" | "on";
  reason: string;
}

export interface IngestionSelectionResult {
  mode: IngestionAdapterMode;
  nodes: IngestionNode[];
  shadow?: ShadowIngestionComparison;
  fallback?: IngestionAdapterFailure;
}

export interface ResolveIngestionAdapterDeps {
  organizationId: string;
  document: IngestionDocument;
  resolveFeature?: (input: { organizationId: string; feature: "llamaindex" }) => Promise<ResolvedAiPlatformFeature>;
  nativeAdapter?: KnowledgeIngestionPort;
  llamaIndexAdapter?: KnowledgeIngestionPort;
  /** Receives counts only, never node text. Best-effort: never affects what gets indexed. */
  recordShadowComparison?: (comparison: ShadowIngestionComparison) => void | Promise<void>;
  /** Best-effort; never affects what gets indexed. Fires when canary/on falls back to native. */
  recordAdapterFailure?: (failure: IngestionAdapterFailure) => void | Promise<void>;
}

function sameTexts(a: readonly IngestionNode[], b: readonly IngestionNode[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((node, index) => node.text === b[index]?.text);
}

/**
 * Selects the ingestion adapter for a tenant/source per the AI Platform
 * feature-gate contract (lib/agent-engine/platform/features.ts):
 *
 * - `off` (including a killed feature, which `resolveAiPlatformFeature`
 *   already collapses to `off`): native only.
 * - `canary` / `on`: LlamaIndex adapter's output is what gets indexed. If the
 *   LlamaIndex adapter throws, this fails open to the native adapter's
 *   output instead of propagating — per this plan's Global Constraint that
 *   failed new ingestion must never replace the previously active knowledge
 *   version, a tenant with the feature on must still get a working (native)
 *   ingestion rather than none. The fallback is reported via `fallback` /
 *   `recordAdapterFailure` so it stays operationally visible rather than
 *   silently swallowed.
 * - `shadow`: both adapters run so the comparison is measured, but only the
 *   native adapter's nodes are ever returned/indexed — shadow mode never
 *   influences what actually gets written, mirroring how Mem0's shadow mode
 *   never influences the prompt (see fusion.ts's `prepareSemanticContext`).
 */
export async function resolveIngestionNodes(deps: ResolveIngestionAdapterDeps): Promise<IngestionSelectionResult> {
  const resolveFeature = deps.resolveFeature ?? resolveAiPlatformFeature;
  const nativeAdapter = deps.nativeAdapter ?? new NativeIngestionAdapter();
  const feature = await resolveFeature({ organizationId: deps.organizationId, feature: "llamaindex" });

  if (feature.mode === "canary" || feature.mode === "on") {
    const activeMode = feature.mode;
    const llamaIndexAdapter = deps.llamaIndexAdapter ?? new LlamaIndexIngestionAdapter();
    try {
      const nodes = await llamaIndexAdapter.normalize(deps.document);
      return { mode: "llamaindex", nodes };
    } catch {
      const failure: IngestionAdapterFailure = {
        mode: activeMode,
        reason: "llamaindex_adapter_unavailable",
      };
      if (deps.recordAdapterFailure) {
        try {
          await deps.recordAdapterFailure(failure);
        } catch {
          // Telemetry is strictly best-effort: it must never block the native fallback.
        }
      }
      const nodes = await nativeAdapter.normalize(deps.document);
      return { mode: "native", nodes, fallback: failure };
    }
  }

  if (feature.mode === "shadow") {
    const llamaIndexAdapter = deps.llamaIndexAdapter ?? new LlamaIndexIngestionAdapter();
    const [nativeNodes, shadowOutcome] = await Promise.all([
      nativeAdapter.normalize(deps.document),
      llamaIndexAdapter.normalize(deps.document).then(
        (nodes) => ({ nodes, degraded: false as const }),
        () => ({ nodes: [] as IngestionNode[], degraded: true as const }),
      ),
    ]);

    const comparison: ShadowIngestionComparison = {
      nativeNodeCount: nativeNodes.length,
      llamaIndexNodeCount: shadowOutcome.nodes.length,
      nodeCountDelta: shadowOutcome.nodes.length - nativeNodes.length,
      textMatches: !shadowOutcome.degraded && sameTexts(nativeNodes, shadowOutcome.nodes),
      degraded: shadowOutcome.degraded,
      ...(shadowOutcome.degraded ? { reason: "llamaindex_adapter_unavailable" } : {}),
    };

    if (deps.recordShadowComparison) {
      try {
        await deps.recordShadowComparison(comparison);
      } catch {
        // Telemetry is strictly best-effort: it must never alter what gets indexed.
      }
    }

    return { mode: "shadow", nodes: nativeNodes, shadow: comparison };
  }

  const nodes = await nativeAdapter.normalize(deps.document);
  return { mode: "native", nodes };
}
