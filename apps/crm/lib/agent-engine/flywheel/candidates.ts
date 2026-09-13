import { randomUUID } from 'node:crypto';

export { buildHermesCandidateManifest } from '../hermes/candidate-manifest';
export type { HermesCandidateManifest } from '../hermes/candidate-manifest';

export type LearningCandidate =
  | { kind: 'skill_change'; candidateId: string; baseVersionId: string; candidateVersionId: string; rollbackVersionId: string }
  | { kind: 'routing_change'; candidateId: string; provider: string; model: string; skillVersionId: string | null; certificationEvidenceRef: string }
  | { kind: 'operational_threshold'; candidateId: string; key: string; previousValue: number; candidateValue: number };

export interface CertifiedRoutingLookup {
  assertCertified(input: { provider: string; model: string }): { evidenceRef: string };
}

function assertNoAuthorityFields(input: Record<string, unknown>): void {
  const forbidden = ['autonomyLevel', 'security', 'policyPermission', 'secret', 'rls'];
  if (forbidden.some((key) => key in input)) throw new Error('flywheel_candidate_forbidden_field');
}

export function buildSkillCandidate(input: { baseVersionId: string; candidateVersionId: string }): Extract<LearningCandidate, { kind: 'skill_change' }> {
  assertNoAuthorityFields(input as Record<string, unknown>);
  if (!input.baseVersionId || !input.candidateVersionId || input.baseVersionId === input.candidateVersionId) {
    throw new Error('flywheel_skill_candidate_invalid');
  }
  return {
    kind: 'skill_change',
    candidateId: randomUUID(),
    baseVersionId: input.baseVersionId,
    candidateVersionId: input.candidateVersionId,
    rollbackVersionId: input.baseVersionId,
  };
}

export function buildRoutingCandidate(input: {
  provider: string;
  model: string;
  skillVersionId: string | null;
  lookup: CertifiedRoutingLookup;
}): Extract<LearningCandidate, { kind: 'routing_change' }> {
  assertNoAuthorityFields(input as unknown as Record<string, unknown>);
  if (!input.provider || !input.model) throw new Error('flywheel_routing_candidate_invalid');
  const certified = input.lookup.assertCertified({ provider: input.provider, model: input.model });
  if (!certified.evidenceRef) throw new Error('flywheel_routing_not_certified');
  return {
    kind: 'routing_change',
    candidateId: randomUUID(),
    provider: input.provider,
    model: input.model,
    skillVersionId: input.skillVersionId,
    certificationEvidenceRef: certified.evidenceRef,
  };
}

export function buildOperationalThresholdCandidate(input: {
  key: string;
  previousValue: number;
  candidateValue: number;
}): Extract<LearningCandidate, { kind: 'operational_threshold' }> {
  assertNoAuthorityFields(input as Record<string, unknown>);
  if (!input.key || !Number.isFinite(input.previousValue) || !Number.isFinite(input.candidateValue)) {
    throw new Error('flywheel_threshold_candidate_invalid');
  }
  return { kind: 'operational_threshold', candidateId: randomUUID(), ...input };
}
