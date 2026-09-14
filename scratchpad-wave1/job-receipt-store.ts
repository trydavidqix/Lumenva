export type Queryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };

export type JobReceipt = {
  receiptId: string;
  organizationId: string;
  jobId: string;
  eventId: string;
  outcome: "completed" | "failed";
  evidence: Record<string, unknown>;
  createdAt: string;
};

export async function ensureJobReceiptStore(db: Queryable): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS operating_core_job_receipts (
    receipt_id text PRIMARY KEY,
    organization_id text NOT NULL,
    job_id text NOT NULL,
    event_id text NOT NULL,
    outcome text NOT NULL CHECK (outcome IN ('completed', 'failed')),
    evidence jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, job_id, event_id)
  )`);
}

export async function appendJobReceipt(db: Queryable, receipt: JobReceipt): Promise<JobReceipt> {
  if (!receipt.receiptId.trim() || !receipt.organizationId.trim() || !receipt.jobId.trim() || !receipt.eventId.trim()) throw new Error("job_receipt_invalid");
  const result = await db.query<JobReceipt>(
    `INSERT INTO operating_core_job_receipts (receipt_id, organization_id, job_id, event_id, outcome, evidence, created_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
     ON CONFLICT (organization_id, job_id, event_id) DO UPDATE SET receipt_id = operating_core_job_receipts.receipt_id
     RETURNING receipt_id AS "receiptId", organization_id AS "organizationId", job_id AS "jobId", event_id AS "eventId", outcome, evidence, created_at AS "createdAt"`,
    [receipt.receiptId, receipt.organizationId, receipt.jobId, receipt.eventId, receipt.outcome, JSON.stringify(receipt.evidence), receipt.createdAt],
  );
  return result.rows[0]!;
}

export async function listJobReceipts(db: Queryable, organizationId: string, jobId: string): Promise<JobReceipt[]> {
  if (!organizationId.trim() || !jobId.trim()) throw new Error("job_receipt_invalid");
  const result = await db.query<JobReceipt>(
    `SELECT receipt_id AS "receiptId", organization_id AS "organizationId", job_id AS "jobId", event_id AS "eventId", outcome, evidence, created_at AS "createdAt"
     FROM operating_core_job_receipts WHERE organization_id=$1 AND job_id=$2 ORDER BY created_at, event_id`,
    [organizationId, jobId],
  );
  return result.rows;
}
