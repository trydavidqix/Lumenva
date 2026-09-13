import { describe, expect, it } from "vitest";
import { BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";
import { createDeliveryReceipt } from "@/lib/product-factory/receipt";
import type { DeliveryArtifact, DeliveryBuildEvidence, DeliveryPlan } from "@/lib/product-factory/delivery";

const plan: DeliveryPlan = { delivery_plan_id: "receipt-concurrent", organization_id: "org-concurrent", project_id: "project-1", build_ref: "build-1", channels: ["WEB_PREVIEW"], environment: "LOCAL", release_policy_version: "policy-1", rollout: "NONE", support_owner: "owner-1", acceptance_criteria: ["preview"], status: "PACKAGED" };
const artifact: DeliveryArtifact = { delivery_artifact_id: "artifact-concurrent", delivery_plan_id: plan.delivery_plan_id, artifact_ref: "artifact://build-1", content_hash: "a".repeat(64), platform: "WEB", version: "1.0.0", provenance_refs: ["source-1"], security_scan_refs: ["security-1"], test_refs: ["test-1"], status: "VERIFIED" };
const evidence: DeliveryBuildEvidence = { build_ref: "build-1", organization_id: plan.organization_id, project_id: plan.project_id, output_sha: "b".repeat(40), source_refs: ["source-1"], test_refs: ["test-1"], policy_version: "policy-1", evidence_refs: ["evidence-1"] };

describe("delivery receipt concurrency", () => {
  it("serializes concurrent creation for the same tenant and receipt ID", async () => {
    let selects = 0;
    const stateStore = new BuildPlanStateStore({ async query<T>(sql: string): Promise<{ rows: T[] }> {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (sql.startsWith("select")) return selects++ === 0 ? { rows: [] } : { rows: [{ id: "state-1", status: "SUCCEEDED", attempts: 1, blocked_at: null }] as T[] };
      return { rows: [{ id: "state-1", status: "RUNNING", attempts: 1, blocked_at: null }] as T[] };
    } });
    const options = { delivery_receipt_id: "receipt-concurrent-1", actor_id: "actor-1", channel: "WEB_PREVIEW" as const, created_at: "2026-09-13T00:00:00.000Z" };
    const [first, second] = await Promise.all([
      createDeliveryReceipt(plan, artifact, evidence, stateStore, options),
      createDeliveryReceipt(plan, artifact, evidence, stateStore, options),
    ]);
    expect(first).toBe(second);
  });
});
