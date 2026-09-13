import { describe, expect, it } from "vitest";
import { validateDeliveryPlan, validateDeliveryPlanWithState, type DeliveryArtifact, type DeliveryPlan, type DeliveryBuildEvidence } from "@/lib/product-factory/delivery";
import type { BuildPlanStateRow, BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const deliveryPlan: DeliveryPlan = {
  delivery_plan_id: "delivery-1", organization_id: "org-1", project_id: "project-1", build_ref: "build-1",
  channels: ["WEB_PREVIEW"], environment: "LOCAL", release_policy_version: "policy-1", rollout: "NONE",
  support_owner: "owner-1", acceptance_criteria: ["preview available"], status: "DRAFT",
};
const artifact: DeliveryArtifact = {
  delivery_artifact_id: "artifact-1", delivery_plan_id: "delivery-1", artifact_ref: "artifact://build-1",
  content_hash: "a".repeat(64), platform: "WEB", version: "1.0.0", provenance_refs: ["source-1"],
  security_scan_refs: ["security-1"], test_refs: ["test-1"], status: "VERIFIED",
};
const evidence: DeliveryBuildEvidence = {
  build_ref: "build-1", organization_id: "org-1", project_id: "project-1", output_sha: "b".repeat(40),
  source_refs: ["source-1"], test_refs: ["test-1"], policy_version: "policy-1", evidence_refs: ["evidence-1"],
};

describe("Wave 10 delivery gates", () => {
  it("accepts a tenant-matched artifact with source, tests, policy and evidence", () => {
    expect(validateDeliveryPlan(deliveryPlan, artifact, evidence)).toEqual({ valid: true, errors: [] });
  });
  it("applies the same gates to every declared delivery channel", () => {
    for (const channel of ["WEB_PREVIEW", "MOBILE_PREVIEW", "APP_STORE", "PLAY_STORE", "MANAGED_SERVICE"] as const) {
      const result = validateDeliveryPlan({ ...deliveryPlan, channels: [channel] }, artifact, { ...evidence, evidence_refs: [] });
      expect(result.valid, channel).toBe(false);
      expect(result.errors).toContain("build evidence_refs are required");
    }
  });
  it("blocks unknown channels by default instead of bypassing delivery gates", () => {
    const unknownPlan = { ...deliveryPlan, channels: ["FUTURE_CHANNEL"] as unknown as DeliveryPlan["channels"] };
    const result = validateDeliveryPlan(unknownPlan, artifact, evidence);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("unsupported delivery channel: FUTURE_CHANNEL");
  });
  it("rejects cross-tenant delivery", () => {
    const result = validateDeliveryPlan(deliveryPlan, artifact, { ...evidence, organization_id: "org-2" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("organization_id mismatch between delivery plan and build evidence");
  });
  it("rejects an artifact without verifiable evidence", () => {
    const result = validateDeliveryPlan(deliveryPlan, { ...artifact, content_hash: "", provenance_refs: [], test_refs: [] }, { ...evidence, evidence_refs: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(["delivery artifact content_hash is required", "delivery artifact provenance_refs are required", "delivery artifact test_refs are required", "build evidence_refs are required"]));
  });
  it("requires APPROVED or PACKAGED before stateful delivery", async () => {
    const store = fakeStateStore();
    const result = await validateDeliveryPlanWithState(deliveryPlan, artifact, evidence, store);
    expect(result).toEqual({ valid: false, errors: ["delivery plan must be APPROVED or PACKAGED"] });
  });
  it("does not reopen a persisted BLOCKED or SUCCEEDED gate", async () => {
    for (const status of ["BLOCKED", "SUCCEEDED"] as const) {
      const store = fakeStateStore({ id: "state-1", status, attempts: 1, blocked_at: null });
      const result = await validateDeliveryPlanWithState({ ...deliveryPlan, status: "APPROVED" }, artifact, evidence, store);
      expect(result).toEqual({ valid: false, errors: [`delivery gate is terminally ${status}`] });
    }
  });
});

function fakeStateStore(row?: BuildPlanStateRow): BuildPlanStateStore {
  let current = row;
  return {
    get: async () => current,
    recordAttempt: async () => {
      if (current?.status === "BLOCKED" || current?.status === "SUCCEEDED" || current?.status === "RUNNING") return undefined;
      current = { id: "state-1", status: "RUNNING", attempts: 1, blocked_at: null };
      return current;
    },
    finish: async (_tenant, _plan, _step, status) => {
      if (current) current = { ...current, status };
    },
  } as unknown as BuildPlanStateStore;
}
