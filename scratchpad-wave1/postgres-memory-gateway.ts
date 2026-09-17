import type { Queryable } from "../apps/crm/lib/agent-engine/queue/queue";
import type { MemoryGateway, MemoryRecord } from "../apps/crm/lib/memory/gateway-projection";

type Row = {
  organization_id: string;
  record_id: string;
  backend: string;
  subject: string;
  scope: string;
  namespace: MemoryRecord["namespace"];
  content: unknown;
  observed_at: string | Date;
  confidence: number | string;
  supersedes: string | null;
};

export interface PostgresMemoryGateway extends MemoryGateway {
  append(record: MemoryRecord, backend: string): Promise<{ created: boolean; record: MemoryRecord }>;
}

function validBackend(backend: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(backend.trim());
}

function toRecord(row: Row): MemoryRecord {
  return {
    recordId: row.record_id,
    organizationId: row.organization_id,
    subject: row.subject,
    scope: row.scope,
    namespace: row.namespace,
    content: row.content,
    observedAt: row.observed_at instanceof Date ? row.observed_at.toISOString() : new Date(row.observed_at).toISOString(),
    confidence: Number(row.confidence),
    ...(row.supersedes === null ? {} : { supersedes: row.supersedes }),
  };
}

export function createPostgresMemoryGateway(db: Queryable, organizationId: string, table = "hermes_memory_records", backends: readonly string[] = ["postgres"]): PostgresMemoryGateway {
  if (!organizationId.trim()) throw new Error("memory_gateway_tenant_invalid");
  if (!/^\w+$/.test(table)) throw new Error("memory_gateway_table_invalid");
  const assertTenant = (requested: string) => {
    if (requested !== organizationId) throw new Error("memory_gateway_tenant_mismatch");
  };
  return {
    async append(record, backend) {
      assertTenant(record.organizationId);
      if (!validBackend(backend)) throw new Error("memory_gateway_backend_invalid");
      const result = await db.query<Row>(
        `INSERT INTO ${table} (organization_id, record_id, backend, subject, scope, namespace, content, observed_at, confidence, supersedes)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)
         ON CONFLICT (organization_id, record_id, backend) DO NOTHING
         RETURNING organization_id, record_id, backend, subject, scope, namespace, content, observed_at, confidence, supersedes`,
        [record.organizationId, record.recordId, backend, record.subject, record.scope, record.namespace, JSON.stringify(record.content), record.observedAt, record.confidence, record.supersedes ?? null],
      );
      if (result.rows[0]) return { created: true, record: toRecord(result.rows[0]) };
      const existing = await db.query<Row>(
        `SELECT organization_id, record_id, backend, subject, scope, namespace, content, observed_at, confidence, supersedes FROM ${table} WHERE organization_id=$1 AND record_id=$2 AND backend=$3`,
        [record.organizationId, record.recordId, backend],
      );
      if (!existing.rows[0]) throw new Error("memory_gateway_record_missing");
      return { created: false, record: toRecord(existing.rows[0]) };
    },
    listBackends() { return backends; },
    async read(backend, query) {
      assertTenant(query.organizationId);
      if (!validBackend(backend)) throw new Error("memory_gateway_backend_invalid");
      const result = await db.query<Row>(
        `SELECT organization_id, record_id, backend, subject, scope, namespace, content, observed_at, confidence, supersedes
         FROM ${table} WHERE organization_id=$1 AND backend=$2 AND subject=$3 AND scope=$4 AND namespace=$5 ORDER BY observed_at DESC, record_id`,
        [organizationId, backend, query.subject, query.scope, query.namespace],
      );
      return result.rows.map(toRecord);
    },
  };
}
