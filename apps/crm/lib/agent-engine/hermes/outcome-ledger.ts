import type { SupabaseClient } from '@supabase/supabase-js';

export interface HermesOutcomeRecord {
  id: string;
  organizationId: string;
  runId: string;
  missionId: string | null;
  candidateId: string | null;
  subjectKind: string;
  subjectId: string;
  technicalQuality: number | null;
  costCents: number | null;
  latencyMs: number | null;
  kpiName: string | null;
  kpiBaseline: number | null;
  kpiObserved: number | null;
  evidenceRefs: string[];
  observedAt: string;
  createdAt?: string;
}

export interface OutcomeDeltaInput {
  technicalQuality: number | null;
  costCents: number | null;
  latencyMs: number | null;
  kpiValue: number | null;
}

export interface OutcomeDelta {
  qualityDelta: number | null;
  costDeltaCents: number | null;
  latencyDeltaMs: number | null;
  kpiDelta: number | null;
}

export interface HermesOutcomeStore {
  append(record: HermesOutcomeRecord): Promise<void>;
  listForSubject(input: {
    organizationId: string;
    subjectKind: string;
    subjectId: string;
    limit?: number;
  }): Promise<HermesOutcomeRecord[]>;
}

function subtract(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : b - a;
}

export function summarizeOutcomeDelta(baseline: OutcomeDeltaInput, observed: OutcomeDeltaInput): OutcomeDelta {
  return {
    qualityDelta: subtract(baseline.technicalQuality, observed.technicalQuality),
    costDeltaCents: subtract(baseline.costCents, observed.costCents),
    latencyDeltaMs: subtract(baseline.latencyMs, observed.latencyMs),
    kpiDelta: subtract(baseline.kpiValue, observed.kpiValue),
  };
}

export function businessKpiCanBypassSafety(): false {
  return false;
}

export function createSupabaseOutcomeStore(client: SupabaseClient): HermesOutcomeStore {
  return {
    async append(record) {
      if (!record.organizationId) throw new Error('hermes_outcome_tenant_required');
      const { error } = await client.from('hermes_outcomes').insert({
        id: record.id,
        organization_id: record.organizationId,
        run_id: record.runId,
        mission_id: record.missionId,
        candidate_id: record.candidateId,
        subject_kind: record.subjectKind,
        subject_id: record.subjectId,
        technical_quality: record.technicalQuality,
        cost_cents: record.costCents,
        latency_ms: record.latencyMs,
        kpi_name: record.kpiName,
        kpi_baseline: record.kpiBaseline,
        kpi_observed: record.kpiObserved,
        evidence_refs: [...new Set(record.evidenceRefs)].sort(),
        observed_at: record.observedAt,
      });
      if (error) throw new Error(`hermes_outcome_append_failed:${error.message}`);
    },

    async listForSubject(input) {
      if (!input.organizationId) throw new Error('hermes_outcome_tenant_required');
      const { data, error } = await client
        .from('hermes_outcomes')
        .select('*')
        .eq('organization_id', input.organizationId)
        .eq('subject_kind', input.subjectKind)
        .eq('subject_id', input.subjectId)
        .order('observed_at', { ascending: false })
        .limit(Math.max(1, Math.min(input.limit ?? 100, 500)));
      if (error) throw new Error(`hermes_outcome_list_failed:${error.message}`);
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        organizationId: String(row.organization_id),
        runId: String(row.run_id),
        missionId: typeof row.mission_id === 'string' ? row.mission_id : null,
        candidateId: typeof row.candidate_id === 'string' ? row.candidate_id : null,
        subjectKind: String(row.subject_kind),
        subjectId: String(row.subject_id),
        technicalQuality: typeof row.technical_quality === 'number' ? row.technical_quality : null,
        costCents: typeof row.cost_cents === 'number' ? row.cost_cents : null,
        latencyMs: typeof row.latency_ms === 'number' ? row.latency_ms : null,
        kpiName: typeof row.kpi_name === 'string' ? row.kpi_name : null,
        kpiBaseline: typeof row.kpi_baseline === 'number' ? row.kpi_baseline : null,
        kpiObserved: typeof row.kpi_observed === 'number' ? row.kpi_observed : null,
        evidenceRefs: Array.isArray(row.evidence_refs)
          ? row.evidence_refs.filter((item): item is string => typeof item === 'string')
          : [],
        observedAt: String(row.observed_at),
        createdAt: typeof row.created_at === 'string' ? row.created_at : undefined,
      }));
    },
  };
}
