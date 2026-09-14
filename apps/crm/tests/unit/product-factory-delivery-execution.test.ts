import { describe, expect, it } from "vitest";
import { deliverBuild, type DeliveryArtifact, type DeliveryBuildEvidence, type DeliveryPlan } from "@/lib/product-factory/delivery";
import type { BuildPlanStateRow, BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const plan: DeliveryPlan = {
  delivery_plan_id: "d",
  organization_id: "o",
  project_id: "p",
  build_ref: "b",
  channels: ["WEB_PREVIEW"],
  environment: "LOCAL",
  release_policy_version: "v",
  rollout: "NONE",
  support_owner: "s",
  acceptance_criteria: ["ok"],
  status: "DRAFT",
};
const artifact: DeliveryArtifact = {
  delivery_artifact_id: "a",
  delivery_plan_id: "d",
  artifact_ref: "r",
  content_hash: "h",
  platform: "WEB",
  version: "1",
  provenance_refs: ["p"],
  security_scan_refs: ["s"],
  test_refs: ["t"],
  status: "VERIFIED",
};
const evidence: DeliveryBuildEvidence = {
  build_ref: "b",
  organization_id: "o",
  project_id: "p",
  source_refs: ["s"],
  test_refs: ["t"],
  policy_version: "v",
  evidence_refs: ["e"],
};

function store(): BuildPlanStateStore {
  let row: BuildPlanStateRow | undefined;
  return {
    get: async () => row,
    recordAttempt: async () => {
      if (row?.status === "RUNNING" || row?.status === "BLOCKED" || row?.status === "SUCCEEDED") return undefined;
      row = { id: "1", status: "RUNNING", attempts: 1, blocked_at: null };
      return row;
    },
    finish: async (_tenant, _plan, _step, status) => {
      if (row) row = { ...row, status };
    },
  } as unknown as BuildPlanStateStore;
}

describe("delivery execution boundary", () => {
  it("does not execute without APPROVED/PACKAGED gate", async () => {
    let ran = false;
    await expect(deliverBuild(plan, artifact, evidence, store(), async () => { ran = true; }))
      .rejects.toThrow("delivery plan must be APPROVED or PACKAGED");
    expect(ran).toBe(false);
  });

  it("rejects an incompatible platform before execution", async () => {
    let ran = false;
    await expect(deliverBuild(
      { ...plan, status: "APPROVED", channels: ["APP_STORE"] },
      artifact,
      evidence,
      store(),
      async () => { ran = true; },
    )).rejects.toThrow("delivery channel APP_STORE requires IOS artifact");
    expect(ran).toBe(false);
  });

  it("executes a platform-compatible approved delivery", async () => {
    let ran = false;
    await expect(deliverBuild(
      { ...plan, status: "APPROVED" },
      artifact,
      evidence,
      store(),
      async () => { ran = true; },
    )).resolves.toEqual({ delivered: true });
    expect(ran).toBe(true);
  });
});
