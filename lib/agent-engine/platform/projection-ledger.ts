type Queryable = { query: (sql: string, values: unknown[]) => Promise<{ rows: Array<{ id: string; status: string }> }> };

type BeginInput = { organizationId: string; projectionType: "memory" | "graph"; provider: string; entityType: string; entityId: string; sourceId: string; sourceVersion: string; idempotencyKey: string };

export async function beginProjection(db: Queryable, input: BeginInput) {
  const result = await db.query(
    `insert into ai_projection_ledger (organization_id, projection_type, provider, entity_type, entity_id, source_id, source_version, idempotency_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (organization_id, projection_type, provider, idempotency_key) do update set updated_at = now()
     returning id, status`,
    [input.organizationId, input.projectionType, input.provider, input.entityType, input.entityId, input.sourceId, input.sourceVersion, input.idempotencyKey],
  );
  return result.rows[0]!;
}

export async function markProjectionApplied(db: Queryable, organizationId: string, id: string) {
  const result = await db.query(
    `update ai_projection_ledger set status = 'applied', applied_at = now(), updated_at = now()
     where id = $1 and organization_id = $2 returning id, status`,
    [id, organizationId],
  );
  return result.rows[0] ?? null;
}

export async function markProjectionRetry(db: Queryable, organizationId: string, id: string, errorCode: string, nextAttemptAt: string) {
  return db.query(`update ai_projection_ledger set status='failed', attempts=attempts+1, last_error_code=$3, last_error_at=now(), next_attempt_at=$4, updated_at=now() where id=$1 and organization_id=$2 returning id, status`, [id, organizationId, errorCode, nextAttemptAt]);
}

export async function markProjectionFailed(db: Queryable, organizationId: string, id: string, errorCode: string) {
  return db.query(`update ai_projection_ledger set status='failed', last_error_code=$3, last_error_at=now(), updated_at=now() where id=$1 and organization_id=$2 returning id, status`, [id, organizationId, errorCode]);
}

export async function markProjectionDeleted(db: Queryable, organizationId: string, id: string) {
  return db.query(`update ai_projection_ledger set status='deleted', updated_at=now() where id=$1 and organization_id=$2 returning id, status`, [id, organizationId]);
}
