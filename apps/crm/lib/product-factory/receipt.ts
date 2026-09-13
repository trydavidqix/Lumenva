import { createHash } from "node:crypto";
import { validateDeliveryPlanWithState, type DeliveryArtifact, type DeliveryBuildEvidence, type DeliveryChannel, type DeliveryPlan } from "./delivery";
import type { BuildPlanStateStore } from "./build-plan-state-store";

export type DeliveryReceipt = Readonly<{
  delivery_receipt_id: string; delivery_plan_id: string; organization_id: string; artifact_refs: string[];
  environment: string; actor_id: string; channel: DeliveryChannel; approval_id?: string;
  result: "HANDED_OFF" | "AVAILABLE" | "ROLLED_BACK" | "FAILED" | "NOT_PROVEN";
  support_ticket_ref?: string; evidence_refs: string[]; created_at: string; content_hash: string;
}>;

const receipts = new Map<string, DeliveryReceipt>();

export function getDeliveryReceipt(receiptId: string): DeliveryReceipt | undefined { return receipts.get(receiptId); }

export async function createDeliveryReceipt(
  plan: DeliveryPlan,
  artifact: DeliveryArtifact,
  buildEvidence: DeliveryBuildEvidence,
  stateStore: BuildPlanStateStore,
  options: { delivery_receipt_id: string; actor_id: string; channel: DeliveryChannel; created_at: string; approval_id?: string; support_ticket_ref?: string },
): Promise<DeliveryReceipt> {
  const existing = receipts.get(options.delivery_receipt_id);
  if (existing) return existing;
  const gate = await validateDeliveryPlanWithState(plan, artifact, buildEvidence, stateStore);
  if (!gate.valid) throw new Error(gate.errors.join("; "));
  if (!plan.channels.includes(options.channel)) throw new Error("receipt channel is not declared by delivery plan");
  const hashInput = JSON.stringify({ plan_id: plan.delivery_plan_id, organization_id: plan.organization_id, channel: options.channel, artifact_hash: artifact.content_hash, created_at: options.created_at });
  const receipt = Object.freeze({
    delivery_receipt_id: options.delivery_receipt_id, delivery_plan_id: plan.delivery_plan_id, organization_id: plan.organization_id,
    artifact_refs: [artifact.artifact_ref], environment: plan.environment, actor_id: options.actor_id, channel: options.channel,
    ...(options.approval_id ? { approval_id: options.approval_id } : {}), result: "AVAILABLE" as const,
    ...(options.support_ticket_ref ? { support_ticket_ref: options.support_ticket_ref } : {}), evidence_refs: [...buildEvidence.evidence_refs],
    created_at: options.created_at, content_hash: createHash("sha256").update(hashInput).digest("hex"),
  });
  receipts.set(options.delivery_receipt_id, receipt);
  return receipt;
}
