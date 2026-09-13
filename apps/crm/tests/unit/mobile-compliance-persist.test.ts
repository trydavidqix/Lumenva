import { describe, expect, it, vi } from "vitest";
import { runAndPersistMobileComplianceAudit } from "@/lib/product-factory/mobile-compliance/persist";
import type { MobileComplianceStore } from "@/lib/product-factory/mobile-compliance/store";

const snapshot = {
  files: {
    "package.json": JSON.stringify({ dependencies: { expo: "^55.0.0" } }),
    "app.json": JSON.stringify({ expo: { name: "Test" } }),
    "ios/Test/Info.plist": "<plist><dict><key>CFBundleName</key><string>Test</string></dict></plist>",
    "ios/Test/PrivacyInfo.xcprivacy": "<plist><dict/></plist>",
  },
  storeMetadata: { privacyPolicyUrl: "https://example.test/privacy", appPrivacyDeclared: true },
};

describe("mobile compliance persistence ordering", () => {
  it("persists parent report before FK-bound runtime, evidence and normalized findings", async () => {
    const order: string[] = [];
    const store = {
      insertPolicySnapshot: vi.fn(async () => { order.push("policy"); }),
      insertReport: vi.fn(async (report) => { order.push("report"); return report; }),
      insertRuntimeReview: vi.fn(async () => { order.push("runtime"); }),
      insertEvidence: vi.fn(async () => { order.push("evidence"); }),
      insertFindings: vi.fn(async () => { order.push("findings"); }),
    } as unknown as MobileComplianceStore;

    const result = await runAndPersistMobileComplianceAudit({
      organizationId: "org-1",
      projectId: "project-1",
      buildRef: "build-1",
      artifactRef: "artifact://ios",
      artifactHash: "a".repeat(64),
      platform: "IOS",
      snapshot,
      now: () => new Date("2026-09-13T12:00:00.000Z"),
    }, store);

    expect(result.report.reportId).toMatch(/^mobile-compliance:/);
    expect(order).toEqual(["policy", "report", "runtime", "evidence", "findings"]);
  });
});
