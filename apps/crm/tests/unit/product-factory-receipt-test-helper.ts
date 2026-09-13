import { DeliveryReceiptStore, type DeliveryReceipt } from "@/lib/product-factory/receipt";

type Row = DeliveryReceipt & { tenant_id: string };
export function receiptStore(): DeliveryReceiptStore {
  const rows = new Map<string, Row>();
  return new DeliveryReceiptStore({ async query<T>(sql: string, values: unknown[] = []): Promise<{ rows: T[] }> {
    if (sql.startsWith("select tenant_id")) {
      const row = [...rows.values()].find((candidate) => candidate.delivery_receipt_id === values[0]);
      return { rows: row ? [{ tenant_id: row.tenant_id } as T] : [] };
    }
    if (sql.startsWith("select *")) {
      const row = rows.get(`${values[0]}:${values[1]}`);
      return { rows: row ? [row as T] : [] };
    }
    const row: Row = {
      tenant_id: String(values[0]), delivery_receipt_id: String(values[1]), delivery_plan_id: String(values[2]), organization_id: String(values[3]),
      artifact_refs: JSON.parse(String(values[4])), environment: String(values[5]), actor_id: String(values[6]), channel: values[7] as Row["channel"],
      result: values[9] as Row["result"], evidence_refs: JSON.parse(String(values[11])), created_at: String(values[12]), content_hash: String(values[13]),
    };
    const stored = rows.get(`${row.tenant_id}:${row.delivery_receipt_id}`) ?? row;
    rows.set(`${row.tenant_id}:${row.delivery_receipt_id}`, stored);
    return { rows: [stored as T] };
  } });
}
