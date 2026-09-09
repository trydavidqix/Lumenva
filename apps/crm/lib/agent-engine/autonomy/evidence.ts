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

export interface AutonomyEvidenceRecorder {
  record(entry: {
    runId: string;
    traceId: string;
    kind: string;
    payload?: Record<string, unknown>;
  }): Promise<void>;
}

export function buildAutonomyDecisionEvidence(
  input: AutonomyDecisionEvidence,
): AutonomyDecisionEvidence {
  return { ...input };
}

export async function recordAutonomyDecision(
  recorder: AutonomyEvidenceRecorder | undefined,
  evidence: AutonomyDecisionEvidence,
): Promise<void> {
  if (!recorder) return;
  await recorder.record({
    runId: evidence.runId,
    traceId: evidence.traceId,
    kind: 'autonomy_decision',
    payload: { ...evidence },
  });
}
