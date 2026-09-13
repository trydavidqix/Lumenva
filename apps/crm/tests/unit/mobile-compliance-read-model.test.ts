import { describe, expect, it, vi } from "vitest";
import { createMobileComplianceReadModel, type MobileComplianceRepository } from "@/lib/product-factory/mobile-compliance/read-model";

const report = {
  reportId: "report-1",
  organizationId: "org-1",
  projectId: "project-1",
  buildRef: "build-1",
  artifactRef: "artifact://ios",
  artifactHash: "a".repeat(64),
  platform: "IOS" as const,
  store: "APP_STORE" as const,
  policyVersion: "apple-policy",
  policySnapshotHash: "b".repeat(64),
  findings: [],
  evidenceRefs: [],
  criticalCount: 0,
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
  verdict: "PASS" as const,
  createdAt: "2026-09-13T12:00:00.000Z",
};

describe("mobile compliance read model", () => {
  it("always scopes list queries to the trusted organization id", async () => {
    const list = vi.fn(async () => [report]);
    const repo = { listReports: list, getReport: vi.fn(), listFindings: vi.fn() } as unknown as MobileComplianceRepository;
    const model = createMobileComplianceReadModel(repo);

    await expect(model.listReports("org-1", { projectId: "project-1", verdict: "PASS", limit: 500 })).resolves.toEqual([report]);
    expect(list).toHaveBeenCalledWith({ organizationId: "org-1", projectId: "project-1", verdict: "PASS", limit: 100 });
  });

  it("loads report details and findings through the same tenant scope", async () => {
    const getReport = vi.fn(async () => report);
    const listFindings = vi.fn(async () => []);
    const repo = { listReports: vi.fn(), getReport, listFindings } as unknown as MobileComplianceRepository;
    const model = createMobileComplianceReadModel(repo);

    await expect(model.getReport("org-1", "report-1")).resolves.toEqual({ report, findings: [] });
    expect(getReport).toHaveBeenCalledWith({ organizationId: "org-1", reportId: "report-1" });
    expect(listFindings).toHaveBeenCalledWith({ organizationId: "org-1", reportId: "report-1" });
  });

  it("does not query findings when the report does not exist in the tenant", async () => {
    const listFindings = vi.fn();
    const repo = { listReports: vi.fn(), getReport: vi.fn(async () => null), listFindings } as unknown as MobileComplianceRepository;
    const model = createMobileComplianceReadModel(repo);

    await expect(model.getReport("org-1", "missing")).resolves.toBeNull();
    expect(listFindings).not.toHaveBeenCalled();
  });
});
