import type { ExecutionResult, RiskLevel } from './execution-port';

export interface ReviewInput {
  implementation: ExecutionResult;
  reviewer_provider: string;
  reviewer_model?: string;
  risk: RiskLevel;
  deterministic_checks?: Array<{ name: string; passed: boolean; evidence?: string }>;
}

export interface ReviewResult {
  task_id: string;
  accepted: boolean;
  reviewer_provider: string;
  reviewer_model?: string;
  deterministic_passed: boolean;
  reasons: string[];
  evidence_refs: string[];
}

export function evaluateIndependentReview(input: ReviewInput): ReviewResult {
  const reasons: string[] = [];
  const checks = input.deterministic_checks ?? [];
  const deterministicPassed = checks.every((check) => check.passed);
  const implementationProvider = input.implementation.provider;

  if (implementationProvider && implementationProvider === input.reviewer_provider) {
    reasons.push('reviewer_must_be_independent_from_implementer');
  }
  if (!deterministicPassed) reasons.push('deterministic_check_failed');
  if (input.implementation.status !== 'success') reasons.push(`implementation_status_${input.implementation.status}`);
  if (input.implementation.tests.length === 0 && input.risk !== 'R0') reasons.push('missing_tests');
  if (!input.implementation.evidence) reasons.push('missing_evidence');

  return {
    task_id: input.implementation.task_id,
    accepted: reasons.length === 0,
    reviewer_provider: input.reviewer_provider,
    reviewer_model: input.reviewer_model,
    deterministic_passed: deterministicPassed,
    reasons,
    evidence_refs: [
      input.implementation.evidence,
      ...(input.implementation.artifacts ?? []),
      ...checks.flatMap((check) => check.evidence ? [check.evidence] : []),
    ].filter(Boolean),
  };
}
