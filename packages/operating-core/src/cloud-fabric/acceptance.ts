import type { ExecutionResult, RiskLevel } from './execution-port';
import type { ReviewResult } from './independent-review';

export interface AcceptanceDecision {
  accepted: boolean;
  needs_owner_approval: boolean;
  reasons: string[];
}

export function decideAcceptance(
  execution: ExecutionResult,
  review: ReviewResult | undefined,
  risk: RiskLevel,
): AcceptanceDecision {
  const reasons: string[] = [];
  if (execution.status !== 'success') reasons.push(`execution_${execution.status}`);
  if (risk !== 'R0' && execution.tests.length === 0) reasons.push('tests_required');
  if ((risk === 'R2' || risk === 'R3' || risk === 'R4') && !review?.accepted) {
    reasons.push('independent_review_required');
  }
  const needsOwnerApproval = risk === 'R3' || risk === 'R4';

  return {
    accepted: reasons.length === 0 && !needsOwnerApproval,
    needs_owner_approval: needsOwnerApproval,
    reasons,
  };
}
