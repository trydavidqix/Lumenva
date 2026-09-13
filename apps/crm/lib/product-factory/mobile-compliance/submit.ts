import { createHash } from "node:crypto";
import type { MobilePlatform, MobileStore } from "./contracts";

export interface MobileStoreSubmissionInput {
  organizationId: string;
  projectId: string;
  buildRef: string;
  artifactRef: string;
  artifactHash: string;
  platform: MobilePlatform;
  store: MobileStore;
  complianceReportRef: string;
  runtimeReviewRef: string;
  approvalId: string;
  actorId: string;
}

export interface MobileStoreApproval {
  id: string;
  organizationId: string;
  status: "pending" | "approved" | "rejected" | "expired" | "executing" | "executed" | "failed";
  toolName: string;
  payloadHash: string;
}

export interface MobileStoreApprovalReader {
  getApproval(input: { organizationId: string; approvalId: string }): Promise<MobileStoreApproval | null>;
}

export interface MobileStoreSubmissionAdapter {
  submit(input: MobileStoreSubmissionInput): Promise<{ submissionRef: string; status: "SUBMITTED" }>;
}

function canonicalPayload(input: MobileStoreSubmissionInput) {
  return {
    organizationId: input.organizationId,
    projectId: input.projectId,
    buildRef: input.buildRef,
    artifactRef: input.artifactRef,
    artifactHash: input.artifactHash,
    platform: input.platform,
    store: input.store,
    complianceReportRef: input.complianceReportRef,
    runtimeReviewRef: input.runtimeReviewRef,
    actorId: input.actorId,
  };
}

export function mobileStoreSubmissionPayloadHash(input: MobileStoreSubmissionInput): string {
  return createHash("sha256").update(JSON.stringify(canonicalPayload(input))).digest("hex");
}

export async function executeApprovedMobileStoreSubmission(
  input: MobileStoreSubmissionInput,
  approvals: MobileStoreApprovalReader,
  adapter: MobileStoreSubmissionAdapter,
): Promise<{ submissionRef: string; status: "SUBMITTED" }> {
  const expectedStore: MobileStore = input.platform === "IOS" ? "APP_STORE" : "PLAY_STORE";
  if (input.store !== expectedStore) throw new Error("mobile_store_submit_platform_store_mismatch");
  if (!input.complianceReportRef || !input.runtimeReviewRef || !input.artifactHash) throw new Error("mobile_store_submit_evidence_incomplete");

  const approval = await approvals.getApproval({ organizationId: input.organizationId, approvalId: input.approvalId });
  if (!approval || approval.status !== "approved") throw new Error("mobile_store_submit_approval_required");
  if (approval.id !== input.approvalId || approval.organizationId !== input.organizationId || approval.toolName !== "mobile_store_submit") {
    throw new Error("mobile_store_submit_approval_scope_mismatch");
  }
  if (approval.payloadHash !== mobileStoreSubmissionPayloadHash(input)) throw new Error("mobile_store_submit_approval_payload_mismatch");

  return adapter.submit(input);
}
