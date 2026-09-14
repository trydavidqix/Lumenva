import { createHash } from "node:crypto";
import {
  validateDeliveryChannelArtifact,
  validateDeliveryPlanWithState,
  type DeliveryArtifact,
  type DeliveryBuildEvidence,
  type DeliveryChannel,
  type DeliveryPlan,
} from "./delivery";
import type { BuildPlanStateStore } from "./build-plan-state-store";

export type PreviewArtifact = {
  preview_id: string;
  delivery_plan_id: string;
  organization_id: string;
  build_ref: string;
  artifact_ref: string;
  content_hash: string;
  source_refs: string[];
  test_refs: string[];
  evidence_refs: string[];
  status: "READY";
};
export type PreviewResult = { status: "READY"; preview: PreviewArtifact };

export async function generatePreview(
  plan: DeliveryPlan,
  artifact: DeliveryArtifact,
  buildEvidence: DeliveryBuildEvidence,
  stateStore: BuildPlanStateStore,
): Promise<PreviewResult> {
  const previewChannels = plan.channels.filter(
    (channel): channel is Extract<DeliveryChannel, "WEB_PREVIEW" | "MOBILE_PREVIEW"> =>
      channel === "WEB_PREVIEW" || channel === "MOBILE_PREVIEW",
  );
  if (!previewChannels.length) throw new Error("preview channel is not declared by delivery plan");

  const compatible = previewChannels.some((channel) => validateDeliveryChannelArtifact(channel, artifact).valid);
  if (!compatible) {
    const errors = previewChannels.flatMap((channel) => validateDeliveryChannelArtifact(channel, artifact).errors);
    throw new Error(errors.join("; "));
  }

  const gate = await validateDeliveryPlanWithState(plan, artifact, buildEvidence, stateStore);
  if (!gate.valid) throw new Error(gate.errors.join("; "));

  const source = JSON.stringify({
    build_ref: plan.build_ref,
    artifact_ref: artifact.artifact_ref,
    artifact_hash: artifact.content_hash,
    source_refs: buildEvidence.source_refs,
    test_refs: buildEvidence.test_refs,
    evidence_refs: buildEvidence.evidence_refs,
  });
  const contentHash = createHash("sha256").update(source).digest("hex");
  return {
    status: "READY",
    preview: {
      preview_id: `preview-${plan.delivery_plan_id}-${contentHash.slice(0, 12)}`,
      delivery_plan_id: plan.delivery_plan_id,
      organization_id: plan.organization_id,
      build_ref: plan.build_ref,
      artifact_ref: artifact.artifact_ref,
      content_hash: contentHash,
      source_refs: [...buildEvidence.source_refs],
      test_refs: [...buildEvidence.test_refs],
      evidence_refs: [...buildEvidence.evidence_refs],
      status: "READY",
    },
  };
}
