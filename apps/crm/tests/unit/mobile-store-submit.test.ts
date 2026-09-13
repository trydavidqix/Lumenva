import { describe, expect, it, vi } from "vitest";
import { executeApprovedMobileStoreSubmission, type MobileStoreApproval } from "@/lib/product-factory/mobile-compliance/submit";

const base = {
  organizationId: "org-1",
  projectId: "project-1",
  buildRef: "build-1",
  artifactRef: "artifact://ios/1",
  artifactHash: "a".repeat(64),
  platform: "IOS" as const,
  store: "APP_STORE" as const,
  complianceReportRef: "report-1",
  runtimeReviewRef: "runtime-1",
  approvalId: "approval-1",
  actorId: "agent-1",
};

function approval(overrides: Partial<MobileStoreApproval> = {}): MobileStoreApproval {
  return {
    id: "approval-1",
    organizationId: "org-1",
    status: "approved",
    toolName: "mobile_store_submit",
    payloadHash: "",
    ...overrides,
  };
}

describe("approved mobile store submission boundary", () => {
  it("rejects execution when the approval is missing or not approved", async () => {
    const adapter = { submit: vi.fn() };
    await expect(executeApprovedMobileStoreSubmission(base, { getApproval: async () => null }, adapter)).rejects.toThrow("mobile_store_submit_approval_required");
    await expect(executeApprovedMobileStoreSubmission(base, { getApproval: async () => approval({ status: "pending" }) }, adapter)).rejects.toThrow("mobile_store_submit_approval_required");
    expect(adapter.submit).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant approvals", async () => {
    const adapter = { submit: vi.fn() };
    await expect(executeApprovedMobileStoreSubmission(base, { getApproval: async () => approval({ organizationId: "org-2" }) }, adapter)).rejects.toThrow("mobile_store_submit_approval_scope_mismatch");
  });

  it("rejects approvals issued for a different capability", async () => {
    const adapter = { submit: vi.fn() };
    await expect(executeApprovedMobileStoreSubmission(base, { getApproval: async () => approval({ toolName: "send_message" }) }, adapter)).rejects.toThrow("mobile_store_submit_approval_scope_mismatch");
  });

  it("submits exactly once through the provider adapter after approval validation", async () => {
    const adapter = { submit: vi.fn(async () => ({ submissionRef: "asc:123", status: "SUBMITTED" as const })) };
    const result = await executeApprovedMobileStoreSubmission(base, { getApproval: async () => approval() }, adapter);
    expect(result).toEqual({ submissionRef: "asc:123", status: "SUBMITTED" });
    expect(adapter.submit).toHaveBeenCalledTimes(1);
  });
});
