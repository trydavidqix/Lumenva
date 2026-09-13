import { describe, expect, it } from "vitest";
import { generatePreview, type PreviewArtifact } from "@/lib/product-factory/preview";
import type { DeliveryArtifact, DeliveryBuildEvidence, DeliveryPlan } from "@/lib/product-factory/delivery";
import { BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const plan: DeliveryPlan = { delivery_plan_id: "delivery-preview", organization_id: "org-1", project_id: "project-1", build_ref: "build-1", channels: ["WEB_PREVIEW"], environment: "LOCAL", release_policy_version: "policy-1", rollout: "NONE", support_owner: "owner-1", acceptance_criteria: ["preview"], status: "APPROVED" };
const artifact: DeliveryArtifact = { delivery_artifact_id: "artifact-1", delivery_plan_id: plan.delivery_plan_id, artifact_ref: "artifact://build-1", content_hash: "a".repeat(64), platform: "WEB", version: "1.0.0", provenance_refs: ["source-1"], security_scan_refs: ["security-1"], test_refs: ["test-1"], status: "VERIFIED" };
const evidence: DeliveryBuildEvidence = { build_ref: "build-1", organization_id: "org-1", project_id: "project-1", output_sha: "b".repeat(40), source_refs: ["source-1"], test_refs: ["test-1"], policy_version: "policy-1", evidence_refs: ["evidence-1"] };
const db = new BuildPlanStateStore({ async query<T>(sql: string): Promise<{ rows: T[] }> { if (sql.startsWith("select")) return { rows: [] }; return { rows: [{ id: "state-1", status: "RUNNING", attempts: 1, blocked_at: null }] as T[] }; } });

describe("provider-free build preview", () => {
  it("generates a deterministic preview only after the APPROVED/PACKAGED gate", async () => {
    const first = await generatePreview(plan, artifact, evidence, db);
    const second = await generatePreview(plan, artifact, evidence, db);
    expect(first.status).toBe("READY");
    expect(first.preview.content_hash).toHaveLength(64);
    expect(first.preview.source_refs).toEqual(["source-1"]);
    expect(second.preview.content_hash).toBe(first.preview.content_hash);
  });

  it("rejects preview generation before APPROVED/PACKAGED", async () => {
    await expect(generatePreview({ ...plan, status: "DRAFT" }, artifact, evidence, db)).rejects.toThrow("delivery plan must be APPROVED or PACKAGED");
  });
});
