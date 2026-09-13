import { createHash } from "node:crypto";
import type { ComplianceEvidence, ComplianceFinding, MobileComplianceReport, MobilePlatform, MobileProjectSnapshot, MobileStore } from "./contracts";
import { expectedStoreForPlatform, validateMobileComplianceReport } from "./contracts";
import { detectMobileFramework } from "./detector";
import { createFinding, dedupeFindings } from "./evidence";
import { createPolicySnapshot } from "./policy";
import { auditStoreMetadata, scanApple, scanGoogle } from "./scanners";
import { runRuntimeReview, type RuntimeReviewAdapter } from "./runtime";
import { calculateComplianceVerdict } from "./verdict";

export interface AiAuditInput {
  platform: MobilePlatform;
  store: MobileStore;
  snapshot: MobileProjectSnapshot;
  deterministicFindings: readonly ComplianceFinding[];
}
export interface AiComplianceAuditor { audit(input: AiAuditInput): Promise<ComplianceFinding[]> }

export interface MobileComplianceAuditInput {
  organizationId: string;
  projectId: string;
  buildRef: string;
  artifactRef: string;
  artifactHash: string;
  platform: MobilePlatform;
  store?: MobileStore;
  snapshot: MobileProjectSnapshot;
  runtimeRequired?: boolean;
  runtimeAdapter?: RuntimeReviewAdapter;
  aiAuditor?: AiComplianceAuditor;
  now?: () => Date;
}

function counts(findings: readonly ComplianceFinding[]) {
  return {
    criticalCount: findings.filter((finding) => finding.severity === "CRITICAL").length,
    highCount: findings.filter((finding) => finding.severity === "HIGH").length,
    mediumCount: findings.filter((finding) => finding.severity === "MEDIUM").length,
    lowCount: findings.filter((finding) => finding.severity === "LOW").length,
  };
}

function reportId(input: MobileComplianceAuditInput, policyHash: string): string {
  return `mobile-compliance:${createHash("sha256").update([input.organizationId, input.projectId, input.buildRef, input.artifactHash, policyHash].join("\u0000")).digest("hex")}`;
}

export async function runMobileComplianceAudit(input: MobileComplianceAuditInput): Promise<{ report: MobileComplianceReport; evidence: ComplianceEvidence[] }> {
  const store = input.store ?? expectedStoreForPlatform(input.platform);
  if (store !== expectedStoreForPlatform(input.platform)) throw new Error("mobile compliance platform/store mismatch");
  if (!input.organizationId || !input.projectId || !input.buildRef || !input.artifactRef || !input.artifactHash) throw new Error("mobile compliance build identity is incomplete");
  const framework = detectMobileFramework(input.snapshot);
  if (input.platform === "IOS" && !framework.hasIos) throw new Error("project snapshot does not expose an iOS target");
  if (input.platform === "ANDROID" && !framework.hasAndroid) throw new Error("project snapshot does not expose an Android target");

  const policy = createPolicySnapshot(store);
  const staticResult = input.platform === "IOS" ? scanApple(input.snapshot) : scanGoogle(input.snapshot);
  const metadataResult = auditStoreMetadata(input.platform, input.snapshot);
  const evidence = [...staticResult.evidence, ...metadataResult.evidence];
  let findings = dedupeFindings([...staticResult.findings, ...metadataResult.findings]);

  if (input.aiAuditor) {
    const candidates = await input.aiAuditor.audit({ platform: input.platform, store, snapshot: input.snapshot, deterministicFindings: findings });
    const normalized = candidates.map((candidate) => candidate.evidenceRefs.length > 0 ? candidate : createFinding({ ...candidate, source: "AI", verification: "MANUAL_REVIEW", evidenceRefs: [] }));
    findings = dedupeFindings([...findings, ...normalized]);
  }

  const runtimeReview = await runRuntimeReview({ organizationId: input.organizationId, projectId: input.projectId, buildRef: input.buildRef, artifactRef: input.artifactRef, artifactHash: input.artifactHash, platform: input.platform, snapshot: input.snapshot }, input.runtimeAdapter);
  if (runtimeReview.status === "FAIL") {
    findings = dedupeFindings([...findings, createFinding({ ruleId: `${store}.RUNTIME.CRITICAL_FLOW`, platform: input.platform, store, severity: "CRITICAL", source: "RUNTIME", title: "Runtime review failed", description: "At least one critical release flow failed during runtime review.", resource: "runtime-review", evidenceRefs: [...runtimeReview.evidenceRefs], verification: runtimeReview.evidenceRefs.length ? "VERIFIED" : "MANUAL_REVIEW" })]);
  }

  const verdict = calculateComplianceVerdict(findings, runtimeReview, input.runtimeRequired ?? false);
  const report: MobileComplianceReport = {
    reportId: reportId(input, policy.rulesHash), organizationId: input.organizationId, projectId: input.projectId,
    buildRef: input.buildRef, artifactRef: input.artifactRef, artifactHash: input.artifactHash,
    platform: input.platform, store, policyVersion: policy.version, policySnapshotHash: policy.rulesHash,
    findings, evidenceRefs: [...new Set([...evidence.map((item) => item.evidenceId), ...findings.flatMap((finding) => finding.evidenceRefs), ...runtimeReview.evidenceRefs])],
    runtimeReview, ...counts(findings), verdict, createdAt: (input.now ?? (() => new Date()))().toISOString(),
  };
  const errors = validateMobileComplianceReport(report);
  if (errors.length) throw new Error(`invalid mobile compliance report: ${errors.join("; ")}`);
  return { report, evidence };
}
