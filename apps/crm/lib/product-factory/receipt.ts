import { createHash } from "node:crypto";
import {
  validateDeliveryChannelArtifact,
  validateDeliveryPlanWithState,
  type DeliveryArtifact,
  type DeliveryBuildEvidence,
  type DeliveryChannel,
  type DeliveryPlan,
} from "./delivery";
import type { BuildPlanStateStore, Queryable } from "./build-plan-state-store";

export type DeliveryReceipt = Readonly<{
  delivery_receipt_id: string;
  delivery_plan_id: string;
  organization_id: string;
  artifact_refs: readonly string[];
  environment: string;
  actor_id: string;
  channel: DeliveryChannel;
  approval_id?: string;
  result: "HANDED_OFF" | "AVAILABLE" | "ROLLED_BACK" | "FAILED" | "NOT_PROVEN";
  support_ticket_ref?: string;
  evidence_refs: readonly string[];
  created_at: string;
  content_hash: string;
}>;

type ReceiptRow = Omit<DeliveryReceipt, "artifact_refs" | "evidence_refs" | "created_at" | "approval_id" | "support_ticket_ref"> & {
  tenant_id: string;
  artifact_refs: string[];
  evidence_refs: string[];
  created_at: string | Date;
  approval_id?: string | null;
  support_ticket_ref?: string | null;
};

const freeze = (values: readonly string[]): readonly string[] => Object.freeze([...values]);
function normalizeCreatedAt(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
const rowToReceipt = (row: ReceiptRow): DeliveryReceipt => {
  const { tenant_id: _tenantId, approval_id, support_ticket_ref, ...receipt } = row;
  return Object.freeze({
    ...receipt,
    ...(approval_id ? { approval_id } : {}),
    ...(support_ticket_ref ? { support_ticket_ref } : {}),
    created_at: normalizeCreatedAt(row.created_at),
    artifact_refs: freeze(row.artifact_refs),
    evidence_refs: freeze(row.evidence_refs),
  });
};

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function receiptMatchesRequest(stored: DeliveryReceipt, candidate: DeliveryReceipt): boolean {
  return stored.delivery_receipt_id === candidate.delivery_receipt_id
    && stored.delivery_plan_id === candidate.delivery_plan_id
    && stored.organization_id === candidate.organization_id
    && arraysEqual(stored.artifact_refs, candidate.artifact_refs)
    && stored.environment === candidate.environment
    && stored.actor_id === candidate.actor_id
    && stored.channel === candidate.channel
    && (stored.approval_id ?? undefined) === (candidate.approval_id ?? undefined)
    && stored.result === candidate.result
    && (stored.support_ticket_ref ?? undefined) === (candidate.support_ticket_ref ?? undefined)
    && arraysEqual(stored.evidence_refs, candidate.evidence_refs)
    && stored.created_at === candidate.created_at
    && stored.content_hash === candidate.content_hash;
}

export class DeliveryReceiptStore {
  constructor(private readonly db: Queryable) {}

  async get(tenantId: string, receiptId: string): Promise<DeliveryReceipt | undefined> {
    const result = await this.db.query<ReceiptRow>(
      "select * from public.delivery_receipts where tenant_id=$1 and delivery_receipt_id=$2",
      [tenantId, receiptId],
    );
    return result.rows[0] ? rowToReceipt(result.rows[0]) : undefined;
  }

  async findTenantByReceiptId(receiptId: string): Promise<string | undefined> {
    const result = await this.db.query<{ tenant_id: string }>(
      "select tenant_id from public.delivery_receipts where delivery_receipt_id=$1",
      [receiptId],
    );
    return result.rows[0]?.tenant_id;
  }

  async insertOrGet(receipt: DeliveryReceipt): Promise<DeliveryReceipt> {
    const result = await this.db.query<ReceiptRow>(
      "insert into public.delivery_receipts (tenant_id,delivery_receipt_id,delivery_plan_id,organization_id,artifact_refs,environment,actor_id,channel,approval_id,result,support_ticket_ref,evidence_refs,created_at,content_hash) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14) on conflict (tenant_id,delivery_receipt_id) do update set delivery_receipt_id=public.delivery_receipts.delivery_receipt_id returning *",
      [
        receipt.organization_id,
        receipt.delivery_receipt_id,
        receipt.delivery_plan_id,
        receipt.organization_id,
        JSON.stringify(receipt.artifact_refs),
        receipt.environment,
        receipt.actor_id,
        receipt.channel,
        receipt.approval_id ?? null,
        receipt.result,
        receipt.support_ticket_ref ?? null,
        JSON.stringify(receipt.evidence_refs),
        receipt.created_at,
        receipt.content_hash,
      ],
    );
    if (!result.rows[0]) throw new Error("delivery receipt insert returned no row");
    return rowToReceipt(result.rows[0]);
  }
}

export function getDeliveryReceipt(
  store: DeliveryReceiptStore,
  organizationId: string,
  receiptId: string,
): Promise<DeliveryReceipt | undefined> {
  return store.get(organizationId, receiptId);
}

export async function createDeliveryReceipt(
  plan: DeliveryPlan,
  artifact: DeliveryArtifact,
  buildEvidence: DeliveryBuildEvidence,
  stateStore: BuildPlanStateStore,
  receiptStore: DeliveryReceiptStore,
  options: {
    delivery_receipt_id: string;
    actor_id: string;
    channel: DeliveryChannel;
    created_at: string;
    approval_id?: string;
    support_ticket_ref?: string;
  },
): Promise<DeliveryReceipt> {
  const owner = await receiptStore.findTenantByReceiptId(options.delivery_receipt_id);
  if (owner && owner !== plan.organization_id) throw new Error("receipt ID belongs to another tenant");

  if (plan.status !== "APPROVED" && plan.status !== "PACKAGED") {
    throw new Error("delivery plan must be APPROVED or PACKAGED");
  }
  if (!plan.channels.includes(options.channel)) {
    throw new Error("receipt channel is not declared by delivery plan");
  }

  const channelValidation = validateDeliveryChannelArtifact(options.channel, artifact);
  if (!channelValidation.valid) throw new Error(channelValidation.errors.join("; "));

  const gate = await validateDeliveryPlanWithState(plan, artifact, buildEvidence, stateStore);
  if (!gate.valid) throw new Error(gate.errors.join("; "));

  const createdAt = normalizeCreatedAt(options.created_at);
  const hashInput = JSON.stringify({
    delivery_plan_id: plan.delivery_plan_id,
    organization_id: plan.organization_id,
    artifact_ref: artifact.artifact_ref,
    artifact_hash: artifact.content_hash,
    environment: plan.environment,
    actor_id: options.actor_id,
    channel: options.channel,
    approval_id: options.approval_id ?? null,
    support_ticket_ref: options.support_ticket_ref ?? null,
    evidence_refs: buildEvidence.evidence_refs,
    created_at: createdAt,
  });
  const candidate: DeliveryReceipt = Object.freeze({
    delivery_receipt_id: options.delivery_receipt_id,
    delivery_plan_id: plan.delivery_plan_id,
    organization_id: plan.organization_id,
    artifact_refs: freeze([artifact.artifact_ref]),
    environment: plan.environment,
    actor_id: options.actor_id,
    channel: options.channel,
    ...(options.approval_id ? { approval_id: options.approval_id } : {}),
    result: "AVAILABLE" as const,
    ...(options.support_ticket_ref ? { support_ticket_ref: options.support_ticket_ref } : {}),
    evidence_refs: freeze(buildEvidence.evidence_refs),
    created_at: createdAt,
    content_hash: createHash("sha256").update(hashInput).digest("hex"),
  });

  const existing = await receiptStore.get(plan.organization_id, options.delivery_receipt_id);
  if (existing) {
    if (!receiptMatchesRequest(existing, candidate)) throw new Error("receipt conflict does not match request");
    return existing;
  }

  const stored = await receiptStore.insertOrGet(candidate);
  if (!receiptMatchesRequest(stored, candidate)) throw new Error("receipt conflict does not match request");
  return stored;
}
