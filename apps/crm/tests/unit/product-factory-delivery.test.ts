import { describe, expect, it } from "vitest";
import {
  executeDeliveryWithGate,
  validateDeliveryPlan,
  validateDeliveryPlanWithState,
  type DeliveryArtifact,
  type DeliveryPlan,
  type DeliveryBuildEvidence,
} from "@/lib/product-factory/delivery";
import type { BuildPlanStateRow, BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const deliveryPlan: DeliveryPlan = {
  delivery_plan_id: "delivery-1",
  organization_id: "org-1",
  project_id: "project-1",
  build_ref: "build-1",
  channels: ["WEB_PREVIEW"],
  environment: "LOCAL",
  release_policy_version: "policy-1",
  rollout: "NONE",
  support_owner: "owner-1",
  acceptance_criteria: ["preview available"],
  status: "DRAFT",
};
const artifact: DeliveryArtifact = {
  delivery_artifact_id: "artifact-1",
  delivery_plan_id: "delivery-1",
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

describe("Wave 10 delivery gates", () => {
  it("accepts a tenant-matched artifact with source, tests, policy and evidence", () => {
    expect(validateDeliveryPlan(deliveryPlan, artifact, evidence)).toEqual({ valid: true, errors: [] });
  });

  it("applies the same gates to every declared delivery channel", () => {
    const artifacts = {
      WEB_PREVIEW: artifact,
      MOBILE_PREVIEW: { ...artifact, platform: "IOS" as const },
      APP_STORE: { ...artifact, platform: "IOS" as const },
      PLAY_STORE: { ...artifact, platform: "ANDROID" as const },
      MANAGED_SERVICE: artifact,
    };
    for (const channel of ["WEB_PREVIEW", "MOBILE_PREVIEW", "APP_STORE", "PLAY_STORE", "MANAGED_SERVICE"] as const) {
      const result = validateDeliveryPlan(
        { ...deliveryPlan, channels: [channel] },
        artifacts[channel],
        { ...evidence, evidence_refs: [] },
      );
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

  it("fails closed when a declared channel does not match the artifact platform", () => {
    expect(validateDeliveryPlan({ ...deliveryPlan, channels: ["APP_STORE"] }, artifact, evidence).errors)
      .toContain("delivery channel APP_STORE requires IOS artifact");
    expect(validateDeliveryPlan({ ...deliveryPlan, channels: ["PLAY_STORE"] }, { ...artifact, platform: "IOS" }, evidence).errors)
      .toContain("delivery channel PLAY_STORE requires ANDROID artifact");
    expect(validateDeliveryPlan({ ...deliveryPlan, channels: ["MOBILE_PREVIEW"] }, { ...artifact, platform: undefined }, evidence).errors)
      .toContain("delivery channel MOBILE_PREVIEW requires IOS or ANDROID artifact");
  });

  it("rejects cross-tenant delivery", () => {
    const result = validateDeliveryPlan(deliveryPlan, artifact, { ...evidence, organization_id: "org-2" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("organization_id mismatch between delivery plan and build evidence");
  });

  it("rejects an artifact without verifiable evidence", () => {
    const result = validateDeliveryPlan(
      deliveryPlan,
      { ...artifact, content_hash: "", provenance_refs: [], test_refs: [] },
      { ...evidence, evidence_refs: [] },
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      "delivery artifact content_hash is required",
      "delivery artifact provenance_refs are required",
      "delivery artifact test_refs are required",
      "build evidence_refs are required",
    ]));
  });

  it("requires APPROVED or PACKAGED before stateful delivery", async () => {
    const store = fakeStateStore();
    const result = await validateDeliveryPlanWithState(deliveryPlan, artifact, evidence, store);
    expect(result).toEqual({ valid: false, errors: ["delivery plan must be APPROVED or PACKAGED"] });
  });

  it("keeps BLOCKED terminal but treats an already-SUCCEEDED validation gate as reusable", async () => {
    const blocked = await validateDeliveryPlanWithState(
      { ...deliveryPlan, status: "APPROVED" },
      artifact,
      evidence,
      fakeStateStore({ id: "state-1", status: "BLOCKED", attempts: 1, blocked_at: null }),
    );
    expect(blocked).toEqual({ valid: false, errors: ["delivery gate is terminally BLOCKED"] });

    const succeeded = await validateDeliveryPlanWithState(
      { ...deliveryPlan, status: "APPROVED" },
      artifact,
      evidence,
      fakeStateStore({ id: "state-1", status: "SUCCEEDED", attempts: 1, blocked_at: null }),
    );
    expect(succeeded).toEqual({ valid: true, errors: [] });
  });

  it("rejects a concurrent RUNNING validation instead of pretending it is a fresh gate", async () => {
    const result = await validateDeliveryPlanWithState(
      { ...deliveryPlan, status: "APPROVED" },
      artifact,
      evidence,
      fakeStateStore({ id: "state-1", status: "RUNNING", attempts: 1, blocked_at: null }),
    );
    expect(result).toEqual({ valid: false, errors: ["delivery gate already RUNNING"] });
  });

  it("never invokes the delivery action when the gate denies", async () => {
    let invoked = false;
    await expect(executeDeliveryWithGate(
      deliveryPlan,
      artifact,
      evidence,
      fakeStateStore(),
      async () => { invoked = true; return "sent"; },
    )).rejects.toThrow("delivery plan must be APPROVED or PACKAGED");
    expect(invoked).toBe(false);
  });

  it("invokes the delivery action only after an APPROVED gate succeeds", async () => {
    let invoked = false;
    await expect(executeDeliveryWithGate(
      { ...deliveryPlan, status: "APPROVED" },
      artifact,
      evidence,
      fakeStateStore(),
      async () => { invoked = true; return "sent"; },
    )).resolves.toBe("sent");
    expect(invoked).toBe(true);
  });

  it("allows a safe retry when execution fails after the validation gate succeeded", async () => {
    const store = fakeStateStore();
    let attempts = 0;
    await expect(executeDeliveryWithGate(
      { ...deliveryPlan, status: "APPROVED" },
      artifact,
      evidence,
      store,
      async () => {
        attempts += 1;
        throw new Error("transient delivery failure");
      },
    )).rejects.toThrow("transient delivery failure");

    await expect(executeDeliveryWithGate(
      { ...deliveryPlan, status: "APPROVED" },
      artifact,
      evidence,
      store,
      async () => {
        attempts += 1;
        return "sent";
      },
    )).resolves.toBe("sent");
    expect(attempts).toBe(2);
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
