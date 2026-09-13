import type { MobileComplianceAuditInput } from "./guardian";
import { runMobileComplianceAudit } from "./guardian";
import { createPolicySnapshot } from "./policy";
import { MobileComplianceStore } from "./store";

export async function runAndPersistMobileComplianceAudit(input: MobileComplianceAuditInput, store: MobileComplianceStore) {
  const result = await runMobileComplianceAudit(input);
  const policy = createPolicySnapshot(result.report.store);
  await store.insertPolicySnapshot(input.organizationId, policy);

  // Child evidence/runtime/finding rows carry a composite tenant/report FK, so the
  // immutable parent report must exist first. Upserts are idempotent for retries.
  const report = await store.insertReport(result.report);
  if (result.report.runtimeReview) await store.insertRuntimeReview(input.organizationId, report.reportId, result.report.runtimeReview);
  await store.insertEvidence(input.organizationId, report.reportId, result.evidence);
  await store.insertFindings(input.organizationId, report.reportId, result.report.findings);

  return { ...result, report: { ...report, runtimeReview: result.report.runtimeReview } };
}
