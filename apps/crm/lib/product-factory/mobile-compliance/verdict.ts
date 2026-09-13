import type { ComplianceFinding, ComplianceVerdict, RuntimeReviewReport } from "./contracts";

export function calculateComplianceVerdict(findings: readonly ComplianceFinding[], runtimeReview?: RuntimeReviewReport, runtimeRequired = false): ComplianceVerdict {
  if (findings.some((finding) => finding.verification === "VERIFIED" && (finding.severity === "CRITICAL" || finding.severity === "HIGH"))) return "BLOCK";
  if (runtimeReview?.status === "FAIL") return runtimeReview.evidenceRefs.length > 0 ? "BLOCK" : "NEEDS_REVIEW";
  if (runtimeRequired && (!runtimeReview || runtimeReview.status === "NOT_RUN" || runtimeReview.status === "INFRA_FAILURE" || runtimeReview.status === "NEEDS_REVIEW")) return "NEEDS_REVIEW";
  if (findings.some((finding) => finding.verification === "MANUAL_REVIEW")) return "NEEDS_REVIEW";
  if (findings.some((finding) => finding.severity === "MEDIUM" || finding.severity === "LOW" || finding.severity === "INFO")) return "PASS_WITH_WARNINGS";
  return "PASS";
}
