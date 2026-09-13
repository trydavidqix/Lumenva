import { describe, expect, it } from "vitest";
import { BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";
import { createDeliveryReceipt, getDeliveryReceipt } from "@/lib/product-factory/receipt";
import type { DeliveryArtifact, DeliveryBuildEvidence, DeliveryPlan } from "@/lib/product-factory/delivery";
import { receiptStore } from "@/tests/unit/product-factory-receipt-test-helper";

const plan: DeliveryPlan = { delivery_plan_id: "receipt-plan-sec", organization_id: "org-1", project_id: "project-1", build_ref: "build-1", channels: ["MANAGED_SERVICE"], environment: "LOCAL", release_policy_version: "policy-1", rollout: "NONE", support_owner: "owner-1", acceptance_criteria: ["handoff"], status: "PACKAGED" };
const artifact: DeliveryArtifact = { delivery_artifact_id: "artifact-sec", delivery_plan_id: plan.delivery_plan_id, artifact_ref: "artifact://build-1", content_hash: "a".repeat(64), platform: "WEB", version: "1.0.0", provenance_refs: ["source-1"], security_scan_refs: ["security-1"], test_refs: ["test-1"], status: "VERIFIED" };
const evidence: DeliveryBuildEvidence = { build_ref: "build-1", organization_id: "org-1", project_id: "project-1", output_sha: "b".repeat(40), source_refs: ["source-1"], test_refs: ["test-1"], policy_version: "policy-1", evidence_refs: ["evidence-1"] };
const store = () => new BuildPlanStateStore({ async query<T>(sql: string): Promise<{ rows: T[] }> { if (sql.startsWith("select")) return { rows: [] }; return { rows: [{ id: "state-1", status: "RUNNING", attempts: 1, blocked_at: null }] as T[] }; } });
const receipts = receiptStore();

describe("delivery receipt security", () => {
  it("rejects receipt ID reuse across tenants and freezes nested arrays", async () => {
    const receipt = await createDeliveryReceipt(plan, artifact, evidence, store(), receipts, { delivery_receipt_id: "receipt-sec-1", actor_id: "actor-1", channel: "MANAGED_SERVICE", created_at: "2026-09-13T00:00:00.000Z" });
    expect(await getDeliveryReceipt(receipts, "org-1", "receipt-sec-1")).toEqual(receipt);
    expect(() => (receipt.artifact_refs as string[]).push("leak")).toThrow();
    expect(() => (receipt.evidence_refs as string[]).push("leak")).toThrow();

    const otherTenant = { ...plan, organization_id: "org-2", project_id: "project-2" };
    const otherEvidence = { ...evidence, organization_id: "org-2", project_id: "project-2" };
    await expect(createDeliveryReceipt(otherTenant, { ...artifact, delivery_plan_id: otherTenant.delivery_plan_id }, otherEvidence, store(), receipts, { delivery_receipt_id: "receipt-sec-1", actor_id: "actor-2", channel: "MANAGED_SERVICE", created_at: "2026-09-13T00:00:00.000Z" })).rejects.toThrow("receipt ID belongs to another tenant");
    expect(await getDeliveryReceipt(receipts, "org-2", "receipt-sec-1")).toBeUndefined();
  });

  it("rejects receipt reuse when the plan was reverted from PACKAGED to DRAFT", async () => {
    const receipt = await createDeliveryReceipt({ ...plan, delivery_plan_id: "receipt-plan-status" }, { ...artifact, delivery_plan_id: "receipt-plan-status" }, evidence, store(), receipts, { delivery_receipt_id: "receipt-status", actor_id: "actor-1", channel: "MANAGED_SERVICE", created_at: "2026-09-13T00:00:00.000Z" });
    expect(receipt.result).toBe("AVAILABLE");
    await expect(createDeliveryReceipt({ ...plan, delivery_plan_id: "receipt-plan-status", status: "DRAFT" }, { ...artifact, delivery_plan_id: "receipt-plan-status" }, evidence, store(), receipts, { delivery_receipt_id: "receipt-status", actor_id: "actor-1", channel: "MANAGED_SERVICE", created_at: "2026-09-13T00:00:00.000Z" })).rejects.toThrow("delivery plan must be APPROVED or PACKAGED");
  });
});
