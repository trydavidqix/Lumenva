import type { SupabaseClient } from '@supabase/supabase-js';

export type ResearchExperimentStatus = 'keep' | 'discard' | 'crash' | 'inconclusive';

export interface ResearchExperimentRecord {
  id: string;
  organizationId: string;
  subjectKind: string;
  subjectId: string;
  contextFingerprint: string;
  goal: string;
  strategy: string;
  metricName: string | null;
  baselineValue: number | null;
  observedValue: number | null;
  score: number | null;
  status: ResearchExperimentStatus;
  evidenceRefs: string[];
  metadata: Record<string, unknown>;
  sourceVersion: string | null;
  supersedesId: string | null;
  createdAt: string;
}

export interface ResearchMemoryStore {
  append(record: ResearchExperimentRecord): Promise<void>;
  listBySubject(input: {
    organizationId: string;
    subjectKind: string;
    subjectId: string;
    limit?: number;
  }): Promise<ResearchExperimentRecord[]>;
  supersede(record: ResearchExperimentRecord & { supersedesId: string }): Promise<void>;
}

type Row = {
  id: string;
  organization_id: string;
  subject_kind: string;
  subject_id: string;
  context_fingerprint: string;
  goal: string;
  strategy: string;
  metric_name: string | null;
  baseline_value: number | null;
  observed_value: number | null;
  score: number | null;
  status: ResearchExperimentStatus;
  evidence_refs: unknown;
  metadata: unknown;
  source_version: string | null;
  supersedes_id: string | null;
  created_at: string;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mapResearchExperimentRow(row: Row): ResearchExperimentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    contextFingerprint: row.context_fingerprint,
    goal: row.goal,
    strategy: row.strategy,
    metricName: row.metric_name,
    baselineValue: row.baseline_value,
    observedValue: row.observed_value,
    score: row.score,
    status: row.status,
    evidenceRefs: stringArray(row.evidence_refs),
    metadata: object(row.metadata),
    sourceVersion: row.source_version,
    supersedesId: row.supersedes_id,
    createdAt: row.created_at,
  };
}

function persistence(record: ResearchExperimentRecord): Row {
  if (!record.organizationId) throw new Error('hermes_research_tenant_required');
  if (!record.id || !record.subjectKind || !record.subjectId || !record.contextFingerprint) {
    throw new Error('hermes_research_record_invalid');
  }
  return {
    id: record.id,
    organization_id: record.organizationId,
    subject_kind: record.subjectKind,
    subject_id: record.subjectId,
    context_fingerprint: record.contextFingerprint,
    goal: record.goal,
    strategy: record.strategy,
    metric_name: record.metricName,
    baseline_value: record.baselineValue,
    observed_value: record.observedValue,
    score: record.score,
    status: record.status,
    evidence_refs: [...new Set(record.evidenceRefs)].sort(),
    metadata: record.metadata,
    source_version: record.sourceVersion,
    supersedes_id: record.supersedesId,
    created_at: record.createdAt,
  };
}

export function createSupabaseResearchMemoryStore(client: SupabaseClient): ResearchMemoryStore {
  return {
    async append(record) {
      const { error } = await client.from('hermes_research_experiments').insert(persistence(record));
      if (error) throw new Error(`hermes_research_append_failed:${error.message}`);
    },

    async listBySubject(input) {
      if (!input.organizationId) throw new Error('hermes_research_tenant_required');
      const { data, error } = await client
        .from('hermes_research_experiments')
        .select('*')
        .eq('organization_id', input.organizationId)
        .eq('subject_kind', input.subjectKind)
        .eq('subject_id', input.subjectId)
        .order('created_at', { ascending: false })
        .limit(Math.max(1, Math.min(input.limit ?? 100, 500)));
      if (error) throw new Error(`hermes_research_list_failed:${error.message}`);
      return ((data ?? []) as Row[]).map(mapResearchExperimentRow);
    },

    async supersede(record) {
      await this.append(record);
    },
  };
}

export function createInMemoryResearchMemoryStore(): ResearchMemoryStore {
  const records: ResearchExperimentRecord[] = [];
  return {
    async append(record) {
      persistence(record);
      if (records.some((item) => item.id === record.id)) throw new Error('hermes_research_duplicate_id');
      records.push(structuredClone(record));
    },
    async listBySubject(input) {
      return records
        .filter(
          (record) =>
            record.organizationId === input.organizationId &&
            record.subjectKind === input.subjectKind &&
            record.subjectId === input.subjectId,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, Math.max(1, Math.min(input.limit ?? 100, 500)))
        .map((record) => structuredClone(record));
    },
    async supersede(record) {
      if (!records.some((item) => item.id === record.supersedesId && item.organizationId === record.organizationId)) {
        throw new Error('hermes_research_supersedes_missing');
      }
      await this.append(record);
    },
  };
}
