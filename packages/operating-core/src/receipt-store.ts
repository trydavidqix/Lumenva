export type ReceiptStatus = "SUCCEEDED" | "DENIED" | "FAILED" | "NOT_PROVEN";

export type ExecutionReceipt = {
  id: string;
  organizationId: string;
  executionId: string;
  jobId?: string;
  action: string;
  status: ReceiptStatus;
  actorId: string;
  policyVersion: string;
  permissionLevel: "P0" | "P1" | "P2" | "P3" | "P4";
  riskLevel: "R0" | "R1" | "R2" | "R3" | "R4";
  idempotencyKey: string;
  result: Record<string, unknown>;
  evidenceRefs: string[];
  createdAt: string;
};

export type ReceiptInput = Omit<ExecutionReceipt, "id"> & { id?: string };

export class ReceiptStoreError extends Error {
  constructor(readonly code: "receipt_required" | "receipt_tenant_mismatch" | "receipt_not_found") {
    super(code);
    this.name = "ReceiptStoreError";
  }
}

function validate(input: ReceiptInput): void {
  const required = [input.organizationId, input.executionId, input.action, input.actorId, input.policyVersion, input.idempotencyKey, input.createdAt];
  if (required.some((value) => !value.trim())) throw new ReceiptStoreError("receipt_required");
}

export interface ExecutionReceiptStore {
  save(input: ReceiptInput): Promise<ExecutionReceipt>;
  get(organizationId: string, receiptId: string): Promise<ExecutionReceipt>;
}

export class InMemoryExecutionReceiptStore implements ExecutionReceiptStore {
  private readonly rows = new Map<string, ExecutionReceipt>();

  async save(input: ReceiptInput): Promise<ExecutionReceipt> {
    validate(input);
    const existing = [...this.rows.values()].find(
      (row) => row.organizationId === input.organizationId && row.idempotencyKey === input.idempotencyKey,
    );
    if (existing) return structuredClone(existing);
    const receipt: ExecutionReceipt = { ...structuredClone(input), id: input.id ?? crypto.randomUUID() };
    this.rows.set(`${receipt.organizationId}:${receipt.id}`, receipt);
    return structuredClone(receipt);
  }

  async get(organizationId: string, receiptId: string): Promise<ExecutionReceipt> {
    const anyTenant = [...this.rows.values()].find((row) => row.id === receiptId);
    if (anyTenant && anyTenant.organizationId !== organizationId) {
      throw new ReceiptStoreError("receipt_tenant_mismatch");
    }
    if (!anyTenant) throw new ReceiptStoreError("receipt_not_found");
    return structuredClone(anyTenant);
  }
}

export interface ReceiptQueryable {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }>;
}

export function createPostgresExecutionReceiptStore(db: ReceiptQueryable): ExecutionReceiptStore {
  return {
    async save(input) {
      validate(input);
      const { rows } = await db.query<ExecutionReceipt>(
        `insert into public.operating_core_receipts
           (id, organization_id, execution_id, job_id, action, status, actor_id,
            policy_version, permission_level, risk_level, idempotency_key, result, evidence_refs, created_at)
         values (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7,
                 $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14)
         on conflict (organization_id, idempotency_key)
         do update set id = public.operating_core_receipts.id
         returning id, organization_id as "organizationId", execution_id as "executionId",
                   job_id as "jobId", action, status, actor_id as "actorId",
                   policy_version as "policyVersion", permission_level as "permissionLevel",
                   risk_level as "riskLevel", idempotency_key as "idempotencyKey",
                   result, evidence_refs as "evidenceRefs", created_at as "createdAt"`,
        [
          input.id ?? null,
          input.organizationId,
          input.executionId,
          input.jobId ?? null,
          input.action,
          input.status,
          input.actorId,
          input.policyVersion,
          input.permissionLevel,
          input.riskLevel,
          input.idempotencyKey,
          JSON.stringify(input.result),
          JSON.stringify(input.evidenceRefs),
          input.createdAt,
        ],
      );
      if (!rows[0]) throw new Error("receipt_persistence_failed");
      return rows[0];
    },

    async get(organizationId, receiptId) {
      const { rows } = await db.query<ExecutionReceipt>(
        `select id, organization_id as "organizationId", execution_id as "executionId",
                job_id as "jobId", action, status, actor_id as "actorId",
                policy_version as "policyVersion", permission_level as "permissionLevel",
                risk_level as "riskLevel", idempotency_key as "idempotencyKey",
                result, evidence_refs as "evidenceRefs", created_at as "createdAt"
           from public.operating_core_receipts
          where organization_id = $1 and id = $2`,
        [organizationId, receiptId],
      );
      if (!rows[0]) throw new ReceiptStoreError("receipt_not_found");
      return rows[0];
    },
  };
}
