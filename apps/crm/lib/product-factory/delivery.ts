export type DeliveryChannel = "WEB_PREVIEW" | "MOBILE_PREVIEW" | "APP_STORE" | "PLAY_STORE" | "MANAGED_SERVICE";
export type DeliveryEnvironment = "LOCAL" | "STAGING" | "PRODUCTION";
export type DeliveryRollout = "NONE" | "INTERNAL" | "PERCENTAGE" | "FULL";
export type DeliveryPlanStatus = "DRAFT" | "VALIDATED" | "APPROVED" | "PACKAGED" | "DELIVERED" | "ROLLED_BACK" | "FAILED" | "BLOCKED_EXTERNAL";

export type DeliveryPlan = {
  delivery_plan_id: string;
  organization_id: string;
  project_id: string;
  build_ref: string;
  channels: DeliveryChannel[];
  environment: DeliveryEnvironment;
  release_policy_version: string;
  rollout: DeliveryRollout;
  rollback_ref?: string;
  support_owner: string;
  acceptance_criteria: string[];
  status: DeliveryPlanStatus;
};

export type DeliveryArtifact = {
  delivery_artifact_id: string;
  delivery_plan_id: string;
  artifact_ref: string;
  content_hash: string;
  platform?: "WEB" | "IOS" | "ANDROID";
  version: string;
  provenance_refs: string[];
  security_scan_refs: string[];
  test_refs: string[];
  status: "BUILT" | "VERIFIED" | "APPROVED" | "DELIVERED" | "REVOKED";
};

export type DeliveryBuildEvidence = {
  build_ref: string;
  organization_id: string;
  project_id: string;
  output_sha?: string;
  source_refs: string[];
  test_refs: string[];
  policy_version: string;
  evidence_refs: string[];
};

export type DeliveryValidation = { valid: boolean; errors: string[] };

const DELIVERY_CHANNELS = new Set<DeliveryChannel>([
  "WEB_PREVIEW",
  "MOBILE_PREVIEW",
  "APP_STORE",
  "PLAY_STORE",
  "MANAGED_SERVICE",
]);

function channelPlatformError(channel: DeliveryChannel, artifact: DeliveryArtifact): string | null {
  if (channel === "WEB_PREVIEW" && artifact.platform !== "WEB") {
    return "delivery channel WEB_PREVIEW requires WEB artifact";
  }
  if (channel === "MOBILE_PREVIEW" && artifact.platform !== "IOS" && artifact.platform !== "ANDROID") {
    return "delivery channel MOBILE_PREVIEW requires IOS or ANDROID artifact";
  }
  if (channel === "APP_STORE" && artifact.platform !== "IOS") {
    return "delivery channel APP_STORE requires IOS artifact";
  }
  if (channel === "PLAY_STORE" && artifact.platform !== "ANDROID") {
    return "delivery channel PLAY_STORE requires ANDROID artifact";
  }
  return null;
}

export function validateDeliveryPlan(
  plan: DeliveryPlan,
  artifact: DeliveryArtifact,
  buildEvidence: DeliveryBuildEvidence,
): DeliveryValidation {
  const errors: string[] = [];
  if (!plan.channels.length) errors.push("delivery plan requires at least one channel");
  for (const channel of plan.channels) {
    if (!DELIVERY_CHANNELS.has(channel)) {
      errors.push(`unsupported delivery channel: ${String(channel)}`);
      continue;
    }
    const platformError = channelPlatformError(channel, artifact);
    if (platformError) errors.push(platformError);
  }
  if (artifact.delivery_plan_id !== plan.delivery_plan_id) errors.push("delivery artifact does not belong to delivery plan");
  if (buildEvidence.organization_id !== plan.organization_id) errors.push("organization_id mismatch between delivery plan and build evidence");
  if (buildEvidence.project_id !== plan.project_id) errors.push("project_id mismatch between delivery plan and build evidence");
  if (buildEvidence.build_ref !== plan.build_ref) errors.push("build_ref mismatch between delivery plan and build evidence");
  if (buildEvidence.policy_version !== plan.release_policy_version) errors.push("release policy version mismatch between delivery plan and build evidence");
  if (!artifact.content_hash) errors.push("delivery artifact content_hash is required");
  if (!artifact.provenance_refs.length) errors.push("delivery artifact provenance_refs are required");
  if (!artifact.test_refs.length) errors.push("delivery artifact test_refs are required");
  if (!artifact.security_scan_refs.length) errors.push("delivery artifact security_scan_refs are required");
  if (!buildEvidence.source_refs.length) errors.push("build source_refs are required");
  if (!buildEvidence.test_refs.length) errors.push("build test_refs are required");
  if (!buildEvidence.evidence_refs.length) errors.push("build evidence_refs are required");
  if (artifact.status !== "VERIFIED" && artifact.status !== "APPROVED") errors.push("delivery artifact must be VERIFIED or APPROVED");
  return { valid: errors.length === 0, errors };
}

import { BuildPlanStateStore } from "./build-plan-state-store";

/**
 * Durable validation gate.
 *
 * SUCCEEDED means the immutable delivery inputs previously passed validation and
 * can be reused by preview/receipt/execution callers. It is intentionally not a
 * marker that an external delivery side effect itself completed.
 */
export async function validateDeliveryPlanWithState(
  plan: DeliveryPlan,
  artifact: DeliveryArtifact,
  buildEvidence: DeliveryBuildEvidence,
  stateStore: BuildPlanStateStore,
): Promise<DeliveryValidation> {
  const stepId = "delivery-gate";
  const persisted = await stateStore.get(plan.organization_id, plan.delivery_plan_id, stepId);
  if (persisted?.status === "BLOCKED") {
    return { valid: false, errors: ["delivery gate is terminally BLOCKED"] };
  }
  if (persisted?.status === "RUNNING") {
    return { valid: false, errors: ["delivery gate already RUNNING"] };
  }

  if (plan.status !== "APPROVED" && plan.status !== "PACKAGED") {
    return { valid: false, errors: ["delivery plan must be APPROVED or PACKAGED"] };
  }

  const validation = validateDeliveryPlan(plan, artifact, buildEvidence);
  if (!validation.valid) {
    if (persisted?.status === "SUCCEEDED") {
      // Do not allow a previously-valid gate to bless changed delivery inputs.
      return validation;
    }
    const reserved = await stateStore.recordAttempt(plan.organization_id, plan.delivery_plan_id, stepId);
    if (!reserved) return { valid: false, errors: ["delivery gate already RUNNING"] };
    await stateStore.finish(plan.organization_id, plan.delivery_plan_id, stepId, "BLOCKED");
    return validation;
  }

  if (persisted?.status === "SUCCEEDED") return validation;

  if (!(await stateStore.recordAttempt(plan.organization_id, plan.delivery_plan_id, stepId))) {
    const latest = await stateStore.get(plan.organization_id, plan.delivery_plan_id, stepId);
    if (latest?.status === "SUCCEEDED") return validation;
    if (latest?.status === "BLOCKED") return { valid: false, errors: ["delivery gate is terminally BLOCKED"] };
    return { valid: false, errors: ["delivery gate already RUNNING"] };
  }
  await stateStore.finish(plan.organization_id, plan.delivery_plan_id, stepId, "SUCCEEDED");
  return validation;
}

/** Execution boundary: no channel can deliver without a persisted validation PASS. */
export async function deliverBuild(
  plan: DeliveryPlan,
  artifact: DeliveryArtifact,
  buildEvidence: DeliveryBuildEvidence,
  stateStore: BuildPlanStateStore,
  execute: () => Promise<void>,
): Promise<{ delivered: true }> {
  const gate = await validateDeliveryPlanWithState(plan, artifact, buildEvidence, stateStore);
  if (!gate.valid) throw new Error(`delivery_blocked: ${gate.errors.join(";")}`);
  await execute();
  return { delivered: true };
}

/** Backwards-compatible execution seam used by delivery callers. */
export async function executeDeliveryWithGate<T>(
  plan: DeliveryPlan,
  artifact: DeliveryArtifact,
  buildEvidence: DeliveryBuildEvidence,
  stateStore: BuildPlanStateStore,
  execute: () => Promise<T>,
): Promise<T> {
  const gate = await validateDeliveryPlanWithState(plan, artifact, buildEvidence, stateStore);
  if (!gate.valid) throw new Error(`delivery blocked: ${gate.errors.join(";")}`);
  return execute();
}
