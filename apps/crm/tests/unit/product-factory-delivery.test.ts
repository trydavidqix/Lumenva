import { describe, expect, it } from "vitest";
import { validateDeliveryPlan, type DeliveryArtifact, type DeliveryPlan, type DeliveryBuildEvidence } from "@/lib/product-factory/delivery";

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

  it("rejects cross-tenant or cross-project delivery", () => {
    const result = validateDeliveryPlan(deliveryPlan, artifact, { ...evidence, organization_id: "org-2" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("organization_id mismatch between delivery plan and build evidence");
  });

  it("rejects an artifact without verifiable hash, provenance, tests or evidence", () => {
    const result = validateDeliveryPlan(deliveryPlan, { ...artifact, content_hash: "", provenance_refs: [], test_refs: [] }, { ...evidence, evidence_refs: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "delivery artifact content_hash is required",
      "delivery artifact provenance_refs are required",
      "delivery artifact test_refs are required",
      "build evidence_refs are required",
    ]));
  });
});
