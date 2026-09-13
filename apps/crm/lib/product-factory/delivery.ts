import { BuildPlanStateStore } from "./build-plan-state-store";

export type DeliveryChannel = "WEB_PREVIEW" | "MOBILE_PREVIEW" | "APP_STORE" | "PLAY_STORE" | "MANAGED_SERVICE";
export type DeliveryEnvironment = "LOCAL" | "STAGING" | "PRODUCTION";
export type DeliveryRollout = "NONE" | "INTERNAL" | "PERCENTAGE" | "FULL";
export type DeliveryPlanStatus = "DRAFT" | "VALIDATED" | "APPROVED" | "PACKAGED" | "DELIVERED" | "ROLLED_BACK" | "FAILED" | "BLOCKED_EXTERNAL";

export type DeliveryPlan = {
  delivery_plan_id: string; organization_id: string; project_id: string; build_ref: string;
  channels: DeliveryChannel[]; environment: DeliveryEnvironment; release_policy_version: string;
  rollout: DeliveryRollout; rollback_ref?: string; support_owner: string; acceptance_criteria: string[];
  status: DeliveryPlanStatus;
};

export type DeliveryArtifact = {
  delivery_artifact_id: string; delivery_plan_id: string; artifact_ref: string; content_hash: string;
  platform?: "WEB" | "IOS" | "ANDROID"; version: string; provenance_refs: string[];
  security_scan_refs: string[]; test_refs: string[];
  status: "BUILT" | "VERIFIED" | "APPROVED" | "DELIVERED" | "REVOKED";
};

export type DeliveryMobileComplianceEvidence = {
  report_ref: string;
  organization_id: string;
  project_id: string;
  build_ref: string;
  artifact_ref: string;
  artifact_hash: string;
  platform: "IOS" | "ANDROID";
  store: "APP_STORE" | "PLAY_STORE";
  policy_version: string;
  policy_snapshot_ref: string;
  runtime_review_ref: string;
  verdict: "PASS" | "PASS_WITH_WARNINGS" | "NEEDS_REVIEW" | "BLOCK";
  runtime_status: "PASS" | "FAIL" | "NOT_RUN" | "INFRA_FAILURE" | "NEEDS_REVIEW";
};

export type DeliveryBuildEvidence = {
  build_ref: string; organization_id: string; project_id: string; output_sha?: string;
  source_refs: string[]; test_refs: string[]; policy_version: string; evidence_refs: string[];
  mobile_compliance?: DeliveryMobileComplianceEvidence;
};

export type DeliveryValidation = { valid: boolean; errors: string[] };

const DELIVERY_CHANNELS = new Set<DeliveryChannel>(["WEB_PREVIEW", "MOBILE_PREVIEW", "APP_STORE", "PLAY_STORE", "MANAGED_SERVICE"]);

function mobileChannels(plan: DeliveryPlan): Array<"APP_STORE" | "PLAY_STORE"> {
  return plan.channels.filter((channel): channel is "APP_STORE" | "PLAY_STORE" => channel === "APP_STORE" || channel === "PLAY_STORE");
}

function validateMobileIdentity(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence): string[] {
  const compliance = buildEvidence.mobile_compliance;
  if (!compliance) return ["mobile compliance evidence is required for store delivery"];
  const errors: string[] = [];
  if (compliance.organization_id !== plan.organization_id) errors.push("mobile compliance organization_id mismatch");
  if (compliance.project_id !== plan.project_id) errors.push("mobile compliance project_id mismatch");
  if (compliance.build_ref !== plan.build_ref) errors.push("mobile compliance build_ref mismatch");
  if (compliance.artifact_ref !== artifact.artifact_ref) errors.push("mobile compliance artifact_ref mismatch");
  if (compliance.artifact_hash !== artifact.content_hash) errors.push("mobile compliance artifact_hash mismatch");
  for (const channel of mobileChannels(plan)) {
    const expectedPlatform = channel === "APP_STORE" ? "IOS" : "ANDROID";
    if (artifact.platform !== expectedPlatform) errors.push(`delivery channel ${channel} requires ${expectedPlatform} artifact`);
    if (compliance.platform !== expectedPlatform) errors.push(`mobile compliance platform must be ${expectedPlatform} for ${channel}`);
    if (compliance.store !== channel) errors.push(`mobile compliance store must be ${channel}`);
  }
  return errors;
}

export function validateMobileRuntimeEvidence(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence): DeliveryValidation {
  if (!mobileChannels(plan).length) return { valid: true, errors: [] };
  const errors = validateMobileIdentity(plan, artifact, buildEvidence);
  const compliance = buildEvidence.mobile_compliance;
  if (!compliance) return { valid: false, errors };
  if (!compliance.runtime_review_ref) errors.push("mobile compliance runtime_review_ref is required");
  if (compliance.runtime_status !== "PASS") errors.push("mobile runtime review must PASS before store delivery");
  return { valid: errors.length === 0, errors };
}

export function validateMobileComplianceEvidence(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence): DeliveryValidation {
  if (!mobileChannels(plan).length) return { valid: true, errors: [] };
  const errors = validateMobileIdentity(plan, artifact, buildEvidence);
  const compliance = buildEvidence.mobile_compliance;
  if (!compliance) return { valid: false, errors };
  if (!compliance.report_ref) errors.push("mobile compliance report_ref is required");
  if (!compliance.policy_version) errors.push("mobile compliance policy_version is required");
  if (!compliance.policy_snapshot_ref) errors.push("mobile compliance policy_snapshot_ref is required");
  if (compliance.verdict !== "PASS" && compliance.verdict !== "PASS_WITH_WARNINGS") errors.push("mobile compliance verdict must allow release");
  return { valid: errors.length === 0, errors };
}

export function validateDeliveryPlan(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence): DeliveryValidation {
  const errors: string[] = [];
  if (!plan.channels.length) errors.push("delivery plan requires at least one channel");
  for (const channel of plan.channels) if (!DELIVERY_CHANNELS.has(channel)) errors.push(`unsupported delivery channel: ${String(channel)}`);
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
  errors.push(...validateMobileRuntimeEvidence(plan, artifact, buildEvidence).errors);
  errors.push(...validateMobileComplianceEvidence(plan, artifact, buildEvidence).errors);
  return { valid: errors.length === 0, errors };
}

async function persistGateResult(plan: DeliveryPlan, stepId: string, validation: DeliveryValidation, stateStore: BuildPlanStateStore): Promise<DeliveryValidation> {
  const persisted = await stateStore.get(plan.organization_id, plan.delivery_plan_id, stepId);
  if (persisted?.status === "BLOCKED") return { valid: false, errors: [`${stepId} is terminally BLOCKED`] };
  if (persisted?.status === "SUCCEEDED") return validation.valid ? { valid: true, errors: [] } : validation;
  if (persisted?.status === "RUNNING") return { valid: false, errors: [`${stepId} already RUNNING`] };
  const reserved = await stateStore.recordAttempt(plan.organization_id, plan.delivery_plan_id, stepId);
  if (!reserved) return { valid: false, errors: [`${stepId} could not reserve execution`] };
  await stateStore.finish(plan.organization_id, plan.delivery_plan_id, stepId, validation.valid ? "SUCCEEDED" : "BLOCKED");
  return validation;
}

export async function validateMobileRuntimeWithState(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence, stateStore: BuildPlanStateStore): Promise<DeliveryValidation> {
  if (!mobileChannels(plan).length) return { valid: true, errors: [] };
  return persistGateResult(plan, "mobile-runtime-review-gate", validateMobileRuntimeEvidence(plan, artifact, buildEvidence), stateStore);
}

export async function validateMobileComplianceWithState(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence, stateStore: BuildPlanStateStore): Promise<DeliveryValidation> {
  if (!mobileChannels(plan).length) return { valid: true, errors: [] };
  return persistGateResult(plan, "mobile-compliance-gate", validateMobileComplianceEvidence(plan, artifact, buildEvidence), stateStore);
}

async function blockDeliveryGate(plan: DeliveryPlan, stateStore: BuildPlanStateStore): Promise<void> {
  const reserved = await stateStore.recordAttempt(plan.organization_id, plan.delivery_plan_id, "delivery-gate");
  if (reserved) await stateStore.finish(plan.organization_id, plan.delivery_plan_id, "delivery-gate", "BLOCKED");
}

export async function validateDeliveryPlanWithState(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence, stateStore: BuildPlanStateStore): Promise<DeliveryValidation> {
  const stepId = "delivery-gate";
  const persisted = await stateStore.get(plan.organization_id, plan.delivery_plan_id, stepId);
  if (persisted?.status === "BLOCKED" || persisted?.status === "SUCCEEDED") return { valid: false, errors: [`delivery gate is terminally ${persisted.status}`] };
  if (plan.status !== "APPROVED" && plan.status !== "PACKAGED") return { valid: false, errors: ["delivery plan must be APPROVED or PACKAGED"] };

  const runtimeGate = await validateMobileRuntimeWithState(plan, artifact, buildEvidence, stateStore);
  if (!runtimeGate.valid) { await blockDeliveryGate(plan, stateStore); return runtimeGate; }
  const mobileGate = await validateMobileComplianceWithState(plan, artifact, buildEvidence, stateStore);
  if (!mobileGate.valid) { await blockDeliveryGate(plan, stateStore); return mobileGate; }

  const validation = validateDeliveryPlan(plan, artifact, buildEvidence);
  if (!validation.valid) { await blockDeliveryGate(plan, stateStore); return validation; }
  if (!(await stateStore.recordAttempt(plan.organization_id, plan.delivery_plan_id, stepId))) return { valid: false, errors: ["delivery gate already RUNNING"] };
  await stateStore.finish(plan.organization_id, plan.delivery_plan_id, stepId, "SUCCEEDED");
  return validation;
}

/** Execution boundary: no channel can deliver without persisted mobile/runtime gates and the final delivery gate. */
export async function deliverBuild(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence, stateStore: BuildPlanStateStore, execute: () => Promise<void>): Promise<{ delivered: true }> {
  for (const channel of plan.channels) {
    if ((channel === "WEB_PREVIEW" && artifact.platform && artifact.platform !== "WEB") || (channel === "MOBILE_PREVIEW" && artifact.platform && !["IOS", "ANDROID"].includes(artifact.platform)) || (channel === "APP_STORE" && artifact.platform !== "IOS") || (channel === "PLAY_STORE" && artifact.platform !== "ANDROID")) throw new Error("delivery_channel_platform_mismatch");
  }
  const gate = await validateDeliveryPlanWithState(plan, artifact, buildEvidence, stateStore);
  if (!gate.valid) throw new Error(`delivery_blocked: ${gate.errors.join(";")}`);
  await execute(); return { delivered: true };
}

export async function executeDeliveryWithGate<T>(plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence, stateStore: BuildPlanStateStore, execute: () => Promise<T>): Promise<T> {
  const gate = await validateDeliveryPlanWithState(plan, artifact, buildEvidence, stateStore);
  if (!gate.valid) throw new Error(`delivery blocked: ${gate.errors.join(";")}`);
  return execute();
}
