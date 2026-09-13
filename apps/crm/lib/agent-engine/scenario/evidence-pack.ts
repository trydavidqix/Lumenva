import type { EvidenceAuthorityLevel, ScenarioEvidenceItem } from "../contracts/scenario";

const authorityRank: Record<EvidenceAuthorityLevel, number> = {
  authoritative_crm: 0,
  published_knowledge: 1,
  derived_memory: 2,
  external_research: 3,
  model_prior: 4,
};

export interface EvidencePack {
  organizationId: string | null;
  scenarioId: string | null;
  items: ScenarioEvidenceItem[];
  excludedRefs: string[];
  authorityCounts: Record<EvidenceAuthorityLevel, number>;
}

export interface EvidencePackOptions {
  cutoffAt?: string;
  maxItems?: number;
}

export function buildEvidencePack(
  evidence: ScenarioEvidenceItem[],
  options: EvidencePackOptions = {},
): EvidencePack {
  const orgIds = new Set(evidence.map((item) => item.organizationId));
  const scenarioIds = new Set(evidence.map((item) => item.scenarioId));
  if (orgIds.size > 1) throw new Error("Evidence pack cannot contain multiple organizations.");
  if (scenarioIds.size > 1) throw new Error("Evidence pack cannot contain multiple scenarios.");

  const cutoffMs = options.cutoffAt ? Date.parse(options.cutoffAt) : null;
  if (options.cutoffAt && !Number.isFinite(cutoffMs)) throw new Error("Evidence cutoff must be a valid timestamp.");

  const excludedRefs: string[] = [];
  const included = evidence.filter((item) => {
    if (cutoffMs === null) return true;
    const candidate = item.observedAt ?? item.retrievedAt;
    const candidateMs = Date.parse(candidate);
    const allowed = Number.isFinite(candidateMs) && candidateMs <= cutoffMs;
    if (!allowed) excludedRefs.push(item.id);
    return allowed;
  });

  included.sort((a, b) => {
    const rank = authorityRank[a.authority] - authorityRank[b.authority];
    if (rank !== 0) return rank;
    return Date.parse(b.observedAt ?? b.retrievedAt) - Date.parse(a.observedAt ?? a.retrievedAt);
  });

  const maxItems = Math.max(1, Math.min(500, Math.trunc(options.maxItems ?? 200)));
  const items = included.slice(0, maxItems);
  excludedRefs.push(...included.slice(maxItems).map((item) => item.id));

  const authorityCounts: Record<EvidenceAuthorityLevel, number> = {
    authoritative_crm: 0,
    published_knowledge: 0,
    derived_memory: 0,
    external_research: 0,
    model_prior: 0,
  };
  for (const item of items) authorityCounts[item.authority] += 1;

  return {
    organizationId: evidence[0]?.organizationId ?? null,
    scenarioId: evidence[0]?.scenarioId ?? null,
    items,
    excludedRefs,
    authorityCounts,
  };
}
