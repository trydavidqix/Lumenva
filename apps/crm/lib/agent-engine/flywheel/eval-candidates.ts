import { createHash } from 'node:crypto';
import type { LearningScope } from './contracts';
import type { LearningCluster } from './clustering';

export interface EvalCaseCandidate {
  id: string;
  scope: LearningScope;
  sourceClusterId: string;
  fingerprint: string;
  inputRef: string;
  expectedBehavior: string;
  safetyInvariant: string | null;
}

export interface EvalDatasetAdmission {
  containsFingerprint(fingerprint: string): Promise<boolean>;
  admit(candidate: EvalCaseCandidate): Promise<{ admitted: boolean; reason: string }>;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function buildEvalCaseCandidate(cluster: LearningCluster): EvalCaseCandidate {
  const inputRef = [...cluster.signalRefs].sort()[0];
  if (!inputRef) throw new Error('flywheel_eval_candidate_missing_evidence');
  const fingerprint = hash([
    cluster.scope.organizationId,
    cluster.scope.agentId,
    cluster.scope.capabilityId,
    cluster.failureType,
    cluster.id,
  ].join('|'));
  return {
    id: `eval-${fingerprint.slice(0, 24)}`,
    scope: cluster.scope,
    sourceClusterId: cluster.id,
    fingerprint,
    inputRef,
    expectedBehavior: `avoid_repeat:${cluster.failureType}`,
    safetyInvariant: 'preserve_existing_policy_and_escalation_guards',
  };
}

function containsRawPii(value: string): boolean {
  return /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(value) || /\+?\d[\d\s().-]{7,}\d/.test(value);
}

export async function admitEvalCaseCandidate(
  dataset: EvalDatasetAdmission,
  candidate: EvalCaseCandidate,
): Promise<{ admitted: boolean; reason: string }> {
  if (!candidate.fingerprint || !candidate.inputRef || !candidate.expectedBehavior) {
    throw new Error('flywheel_eval_candidate_invalid');
  }
  if (containsRawPii(candidate.inputRef) || containsRawPii(candidate.expectedBehavior)) {
    throw new Error('flywheel_eval_candidate_raw_pii');
  }
  if (await dataset.containsFingerprint(candidate.fingerprint)) {
    return { admitted: false, reason: 'duplicate_fingerprint' };
  }
  return dataset.admit(candidate);
}
