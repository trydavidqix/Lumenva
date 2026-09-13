import { createHash } from "node:crypto";
import { validateDeliveryPlan, validateDeliveryPlanWithState, type DeliveryArtifact, type DeliveryBuildEvidence, type DeliveryChannel, type DeliveryPlan } from "./delivery";
import type { BuildPlanStateStore } from "./build-plan-state-store";

export type DeliveryReceipt = Readonly<{
  delivery_receipt_id: string; delivery_plan_id: string; organization_id: string; artifact_refs: readonly string[];
  environment: string; actor_id: string; channel: DeliveryChannel; approval_id?: string;
  result: "HANDED_OFF" | "AVAILABLE" | "ROLLED_BACK" | "FAILED" | "NOT_PROVEN";
  support_ticket_ref?: string; evidence_refs: readonly string[]; created_at: string; content_hash: string;
}>;

const receipts = new Map<string, DeliveryReceipt>();
const receiptTenants = new Map<string, string>();
const receiptLocks = new Map<string, Promise<void>>();
const key = (organizationId: string, receiptId: string): string => `${organizationId}:${receiptId}`;
const frozen = (values: string[]): readonly string[] => Object.freeze([...values]);

async function withReceiptLock<T>(receiptKey: string, operation: () => Promise<T>): Promise<T> {
  const previous = receiptLocks.get(receiptKey) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  receiptLocks.set(receiptKey, queued);
  await previous;
  try { return await operation(); } finally {
    release();
    if (receiptLocks.get(receiptKey) === queued) receiptLocks.delete(receiptKey);
  }
}

export function getDeliveryReceipt(organizationId: string, receiptId: string): DeliveryReceipt | undefined { return receipts.get(key(organizationId, receiptId)); }

export function createDeliveryReceipt(
  plan: DeliveryPlan, artifact: DeliveryArtifact, buildEvidence: DeliveryBuildEvidence, stateStore: BuildPlanStateStore,
  options: { delivery_receipt_id: string; actor_id: string; channel: DeliveryChannel; created_at: string; approval_id?: string; support_ticket_ref?: string },
): Promise<DeliveryReceipt> {
  return withReceiptLock(key(plan.organization_id, options.delivery_receipt_id), async () => {
    const owner = receiptTenants.get(options.delivery_receipt_id);
    if (owner && owner !== plan.organization_id) throw new Error("receipt ID belongs to another tenant");
    const receiptKey = key(plan.organization_id, options.delivery_receipt_id);
    const existing = receipts.get(receiptKey);
    if (existing) {
      if (plan.status !== "APPROVED" && plan.status !== "PACKAGED") throw new Error("delivery plan must be APPROVED or PACKAGED");
      if (existing.actor_id !== options.actor_id) throw new Error("receipt actor does not match existing receipt");
      if (existing.channel !== options.channel) throw new Error("receipt channel does not match existing receipt");
      if (existing.delivery_plan_id !== plan.delivery_plan_id || existing.artifact_refs[0] !== artifact.artifact_ref) throw new Error("receipt artifact does not match existing receipt");
      const validation = validateDeliveryPlan(plan, artifact, buildEvidence);
      if (!validation.valid) throw new Error(validation.errors.join("; "));
      const persisted = await stateStore.get(plan.organization_id, plan.delivery_plan_id, "delivery-gate");
      if (persisted?.status !== "SUCCEEDED") throw new Error("delivery gate is not SUCCEEDED");
      return existing;
    }
    const gate = await validateDeliveryPlanWithState(plan, artifact, buildEvidence, stateStore);
    if (!gate.valid) throw new Error(gate.errors.join("; "));
    if (!plan.channels.includes(options.channel)) throw new Error("receipt channel is not declared by delivery plan");
    const hashInput = JSON.stringify({ plan_id: plan.delivery_plan_id, organization_id: plan.organization_id, channel: options.channel, artifact_hash: artifact.content_hash, created_at: options.created_at });
    const receipt = Object.freeze({
      delivery_receipt_id: options.delivery_receipt_id, delivery_plan_id: plan.delivery_plan_id, organization_id: plan.organization_id,
      artifact_refs: frozen([artifact.artifact_ref]), environment: plan.environment, actor_id: options.actor_id, channel: options.channel,
      ...(options.approval_id ? { approval_id: options.approval_id } : {}), result: "AVAILABLE" as const,
      ...(options.support_ticket_ref ? { support_ticket_ref: options.support_ticket_ref } : {}), evidence_refs: frozen(buildEvidence.evidence_refs),
      created_at: options.created_at, content_hash: createHash("sha256").update(hashInput).digest("hex"),
    });
    receipts.set(receiptKey, receipt); receiptTenants.set(options.delivery_receipt_id, plan.organization_id);
    return receipt;
  });
}
