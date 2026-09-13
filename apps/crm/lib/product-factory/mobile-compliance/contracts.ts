export type MobilePlatform = "IOS" | "ANDROID";
export type MobileStore = "APP_STORE" | "PLAY_STORE";
export type ComplianceSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ComplianceVerdict = "PASS" | "PASS_WITH_WARNINGS" | "NEEDS_REVIEW" | "BLOCK";
export type FindingSource = "STATIC" | "AI" | "RUNTIME" | "METADATA";
export type FindingVerification = "VERIFIED" | "MANUAL_REVIEW";
export type RuntimeReviewStatus = "PASS" | "FAIL" | "NOT_RUN" | "INFRA_FAILURE" | "NEEDS_REVIEW";
export type MobileFramework = "NATIVE_IOS" | "NATIVE_ANDROID" | "REACT_NATIVE" | "EXPO" | "FLUTTER" | "UNKNOWN";

export type ProjectFileMap = Readonly<Record<string, string>>;

export interface StoreMetadataSnapshot {
  privacyPolicyUrl?: string;
  supportUrl?: string;
  accountDeletionUrl?: string;
  reviewNotes?: string;
  demoAccountProvided?: boolean;
  accountCreation?: boolean;
  requiresAuthentication?: boolean;
  usesSubscriptions?: boolean;
  dataSafetyDeclared?: boolean;
  appPrivacyDeclared?: boolean;
}

export interface MobileProjectSnapshot {
  files: ProjectFileMap;
  storeMetadata?: StoreMetadataSnapshot;
}

export interface ComplianceEvidence {
  evidenceId: string;
  ruleId: string;
  resource: string;
  line?: number;
  excerptHash: string;
  detector: string;
}

export interface ComplianceFinding {
  ruleId: string;
  platform: MobilePlatform;
  store: MobileStore;
  severity: ComplianceSeverity;
  source: FindingSource;
  verification: FindingVerification;
  title: string;
  description: string;
  resource: string;
  line?: number;
  evidenceRefs: string[];
  fingerprint: string;
  autofixable: boolean;
}

export interface ComplianceRule {
  id: string;
  platform: MobilePlatform;
  store: MobileStore;
  severity: ComplianceSeverity;
  category: string;
  description: string;
  deterministic: boolean;
}

export interface PolicySnapshot {
  provider: "APPLE" | "GOOGLE";
  version: string;
  retrievedAt: string;
  sourceRefs: string[];
  rulesHash: string;
  rules: readonly ComplianceRule[];
}

export interface FrameworkDetection {
  framework: MobileFramework;
  hasIos: boolean;
  hasAndroid: boolean;
  evidenceRefs: string[];
}

export interface RuntimeReviewReport {
  runtimeReviewId: string;
  platform: MobilePlatform;
  status: RuntimeReviewStatus;
  evidenceRefs: string[];
  steps: ReadonlyArray<{ name: string; status: "PASS" | "FAIL" | "SKIP"; evidenceRefs: string[] }>;
  createdAt: string;
}

export interface MobileComplianceReport {
  reportId: string;
  organizationId: string;
  projectId: string;
  buildRef: string;
  artifactRef: string;
  artifactHash: string;
  platform: MobilePlatform;
  store: MobileStore;
  policyVersion: string;
  policySnapshotHash: string;
  findings: ComplianceFinding[];
  evidenceRefs: string[];
  runtimeReview?: RuntimeReviewReport;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  verdict: ComplianceVerdict;
  createdAt: string;
}

export function expectedStoreForPlatform(platform: MobilePlatform): MobileStore {
  return platform === "IOS" ? "APP_STORE" : "PLAY_STORE";
}

export function validateMobileComplianceReport(report: MobileComplianceReport): string[] {
  const errors: string[] = [];
  if (report.store !== expectedStoreForPlatform(report.platform)) errors.push("mobile compliance platform/store mismatch");
  if (!report.reportId) errors.push("mobile compliance reportId is required");
  if (!report.organizationId) errors.push("mobile compliance organizationId is required");
  if (!report.projectId) errors.push("mobile compliance projectId is required");
  if (!report.buildRef) errors.push("mobile compliance buildRef is required");
  if (!report.artifactRef) errors.push("mobile compliance artifactRef is required");
  if (!report.artifactHash) errors.push("mobile compliance artifactHash is required");
  if (!report.policyVersion) errors.push("mobile compliance policyVersion is required");
  if (!report.policySnapshotHash) errors.push("mobile compliance policySnapshotHash is required");
  for (const finding of report.findings) {
    if (finding.verification === "VERIFIED" && finding.evidenceRefs.length === 0) errors.push(`verified finding ${finding.ruleId} requires evidence`);
  }
  return errors;
}
