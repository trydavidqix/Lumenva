import { describe, expect, it } from "vitest";
import { generatePreview } from "@/lib/product-factory/preview";
import type { DeliveryArtifact, DeliveryBuildEvidence, DeliveryPlan } from "@/lib/product-factory/delivery";
import type { BuildPlanStateRow, BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const plan: DeliveryPlan = {
  delivery_plan_id: "delivery-preview",
  organization_id: "org-1",
  project_id: "project-1",
  build_ref: "build-1",
  channels: ["WEB_PREVIEW"],
  environment: "LOCAL",
  release_policy_version: "policy-1",
  rollout: "NONE",
  support_owner: "owner-1",
  acceptance_criteria: ["preview"],
  status: "APPROVED",
};
const artifact: DeliveryArtifact = {
  delivery_artifact_id: "artifact-1",
  delivery_plan_id: plan.delivery_plan_id,
  artifact_ref: "artifact://build-1",
  content_hash: "a".repeat(64),
  platform: "WEB",
  version: "1.0.0",
  provenance_refs: ["source-1"],
  security_scan_refs: ["security-1"],
  test_refs: ["test-1"],
  status: "VERIFIED",
};
const evidence: DeliveryBuildEvidence = {
  build_ref: "build-1",
  organization_id: "org-1",
  project_id: "project-1",
  output_sha: "b".repeat(40),
  source_refs: ["source-1"],
  test_refs: ["test-1"],
  policy_version: "policy-1",
  evidence_refs: ["evidence-1"],
};

function stateStore(): BuildPlanStateStore {
  let row: BuildPlanStateRow | undefined;
  return {
    get: async () => row,
    recordAttempt: async () => {
      if (row?.status === "RUNNING" || row?.status === "BLOCKED" || row?.status === "SUCCEEDED") return undefined;
      row = { id: "state-1", status: "RUNNING", attempts: 1, blocked_at: null };
      return row;
    },
    finish: async (_tenant, _plan, _step, status) => {
      if (row) row = { ...row, status };
    },
  } as unknown as BuildPlanStateStore;
}

describe("provider-free build preview", () => {
  it("generates the same deterministic preview on repeated calls after a persisted SUCCEEDED gate", async () => {
    const db = stateStore();
    const first = await generatePreview(plan, artifact, evidence, db);
    const second = await generatePreview(plan, artifact, evidence, db);
    expect(first.status).toBe("READY");
    expect(first.preview.content_hash).toHaveLength(64);
    expect(first.preview.source_refs).toEqual(["source-1"]);
    expect(second).toEqual(first);
  });

  it("rejects preview generation before APPROVED/PACKAGED", async () => {
    await expect(generatePreview({ ...plan, status: "DRAFT" }, artifact, evidence, stateStore()))
      .rejects.toThrow("delivery plan must be APPROVED or PACKAGED");
  });

  it("rejects preview generation when no preview channel is declared", async () => {
    await expect(generatePreview({ ...plan, channels: ["MANAGED_SERVICE"] }, artifact, evidence, stateStore()))
      .rejects.toThrow("preview channel is not declared by delivery plan");
  });

  it("rejects mobile preview when the artifact is not mobile", async () => {
    await expect(generatePreview(
      { ...plan, channels: ["MOBILE_PREVIEW"] },
      artifact,
      evidence,
      stateStore(),
    )).rejects.toThrow("delivery channel MOBILE_PREVIEW requires IOS or ANDROID artifact");
  });
});
