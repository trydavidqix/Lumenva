import { describe, expect, it } from "vitest";
import { BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";
import { createDeliveryReceipt, getDeliveryReceipt } from "@/lib/product-factory/receipt";
import type { DeliveryArtifact, DeliveryBuildEvidence, DeliveryPlan } from "@/lib/product-factory/delivery";

const plan: DeliveryPlan = { delivery_plan_id: "receipt-plan", organization_id: "org-1", project_id: "project-1", build_ref: "build-1", channels: ["MANAGED_SERVICE"], environment: "LOCAL", release_policy_version: "policy-1", rollout: "NONE", support_owner: "owner-1", acceptance_criteria: ["handoff"], status: "PACKAGED" };
const artifact: DeliveryArtifact = { delivery_artifact_id: "artifact-1", delivery_plan_id: plan.delivery_plan_id, artifact_ref: "artifact://build-1", content_hash: "a".repeat(64), platform: "WEB", version: "1.0.0", provenance_refs: ["source-1"], security_scan_refs: ["security-1"], test_refs: ["test-1"], status: "VERIFIED" };
const evidence: DeliveryBuildEvidence = { build_ref: "build-1", organization_id: "org-1", project_id: "project-1", output_sha: "b".repeat(40), source_refs: ["source-1"], test_refs: ["test-1"], policy_version: "policy-1", evidence_refs: ["evidence-1"] };
const store = () => new BuildPlanStateStore({ async query<T>(sql: string): Promise<{ rows: T[] }> { if (sql.startsWith("select")) return { rows: [] }; return { rows: [{ id: "state-1", status: "RUNNING", attempts: 1, blocked_at: null }] as T[] }; } });

describe("delivery receipt", () => {
  it("creates an immutable audit receipt only after the delivery gate succeeds", async () => {
    const receipt = await createDeliveryReceipt(plan, artifact, evidence, store(), { delivery_receipt_id: "receipt-1", actor_id: "actor-1", channel: "MANAGED_SERVICE", created_at: "2026-09-13T00:00:00.000Z" });
    expect(receipt).toMatchObject({ delivery_receipt_id: "receipt-1", delivery_plan_id: "receipt-plan", organization_id: "org-1", channel: "MANAGED_SERVICE", actor_id: "actor-1", created_at: "2026-09-13T00:00:00.000Z", result: "AVAILABLE" });
    expect(receipt.content_hash).toHaveLength(64);
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(getDeliveryReceipt("org-1", "receipt-1")).toBe(receipt);
  });

  it("refuses to issue a receipt when APPROVED/PACKAGED gate is absent", async () => {
    await expect(createDeliveryReceipt({ ...plan, status: "DRAFT" }, artifact, evidence, store(), { delivery_receipt_id: "receipt-draft", actor_id: "actor-1", channel: "MANAGED_SERVICE", created_at: "2026-09-13T00:00:00.000Z" })).rejects.toThrow("delivery plan must be APPROVED or PACKAGED");
    expect(getDeliveryReceipt("org-1", "receipt-draft")).toBeUndefined();
  });
});
