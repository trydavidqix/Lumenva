import type { AgentAutonomyLevel } from '../policies/engine';
import type { CapabilityRiskTier } from './risk-registry';

export interface AutonomyDecisionEvidence {
  organizationId: string;
  agentId: string;
  runId: string;
  capabilityId: string;
  autonomyLevel: AgentAutonomyLevel;
  riskTier: CapabilityRiskTier;
  promotionEvidenceRef: string | null;
  policyOutcome: string;
  approvalId: string | null;
  approvalStatus: string | null;
  executionOutcome: string;
  traceId: string;
  correlationId: string;
}

export function buildAutonomyDecisionEvidence(
  input: AutonomyDecisionEvidence,
): AutonomyDecisionEvidence {
  return { ...input };
}
