import type { SupabaseClient } from '@supabase/supabase-js';

import {
  parseLearningProposalStatus,
  parseLearningProposalType,
  type LearningProposalEvidence,
  type LearningProposalRecord,
  type LearningProposalStore,
  type LearningScope,
  type LearningValidationMetrics,
  type LearningValidationSummary,
} from './contracts';

type JsonObject = Record<string, unknown>;

type ProposalRow = {
  id: string;
  organization_id: string;
  run_id: string;
  dataset: string;
  type: string;
  target: string;
  content: string;
  evidence: unknown;
  proposed_at?: string | null;
  applied_at: string | null;
  applied_version_id: string | null;
  applied_by: string | null;
};

const SELECT_COLUMNS =
  'id, organization_id, run_id, dataset, type, target, content, evidence, proposed_at, applied_at, applied_version_id, applied_by';

function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function readString(value: unknown, errorCode: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(errorCode);
  return value;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readStringArray(value: unknown, errorCode: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(errorCode);
  }
  return [...new Set(value)].sort();
}

function readFiniteNumber(value: unknown, errorCode: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(errorCode);
  return value;
}

function parseValidationMetrics(value: unknown): LearningValidationMetrics {
  const row = asObject(value);
  if (!row) throw new Error('flywheel_validation_summary_invalid');
  return {
    accuracy: readFiniteNumber(row.accuracy, 'flywheel_validation_summary_invalid'),
    policyCompliance: readFiniteNumber(row.policyCompliance, 'flywheel_validation_summary_invalid'),
    escalationCorrectness: readFiniteNumber(row.escalationCorrectness, 'flywheel_validation_summary_invalid'),
    failureRate: readFiniteNumber(row.failureRate, 'flywheel_validation_summary_invalid'),
    loopStopRate: readFiniteNumber(row.loopStopRate, 'flywheel_validation_summary_invalid'),
    costCents: readFiniteNumber(row.costCents, 'flywheel_validation_summary_invalid'),
    latencyMs: readFiniteNumber(row.latencyMs, 'flywheel_validation_summary_invalid'),
  };
}

function parseValidationSummary(value: unknown): LearningValidationSummary | null {
  if (value === null || value === undefined) return null;
  const row = asObject(value);
  if (!row || typeof row.passed !== 'boolean') throw new Error('flywheel_validation_summary_invalid');
  const shadowPassed = row.shadowPassed;
  if (shadowPassed !== null && typeof shadowPassed !== 'boolean') {
    throw new Error('flywheel_validation_summary_invalid');
  }
  return {
    passed: row.passed,
    baseline: parseValidationMetrics(row.baseline),
    candidate: parseValidationMetrics(row.candidate),
    regressionCasesPassed: row.regressionCasesPassed === true,
    goldenCasesPassed: row.goldenCasesPassed === true,
    safetyPassed: row.safetyPassed === true,
    shadowPassed,
    reasons: readStringArray(row.reasons, 'flywheel_validation_summary_invalid'),
    evidenceRefs: readStringArray(row.evidenceRefs, 'flywheel_validation_summary_invalid'),
  };
}

export function mapPhase6ProposalRow(row: ProposalRow): LearningProposalRecord | null {
  const rootEvidence = asObject(row.evidence);
  const phase6 = asObject(rootEvidence?.phase6);
  if (!phase6 || phase6.phase !== 6) return null;

  const scopeObject = asObject(phase6.scope);
  if (!scopeObject) throw new Error('flywheel_scope_invalid');

  const scope: LearningScope = {
    organizationId: readString(scopeObject.organizationId, 'flywheel_scope_invalid'),
    agentId: readString(scopeObject.agentId, 'flywheel_scope_invalid'),
    capabilityId: readString(scopeObject.capabilityId, 'flywheel_scope_invalid'),
  };
  if (scope.organizationId !== row.organization_id) throw new Error('flywheel_tenant_mismatch');

  const evidence: LearningProposalEvidence = {
    phase: 6,
    status: parseLearningProposalStatus(phase6.status),
    proposalType: parseLearningProposalType(phase6.proposalType),
    fingerprint: readString(phase6.fingerprint, 'flywheel_fingerprint_invalid'),
    clusterId: readString(phase6.clusterId, 'flywheel_cluster_invalid'),
    signalRefs: readStringArray(phase6.signalRefs, 'flywheel_signal_refs_invalid'),
    candidateRef: readNullableString(phase6.candidateRef),
    validationRef: readNullableString(phase6.validationRef),
    validationSummary: parseValidationSummary(phase6.validationSummary),
    rolloutLevel:
      phase6.rolloutLevel === 'off' || phase6.rolloutLevel === 'shadow' || phase6.rolloutLevel === 'draft'
        ? phase6.rolloutLevel
        : null,
    rollbackTargetRef: readNullableString(phase6.rollbackTargetRef),
    rejectionReason: readNullableString(phase6.rejectionReason),
  };

  if (evidence.proposalType !== parseLearningProposalType(row.type)) {
    throw new Error('flywheel_proposal_type_mismatch');
  }

  return {
    id: row.id,
    scope,
    type: evidence.proposalType,
    content: row.content,
    evidence,
    appliedAt: row.applied_at,
    appliedVersionId: row.applied_version_id,
    appliedBy: row.applied_by,
  };
}

function toPhase6Evidence(record: LearningProposalRecord): JsonObject {
  return {
    phase: 6,
    scope: record.scope,
    status: record.evidence.status,
    proposalType: record.evidence.proposalType,
    fingerprint: record.evidence.fingerprint,
    clusterId: record.evidence.clusterId,
    signalRefs: [...new Set(record.evidence.signalRefs)].sort(),
    candidateRef: record.evidence.candidateRef,
    validationRef: record.evidence.validationRef,
    validationSummary: record.evidence.validationSummary ?? null,
    rolloutLevel: record.evidence.rolloutLevel,
    rollbackTargetRef: record.evidence.rollbackTargetRef,
    rejectionReason: record.evidence.rejectionReason,
  };
}

export function buildPhase6ProposalPersistence(
  record: LearningProposalRecord,
  existing: { evidence?: unknown; run_id?: string | null } | null,
): Record<string, unknown> {
  if (!record.id || !record.scope.organizationId) throw new Error('flywheel_scope_invalid');
  const rootEvidence = asObject(existing?.evidence) ?? {};
  const priorPhase6 = asObject(rootEvidence.phase6) ?? {};
  const evidence = {
    ...rootEvidence,
    phase6: { ...priorPhase6, ...toPhase6Evidence(record) },
  };
  return {
    id: record.id,
    organization_id: record.scope.organizationId,
    run_id: existing?.run_id ?? record.id,
    dataset: 'agent_os_phase_6',
    type: record.type,
    target: record.scope.capabilityId,
    content: record.content,
    evidence,
    applied_at: record.appliedAt,
    applied_version_id: record.appliedVersionId,
    applied_by: record.appliedBy,
  };
}

function isOpen(record: LearningProposalRecord): boolean {
  return !['rejected', 'rolled_back', 'closed'].includes(record.evidence.status) && record.appliedAt === null;
}

function matchesScope(record: LearningProposalRecord, scope: LearningScope): boolean {
  return (
    record.scope.agentId === scope.agentId &&
    (scope.capabilityId === '*' || record.scope.capabilityId === scope.capabilityId)
  );
}

export function createSupabaseLearningProposalStore(client: SupabaseClient): LearningProposalStore {
  return {
    async findOpenByFingerprint(scope, fingerprint) {
      const rows = await this.listForScope(scope);
      return rows.find((row) => row.evidence.fingerprint === fingerprint && isOpen(row)) ?? null;
    },

    async save(record) {
      const { data: existing, error: existingError } = await client
        .from('flywheel_distiller_proposals')
        .select('evidence, run_id')
        .eq('id', record.id)
        .eq('organization_id', record.scope.organizationId)
        .maybeSingle();
      if (existingError) throw new Error(`flywheel_store_load_failed:${existingError.message}`);

      const { error } = await client
        .from('flywheel_distiller_proposals')
        .upsert(buildPhase6ProposalPersistence(record, existing));
      if (error) throw new Error(`flywheel_store_save_failed:${error.message}`);
    },

    async load(scope, proposalId) {
      const { data, error } = await client
        .from('flywheel_distiller_proposals')
        .select(SELECT_COLUMNS)
        .eq('id', proposalId)
        .eq('organization_id', scope.organizationId)
        .maybeSingle();
      if (error) throw new Error(`flywheel_store_load_failed:${error.message}`);
      if (!data) return null;
      const mapped = mapPhase6ProposalRow(data as ProposalRow);
      return mapped && matchesScope(mapped, scope) ? mapped : null;
    },

    async listForScope(scope) {
      const { data, error } = await client
        .from('flywheel_distiller_proposals')
        .select(SELECT_COLUMNS)
        .eq('organization_id', scope.organizationId);
      if (error) throw new Error(`flywheel_store_list_failed:${error.message}`);
      return ((data ?? []) as ProposalRow[])
        .map(mapPhase6ProposalRow)
        .filter((row): row is LearningProposalRecord => row !== null)
        .filter((row) => matchesScope(row, scope));
    },
  };
}
