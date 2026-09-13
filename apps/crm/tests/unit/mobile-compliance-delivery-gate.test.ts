import { describe, expect, it } from "vitest";
import { deliverBuild, validateDeliveryPlan, validateMobileComplianceEvidence, type DeliveryArtifact, type DeliveryBuildEvidence, type DeliveryPlan } from "@/lib/product-factory/delivery";
import type { BuildPlanStateRow, BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const plan: DeliveryPlan = { delivery_plan_id: "mobile-plan", organization_id: "org-1", project_id: "project-1", build_ref: "build-1", channels: ["APP_STORE"], environment: "PRODUCTION", release_policy_version: "release-v1", rollout: "FULL", support_owner: "mobile-owner", acceptance_criteria: ["store ready"], status: "PACKAGED" };
const artifact: DeliveryArtifact = { delivery_artifact_id: "artifact-ios", delivery_plan_id: plan.delivery_plan_id, artifact_ref: "artifact://ios/1", content_hash: "a".repeat(64), platform: "IOS", version: "1.0.0", provenance_refs: ["src"], security_scan_refs: ["sec"], test_refs: ["test"], status: "VERIFIED" };
const compliance = { report_ref: "mobile-compliance:r1", organization_id: "org-1", project_id: "project-1", build_ref: "build-1", artifact_ref: "artifact://ios/1", artifact_hash: "a".repeat(64), platform: "IOS" as const, store: "APP_STORE" as const, policy_version: "apple-app-review-2026-06-08", policy_snapshot_ref: "policy:apple:1", runtime_review_ref: "runtime:1", verdict: "PASS" as const, runtime_status: "PASS" as const };
const evidence: DeliveryBuildEvidence = { build_ref: "build-1", organization_id: "org-1", project_id: "project-1", source_refs: ["src"], test_refs: ["test"], policy_version: "release-v1", evidence_refs: ["evidence"], mobile_compliance: compliance };

function store(): BuildPlanStateStore {
  const rows = new Map<string, BuildPlanStateRow>();
  return {
    get: async (_tenant, _plan, step) => rows.get(step),
    recordAttempt: async (_tenant, _plan, step) => {
      const current = rows.get(step);
      if (current?.status === "RUNNING" || current?.status === "BLOCKED" || current?.status === "SUCCEEDED") return undefined;
      const row = { id: step, status: "RUNNING", attempts: 1, blocked_at: null }; rows.set(step, row); return row;
    },
    finish: async (_tenant, _plan, step, status) => { const current = rows.get(step); if (current) rows.set(step, { ...current, status }); },
  } as unknown as BuildPlanStateStore;
}

describe("mobile delivery compliance gate", () => {
  it("accepts build-bound PASS evidence with a passing runtime review", () => {
    expect(validateMobileComplianceEvidence(plan, artifact, evidence)).toEqual({ valid: true, errors: [] });
    expect(validateDeliveryPlan(plan, artifact, evidence).valid).toBe(true);
  });
  it("rejects report reuse against a changed artifact", () => {
    const changed = { ...artifact, content_hash: "b".repeat(64) };
    expect(validateMobileComplianceEvidence(plan, changed, evidence).errors).toContain("mobile compliance artifact_hash mismatch");
  });
  it("rejects cross-tenant compliance evidence", () => {
    const poisoned = { ...evidence, mobile_compliance: { ...compliance, organization_id: "org-2" } };
    expect(validateMobileComplianceEvidence(plan, artifact, poisoned).errors).toContain("mobile compliance organization_id mismatch");
  });
  it("rejects NEEDS_REVIEW and non-PASS runtime evidence", () => {
    const poisoned = { ...evidence, mobile_compliance: { ...compliance, verdict: "NEEDS_REVIEW" as const, runtime_status: "INFRA_FAILURE" as const } };
    expect(validateMobileComplianceEvidence(plan, artifact, poisoned).errors).toEqual(expect.arrayContaining(["mobile compliance verdict must allow release", "mobile runtime review must PASS before store delivery"]));
  });
  it("never invokes store delivery without mobile compliance evidence", async () => {
    let called = false;
    await expect(deliverBuild(plan, artifact, { ...evidence, mobile_compliance: undefined }, store(), async () => { called = true; })).rejects.toThrow("mobile compliance evidence is required");
    expect(called).toBe(false);
  });
  it("invokes store delivery after mobile and delivery gates pass", async () => {
    let called = false;
    await expect(deliverBuild(plan, artifact, evidence, store(), async () => { called = true; })).resolves.toEqual({ delivered: true });
    expect(called).toBe(true);
  });
});
