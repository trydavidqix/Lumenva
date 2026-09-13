export const LEARNING_PROPOSAL_TYPES = [
  'skill_change',
  'routing_change',
  'eval_case',
  'operational_threshold',
  'prompt_change',
  'workflow_change',
  'agent_definition_change',
  'model_policy_change',
  'resource_route_change',
  'memory_policy_change',
  'context_policy_change',
  'infra_change',
  'strategy_change',
] as const;

export type LearningProposalType = (typeof LEARNING_PROPOSAL_TYPES)[number];

export const LEARNING_PROPOSAL_STATUSES = [
  'detected',
  'clustered',
  'candidate_created',
  'validating',
  'rejected_by_validation',
  'ready_for_human_review',
  'approved',
  'rejected',
  'revision_requested',
  'rolling_out_shadow',
  'rolling_out_draft',
  'monitoring',
  'rollback_recommended',
  'rolled_back',
  'closed',
] as const;

export type LearningProposalStatus = (typeof LEARNING_PROPOSAL_STATUSES)[number];

const proposalTypeSet = new Set<string>(LEARNING_PROPOSAL_TYPES);
const proposalStatusSet = new Set<string>(LEARNING_PROPOSAL_STATUSES);

export function parseLearningProposalType(value: unknown): LearningProposalType {
  if (typeof value !== 'string' || !proposalTypeSet.has(value)) {
    throw new Error('flywheel_proposal_type_not_allowed');
  }
  return value as LearningProposalType;
}

export function parseLearningProposalStatus(value: unknown): LearningProposalStatus {
  if (typeof value !== 'string' || !proposalStatusSet.has(value)) {
    throw new Error('flywheel_status_invalid');
  }
  return value as LearningProposalStatus;
}

export interface LearningScope {
  organizationId: string;
  agentId: string;
  capabilityId: string;
}

export interface LearningValidationMetrics {
  accuracy: number;
  policyCompliance: number;
  escalationCorrectness: number;
  failureRate: number;
  loopStopRate: number;
  costCents: number;
  latencyMs: number;
}

export interface LearningValidationSummary {
  passed: boolean;
  baseline: LearningValidationMetrics;
  candidate: LearningValidationMetrics;
  regressionCasesPassed: boolean;
  goldenCasesPassed: boolean;
  safetyPassed: boolean;
  shadowPassed: boolean | null;
  reasons: string[];
  evidenceRefs: string[];
}

export interface LearningProposalEvidence {
  phase: 6;
  status: LearningProposalStatus;
  proposalType: LearningProposalType;
  fingerprint: string;
  clusterId: string;
  signalRefs: string[];
  candidateRef: string | null;
  validationRef: string | null;
  validationSummary?: LearningValidationSummary | null;
  rolloutLevel: 'off' | 'shadow' | 'draft' | null;
  rollbackTargetRef: string | null;
  rejectionReason: string | null;
}

export interface LearningProposalRecord {
  id: string;
  scope: LearningScope;
  type: LearningProposalType;
  content: string;
  evidence: LearningProposalEvidence;
  appliedAt: string | null;
  appliedVersionId: string | null;
  appliedBy: string | null;
}

export interface LearningProposalStore {
  findOpenByFingerprint(
    scope: LearningScope,
    fingerprint: string,
  ): Promise<LearningProposalRecord | null>;
  save(record: LearningProposalRecord): Promise<void>;
  load(scope: LearningScope, proposalId: string): Promise<LearningProposalRecord | null>;
  listForScope(scope: LearningScope): Promise<LearningProposalRecord[]>;
}

export function sameLearningScope(a: LearningScope, b: LearningScope): boolean {
  return (
    a.organizationId === b.organizationId &&
    a.agentId === b.agentId &&
    a.capabilityId === b.capabilityId
  );
}
