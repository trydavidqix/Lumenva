import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiPlatformFeature, FeatureMode } from "./contracts";

type FeatureRow = {
  organization_id: string | null;
  feature: AiPlatformFeature;
  mode: FeatureMode;
  config: unknown;
};

export type ResolvedAiPlatformFeature = {
  mode: FeatureMode;
  config: Record<string, unknown>;
  killed: boolean;
};

const killSwitches: Record<AiPlatformFeature, boolean> = {
  langsmith: env.AI_PLATFORM_KILL_LANGSMITH,
  mem0: env.AI_PLATFORM_KILL_MEM0,
  llamaindex: env.AI_PLATFORM_KILL_LLAMAINDEX,
  graphiti: env.AI_PLATFORM_KILL_GRAPHITI,
  external_guardrails: env.AI_PLATFORM_KILL_EXTERNAL_GUARDRAILS,
  n8n: env.AI_PLATFORM_KILL_N8N,
  langgraph_proposal_workflow: env.AI_PLATFORM_KILL_LANGGRAPH,
  langgraph_automation_workflow: env.AI_PLATFORM_KILL_LANGGRAPH,
  langgraph_lead_scoring_workflow: env.AI_PLATFORM_KILL_LANGGRAPH,
};

function safeConfig(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function resolveFeatureRows(
  feature: AiPlatformFeature,
  rows: FeatureRow[],
  killed = false,
): ResolvedAiPlatformFeature {
  if (killed) return { mode: "off", config: {}, killed: true };
  const row = rows.find((candidate) => candidate.organization_id !== null)
    ?? rows.find((candidate) => candidate.organization_id === null);
  return row ? { mode: row.mode, config: safeConfig(row.config), killed: false } : { mode: "off", config: {}, killed: false };
}

async function fetchFeatureRows(feature: AiPlatformFeature, organizationId: string): Promise<FeatureRow[]> {
  const client = createAdminClient();
  const [global, tenant] = await Promise.all([
    client.from("ai_platform_feature_flags").select("organization_id, feature, mode, config").eq("feature", feature).is("organization_id", null).maybeSingle(),
    client.from("ai_platform_feature_flags").select("organization_id, feature, mode, config").eq("feature", feature).eq("organization_id", organizationId).maybeSingle(),
  ]);
  if (global.error) throw global.error;
  if (tenant.error) throw tenant.error;
  return [global.data, tenant.data].filter((row): row is FeatureRow => row !== null);
}

export async function resolveAiPlatformFeature(input: {
  organizationId: string;
  feature: AiPlatformFeature;
}): Promise<ResolvedAiPlatformFeature> {
  const killed = killSwitches[input.feature];
  if (killed) return { mode: "off", config: {}, killed: true };
  const rows = await fetchFeatureRows(input.feature, input.organizationId);
  return resolveFeatureRows(input.feature, rows, false);
}

export type StoredAiPlatformFeatureMode = { mode: FeatureMode; config: Record<string, unknown> };

/**
 * Reads the STORED per-org rollout mode directly from `ai_platform_feature_flags`,
 * completely ignoring the kill switch. `resolveAiPlatformFeature` masks its
 * `mode` to `"off"` whenever the kill switch is active — correct for gating
 * whether live traffic reaches a provider right now, but wrong for any
 * caller that needs to know what is actually PERSISTED for the org (for
 * example, an operator rebuild deciding whether to downgrade an escalated
 * rollout mode: the kill switch being active must never make that decision
 * silently no-op just because the masked value happened to read `"off"`).
 *
 * `fetchRows` is injectable for tests; defaults to the real Supabase read.
 */
export async function resolveStoredAiPlatformFeatureMode(
  input: { organizationId: string; feature: AiPlatformFeature },
  fetchRows: (feature: AiPlatformFeature, organizationId: string) => Promise<FeatureRow[]> = fetchFeatureRows,
): Promise<StoredAiPlatformFeatureMode> {
  const rows = await fetchRows(input.feature, input.organizationId);
  const resolved = resolveFeatureRows(input.feature, rows, false);
  return { mode: resolved.mode, config: resolved.config };
}
