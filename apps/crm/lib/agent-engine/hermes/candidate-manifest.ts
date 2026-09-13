import { createHash } from 'node:crypto';

import type { LearningProposalType, LearningScope } from '../flywheel/contracts';

export type HermesCandidateRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface HermesCandidateManifest {
  id: string;
  version: number;
  scope: LearningScope;
  type: LearningProposalType;
  currentStateRef: string;
  proposedStateRef: string;
  hypothesis: string;
  expectedBenefit: string;
  knownRegressions: string[];
  riskClass: HermesCandidateRisk;
  costEstimateCents: number | null;
  evidenceRefs: string[];
  rollbackTargetRef: string;
  requiredEvalSuite: string[];
  promotionPolicy: string;
  contentFingerprint: string;
}

const FORBIDDEN_AUTHORITY_FIELDS = [
  'autonomyLevel',
  'security',
  'policyPermission',
  'secret',
  'rls',
  'capabilityGrant',
] as const;

function normalizeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function assertNoAuthorityFields(input: Record<string, unknown>): void {
  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    if (field in input) throw new Error('hermes_candidate_forbidden_authority_field');
  }
}

export function buildHermesCandidateManifest(
  input: Omit<HermesCandidateManifest, 'contentFingerprint'> & Record<string, unknown>,
): HermesCandidateManifest {
  assertNoAuthorityFields(input);
  if (!input.id || !Number.isInteger(input.version) || input.version < 1) {
    throw new Error('hermes_candidate_identity_invalid');
  }
  if (!input.currentStateRef || !input.proposedStateRef || !input.rollbackTargetRef) {
    throw new Error('hermes_candidate_state_refs_required');
  }
  if (!input.hypothesis || !input.expectedBenefit || !input.promotionPolicy) {
    throw new Error('hermes_candidate_rationale_required');
  }
  if (input.costEstimateCents !== null && (!Number.isInteger(input.costEstimateCents) || input.costEstimateCents < 0)) {
    throw new Error('hermes_candidate_cost_invalid');
  }

  const canonical = {
    id: input.id,
    version: input.version,
    scope: input.scope,
    type: input.type,
    currentStateRef: input.currentStateRef,
    proposedStateRef: input.proposedStateRef,
    hypothesis: input.hypothesis,
    expectedBenefit: input.expectedBenefit,
    knownRegressions: normalizeStrings(input.knownRegressions),
    riskClass: input.riskClass,
    costEstimateCents: input.costEstimateCents,
    evidenceRefs: normalizeStrings(input.evidenceRefs),
    rollbackTargetRef: input.rollbackTargetRef,
    requiredEvalSuite: normalizeStrings(input.requiredEvalSuite),
    promotionPolicy: input.promotionPolicy,
  } satisfies Omit<HermesCandidateManifest, 'contentFingerprint'>;

  return {
    ...canonical,
    contentFingerprint: createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex'),
  };
}
