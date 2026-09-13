import type { ResearchExperimentRecord } from './research-memory';

export interface HermesRetrievalQuery {
  organizationId: string;
  contextFingerprint: string;
  goal: string;
  metricName: string | null;
  tags?: string[];
  now?: string;
}

export interface HermesRetrievedEvidence {
  record: ResearchExperimentRecord;
  score: number;
  mustRetest: true;
  components: {
    contextSimilarity: number;
    goalOverlap: number;
    metricCompatibility: number;
    outcomeQuality: number;
    freshness: number;
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^\p{L}\p{N}_-]+/u)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function freshness(createdAt: string, now: string): number {
  const ageMs = Math.max(0, Date.parse(now) - Date.parse(createdAt));
  const days = ageMs / 86_400_000;
  if (!Number.isFinite(days)) return 0;
  if (days <= 30) return 1;
  if (days <= 90) return 0.75;
  if (days <= 365) return 0.5;
  return 0.25;
}

function metadataTags(record: ResearchExperimentRecord): string[] {
  const value = record.metadata.tags;
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function rankPriorEvidence(
  query: HermesRetrievalQuery,
  records: ResearchExperimentRecord[],
  limit = 10,
): HermesRetrievedEvidence[] {
  if (!query.organizationId) throw new Error('hermes_retrieval_tenant_required');
  const now = query.now ?? new Date().toISOString();
  const queryTags = new Set(query.tags ?? []);

  return records
    .filter((record) => record.organizationId === query.organizationId)
    .map((record): HermesRetrievedEvidence => {
      const contextSimilarity =
        record.contextFingerprint === query.contextFingerprint
          ? 1
          : jaccard(queryTags, new Set(metadataTags(record)));
      const goalOverlap = jaccard(tokens(query.goal), tokens(record.goal));
      const metricCompatibility =
        query.metricName === null && record.metricName === null
          ? 1
          : query.metricName !== null && query.metricName === record.metricName
            ? 1
            : 0;
      const outcomeQuality = clamp(record.score ?? (record.status === 'keep' ? 0.75 : 0.25));
      const ageFreshness = freshness(record.createdAt, now);
      const score = clamp(
        0.35 * contextSimilarity +
          0.25 * goalOverlap +
          0.15 * metricCompatibility +
          0.15 * outcomeQuality +
          0.1 * ageFreshness,
      );
      return {
        record,
        score,
        mustRetest: true,
        components: {
          contextSimilarity,
          goalOverlap,
          metricCompatibility,
          outcomeQuality,
          freshness: ageFreshness,
        },
      };
    })
    .sort((a, b) => b.score - a.score || b.record.createdAt.localeCompare(a.record.createdAt))
    .slice(0, Math.max(1, Math.min(limit, 100)));
}
