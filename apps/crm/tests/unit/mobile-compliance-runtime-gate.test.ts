import { describe, expect, it } from "vitest";
import { validateMobileRuntimeWithState, type DeliveryArtifact, type DeliveryBuildEvidence, type DeliveryPlan } from "@/lib/product-factory/delivery";
import type { BuildPlanStateRow, BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const plan: DeliveryPlan = { delivery_plan_id: "plan-runtime", organization_id: "org-1", project_id: "project-1", build_ref: "build-1", channels: ["APP_STORE"], environment: "PRODUCTION", release_policy_version: "release-v1", rollout: "FULL", support_owner: "owner", acceptance_criteria: ["runtime"], status: "PACKAGED" };
const artifact: DeliveryArtifact = { delivery_artifact_id: "artifact-1", delivery_plan_id: plan.delivery_plan_id, artifact_ref: "artifact://ios", content_hash: "a".repeat(64), platform: "IOS", version: "1", provenance_refs: ["source"], security_scan_refs: ["security"], test_refs: ["test"], status: "VERIFIED" };
const baseCompliance = { report_ref: "report-1", organization_id: "org-1", project_id: "project-1", build_ref: "build-1", artifact_ref: artifact.artifact_ref, artifact_hash: artifact.content_hash, platform: "IOS" as const, store: "APP_STORE" as const, policy_version: "apple-policy", policy_snapshot_ref: "policy-1", runtime_review_ref: "runtime-1", verdict: "PASS" as const, runtime_status: "PASS" as const };
const evidence: DeliveryBuildEvidence = { build_ref: "build-1", organization_id: "org-1", project_id: "project-1", source_refs: ["source"], test_refs: ["test"], policy_version: "release-v1", evidence_refs: ["evidence"], mobile_compliance: baseCompliance };

function memoryStore() {
  const rows = new Map<string, BuildPlanStateRow>();
  const stateStore = {
    get: async (_tenant: string, _plan: string, step: string) => rows.get(step),
    recordAttempt: async (_tenant: string, _plan: string, step: string) => { const row = { id: step, status: "RUNNING", attempts: 1, blocked_at: null }; rows.set(step, row); return row; },
    finish: async (_tenant: string, _plan: string, step: string, status: "FAILED" | "SUCCEEDED" | "BLOCKED") => { const row = rows.get(step); if (row) rows.set(step, { ...row, status }); },
  } as unknown as BuildPlanStateStore;
  return { rows, stateStore };
}

describe("mobile runtime persisted gate", () => {
  it("persists SUCCEEDED only when runtime evidence passed", async () => {
    const { rows, stateStore } = memoryStore();
    await expect(validateMobileRuntimeWithState(plan, artifact, evidence, stateStore)).resolves.toEqual({ valid: true, errors: [] });
    expect(rows.get("mobile-runtime-review-gate")?.status).toBe("SUCCEEDED");
  });

  it("persists BLOCKED when runtime evidence did not pass", async () => {
    const { rows, stateStore } = memoryStore();
    const failed: DeliveryBuildEvidence = { ...evidence, mobile_compliance: { ...baseCompliance, runtime_status: "INFRA_FAILURE" } };
    const result = await validateMobileRuntimeWithState(plan, artifact, failed, stateStore);
    expect(result.valid).toBe(false);
    expect(rows.get("mobile-runtime-review-gate")?.status).toBe("BLOCKED");
  });
});
