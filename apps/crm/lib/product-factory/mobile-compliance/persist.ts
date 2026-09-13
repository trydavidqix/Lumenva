import type { MobileComplianceAuditInput } from "./guardian";
import { runMobileComplianceAudit } from "./guardian";
import { createPolicySnapshot } from "./policy";
import { MobileComplianceStore } from "./store";

export async function runAndPersistMobileComplianceAudit(input: MobileComplianceAuditInput, store: MobileComplianceStore) {
  const result = await runMobileComplianceAudit(input);
  const policy = createPolicySnapshot(result.report.store);
  await store.insertPolicySnapshot(input.organizationId, policy);
  await store.insertRuntimeReview(input.organizationId, result.report.reportId, result.report.runtimeReview!);
  await store.insertEvidence(input.organizationId, result.report.reportId, result.evidence);
  const report = await store.insertReport(result.report);
  return { ...result, report };
}
