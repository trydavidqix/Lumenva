import { Pool } from "pg";

type Receipt = { organizationId: string; requestId: string; toolName: string; actorId: string; outcome: "SUCCEEDED" | "FAILED"; result: unknown; evidence: Record<string, unknown> };
let pool: Pool | undefined;
function db(): Pool { const url = process.env.WAVE1_RECEIPT_DATABASE_URL ?? process.env.DATABASE_URL; if (!url) throw new Error("execution_receipt_store_not_configured"); return pool ??= new Pool({ connectionString: url }); }
export async function recordHttpExecutionReceipt(receipt: Receipt): Promise<void> {
  await db().query(`INSERT INTO public.operating_core_http_execution_receipts (organization_id,request_id,tool_name,actor_id,outcome,result,evidence) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) ON CONFLICT (organization_id,request_id,tool_name) DO UPDATE SET outcome=EXCLUDED.outcome,result=EXCLUDED.result,evidence=EXCLUDED.evidence`, [receipt.organizationId, receipt.requestId, receipt.toolName, receipt.actorId, receipt.outcome, JSON.stringify(receipt.result), JSON.stringify(receipt.evidence)]);
}
export async function closeHttpExecutionReceiptStore(): Promise<void> {
  if (pool) await pool.end();
  pool = undefined;
}
