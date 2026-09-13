import { describe, expect, it } from "vitest";
import { calculateComplianceVerdict, createFinding, detectMobileFramework, runMobileComplianceAudit, validateMobileComplianceReport, type MobileComplianceReport, type MobileProjectSnapshot, type RuntimeReviewReport } from "@/lib/product-factory/mobile-compliance";

const iosSnapshot: MobileProjectSnapshot = {
  files: {
    "package.json": JSON.stringify({ dependencies: { expo: "^55.0.0" } }),
    "app.json": JSON.stringify({ expo: { name: "Test" } }),
    "ios/Test/Info.plist": "<plist><dict><key>CFBundleName</key><string>Test</string></dict></plist>",
    "ios/Test/PrivacyInfo.xcprivacy": "<plist><dict/></plist>",
    "src/settings.ts": "export async function deleteAccount() { return true }",
    "src/purchases.ts": "export async function restorePurchases() { return true }",
  },
  storeMetadata: { privacyPolicyUrl: "https://example.test/privacy", supportUrl: "https://example.test/support", accountCreation: true, usesSubscriptions: true, requiresAuthentication: true, demoAccountProvided: true, appPrivacyDeclared: true },
};

const androidSnapshot: MobileProjectSnapshot = {
  files: {
    "package.json": JSON.stringify({ dependencies: { "react-native": "0.82.0", "react-native-purchases": "1.0.0" } }),
    "android/app/src/main/AndroidManifest.xml": "<manifest><application><activity android:name=\".MainActivity\" android:exported=\"true\"><intent-filter><action android:name=\"android.intent.action.MAIN\"/></intent-filter></activity></application></manifest>",
    "android/app/build.gradle": "implementation 'com.android.billingclient:billing:8.0.0'",
    "src/account.ts": "export async function deleteAccount() { return true }",
  },
  storeMetadata: { privacyPolicyUrl: "https://example.test/privacy", supportUrl: "https://example.test/support", accountCreation: true, accountDeletionUrl: "https://example.test/delete-account", usesSubscriptions: true, dataSafetyDeclared: true },
};

describe("Mobile Compliance Guardian", () => {
  it("detects Expo projects deterministically", () => {
    expect(detectMobileFramework(iosSnapshot)).toMatchObject({ framework: "EXPO", hasIos: true, hasAndroid: true });
  });

  it("rejects platform/store mismatches in the report contract", () => {
    const report = { reportId: "r", organizationId: "o", projectId: "p", buildRef: "b", artifactRef: "a", artifactHash: "h", platform: "IOS", store: "PLAY_STORE", policyVersion: "v", policySnapshotHash: "ph", findings: [], evidenceRefs: [], criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, verdict: "PASS", createdAt: new Date(0).toISOString() } as unknown as MobileComplianceReport;
    expect(validateMobileComplianceReport(report)).toContain("mobile compliance platform/store mismatch");
  });

  it("blocks a verified high-severity finding but not an unverified one", () => {
    const verified = createFinding({ ruleId: "TEST", platform: "IOS", store: "APP_STORE", severity: "HIGH", source: "STATIC", title: "x", description: "x", resource: "x", evidenceRefs: ["e"] });
    const manual = { ...verified, verification: "MANUAL_REVIEW" as const };
    expect(calculateComplianceVerdict([verified])).toBe("BLOCK");
    expect(calculateComplianceVerdict([manual])).toBe("NEEDS_REVIEW");
  });

  it("does not allow an AI auditor to forge an evidence reference into a hard block", async () => {
    const aiFinding = createFinding({ ruleId: "AI.FORGED", platform: "IOS", store: "APP_STORE", severity: "CRITICAL", source: "AI", title: "forged", description: "untrusted evidence", resource: "src/app.ts", evidenceRefs: ["evidence:forged"] });
    const { report } = await runMobileComplianceAudit({ organizationId: "org-1", projectId: "project-1", buildRef: "build-ai", artifactRef: "artifact://ios-ai", artifactHash: "d".repeat(64), platform: "IOS", snapshot: iosSnapshot, aiAuditor: { audit: async () => [aiFinding] } });
    const stored = report.findings.find((finding) => finding.ruleId === "AI.FORGED");
    expect(stored?.verification).toBe("MANUAL_REVIEW");
    expect(report.verdict).toBe("NEEDS_REVIEW");
  });

  it("requires evidence before a runtime failure becomes a hard block", () => {
    const withoutEvidence: RuntimeReviewReport = { runtimeReviewId: "runtime-1", platform: "IOS", status: "FAIL", evidenceRefs: [], steps: [{ name: "launch", status: "FAIL", evidenceRefs: [] }], createdAt: new Date(0).toISOString() };
    const withEvidence: RuntimeReviewReport = { ...withoutEvidence, runtimeReviewId: "runtime-2", evidenceRefs: ["runtime:evidence:launch"] };
    expect(calculateComplianceVerdict([], withoutEvidence, true)).toBe("NEEDS_REVIEW");
    expect(calculateComplianceVerdict([], withEvidence, true)).toBe("BLOCK");
  });

  it("produces a passing iOS report for a compliant supplied snapshot", async () => {
    const { report } = await runMobileComplianceAudit({ organizationId: "org-1", projectId: "project-1", buildRef: "build-1", artifactRef: "artifact://ios", artifactHash: "a".repeat(64), platform: "IOS", snapshot: iosSnapshot });
    expect(report.verdict).toBe("PASS");
    expect(report.store).toBe("APP_STORE");
    expect(report.policySnapshotHash).toHaveLength(64);
  });

  it("blocks Android account creation when the external deletion URL is missing", async () => {
    const snapshot = { ...androidSnapshot, storeMetadata: { ...androidSnapshot.storeMetadata, accountDeletionUrl: undefined } };
    const { report } = await runMobileComplianceAudit({ organizationId: "org-1", projectId: "project-1", buildRef: "build-2", artifactRef: "artifact://android", artifactHash: "b".repeat(64), platform: "ANDROID", snapshot });
    expect(report.verdict).toBe("BLOCK");
    expect(report.findings.map((finding) => finding.ruleId)).toContain("GOOGLE.ACCOUNT.DELETE");
  });

  it("keeps runtime-required releases in review when no runtime adapter ran", async () => {
    const { report } = await runMobileComplianceAudit({ organizationId: "org-1", projectId: "project-1", buildRef: "build-3", artifactRef: "artifact://ios", artifactHash: "c".repeat(64), platform: "IOS", snapshot: iosSnapshot, runtimeRequired: true });
    expect(report.verdict).toBe("NEEDS_REVIEW");
    expect(report.runtimeReview?.status).toBe("NOT_RUN");
  });
});
