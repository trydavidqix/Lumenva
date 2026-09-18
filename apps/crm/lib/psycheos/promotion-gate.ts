export type EvalCaseResult = Readonly<{
  caseId: string;
  status: "PASS" | "FAIL";
  evidenceRef: string;
}>;

export type PromotionGateResult = Readonly<{
  status: "ALLOW" | "DENY";
  reason: "ALL_EVALS_PASS" | "EVAL_FAILURE" | "MISSING_EVIDENCE";
  failedCases: readonly string[];
}>;

/** Fail-closed promotion boundary: eval output never grants authority by itself. */
export function evaluatePromotionGate(
  results: readonly EvalCaseResult[],
): PromotionGateResult {
  if (results.length === 0) {
    return { status: "DENY", reason: "MISSING_EVIDENCE", failedCases: [] };
  }
  const missingEvidence = results.filter((result) => !result.evidenceRef.trim());
  if (missingEvidence.length > 0) {
    return {
      status: "DENY",
      reason: "MISSING_EVIDENCE",
      failedCases: missingEvidence.map((result) => result.caseId),
    };
  }
  const failedCases = results
    .filter((result) => result.status !== "PASS")
    .map((result) => result.caseId);
  return failedCases.length > 0
    ? { status: "DENY", reason: "EVAL_FAILURE", failedCases }
    : { status: "ALLOW", reason: "ALL_EVALS_PASS", failedCases: [] };
}
