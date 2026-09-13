import type { Queryable } from "../agent-engine/queue/queue";

export type SourceType = "project_canonical" | "official_vendor" | "approved_internal" | "external";
export type SourceState = "active" | "superseded" | "revoked";

export interface SourceRecord {
  sourceId: string;
  organizationId: string;
  uri: string;
  title: string;
  owner: string;
  license: string;
  version: string;
  sourceType: SourceType;
  createdAt: string;
  scope?: string;
  retrievedAt?: string;
  lastVerifiedAt?: string;
  contentHash?: string;
  state?: SourceState;
}

export type SourceInput = Omit<SourceRecord, "sourceId" | "createdAt">;
export interface SourceRegistration { created: boolean; record: SourceRecord; }

function sourceKey(source: SourceInput): string {
  return `source:${source.organizationId}:${source.uri}:${source.version}`;
}

function validate(source: SourceInput): void {
  if (!source.organizationId.trim() || !source.uri.trim() || !source.title.trim() || !source.owner.trim() || !source.license.trim() || !source.version.trim() || !["project_canonical", "official_vendor", "approved_internal", "external"].includes(source.sourceType)) throw new Error("source_registry_invalid");
  try { const parsed = new URL(source.uri); if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid_protocol"); } catch { throw new Error("source_registry_invalid"); }
}

export function registerSource(source: SourceInput, existing: readonly SourceRecord[], createdAt = "1970-01-01T00:00:00.000Z"): SourceRegistration {
  validate(source);
  const sourceId = sourceKey(source);
  const current = existing.find((item) => item.sourceId === sourceId);
  if (current) return { created: false, record: current };
  return { created: true, record: { ...source, sourceId, createdAt, state: source.state ?? "active" } };
}

type RegistryRow = { organization_id: string; source_id: string; uri: string; title: string; owner: string; license: string; version: string; source_type: SourceType; scope: string | null; retrieved_at: string | Date | null; last_verified_at: string | Date | null; content_hash: string | null; state: SourceState; created_at: string | Date };

function toIso(value: string | Date | null): string | undefined { return value == null ? undefined : value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function fromRow(row: RegistryRow): SourceRecord {
  return { sourceId: row.source_id, organizationId: row.organization_id, uri: row.uri, title: row.title, owner: row.owner, license: row.license, version: row.version, sourceType: row.source_type, createdAt: toIso(row.created_at)!, ...(row.scope == null ? {} : { scope: row.scope }), ...(toIso(row.retrieved_at) ? { retrievedAt: toIso(row.retrieved_at) } : {}), ...(toIso(row.last_verified_at) ? { lastVerifiedAt: toIso(row.last_verified_at) } : {}), ...(row.content_hash == null ? {} : { contentHash: row.content_hash }), state: row.state };
}

export interface PostgresSourceRegistry { register(source: SourceInput, createdAt?: string): Promise<SourceRegistration>; list(organizationId: string): Promise<SourceRecord[]>; }

export function createPostgresSourceRegistry(db: Queryable, table = "hermes_source_registry"): PostgresSourceRegistry {
  if (!/^\w+$/.test(table)) throw new Error("source_registry_table_invalid");
  return {
    async register(source, createdAt = new Date().toISOString()) {
      validate(source);
      const sourceId = sourceKey(source);
      const result = await db.query<RegistryRow>(`INSERT INTO ${table} (organization_id, source_id, uri, title, owner, license, version, source_type, scope, retrieved_at, last_verified_at, content_hash, state, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (organization_id, source_id) DO UPDATE SET source_id = EXCLUDED.source_id
        RETURNING organization_id, source_id, uri, title, owner, license, version, source_type, scope, retrieved_at, last_verified_at, content_hash, state, created_at`,
        [source.organizationId, sourceId, source.uri, source.title, source.owner, source.license, source.version, source.sourceType, source.scope ?? null, source.retrievedAt ?? null, source.lastVerifiedAt ?? null, source.contentHash ?? null, source.state ?? "active", createdAt]);
      const record = fromRow(result.rows[0]);
      return { created: result.rows[0].created_at === createdAt || new Date(result.rows[0].created_at).toISOString() === new Date(createdAt).toISOString(), record };
    },
    async list(organizationId) {
      if (!organizationId.trim()) throw new Error("source_registry_invalid");
      const result = await db.query<RegistryRow>(`SELECT organization_id, source_id, uri, title, owner, license, version, source_type, scope, retrieved_at, last_verified_at, content_hash, state, created_at FROM ${table} WHERE organization_id = $1 ORDER BY source_id`, [organizationId]);
      return result.rows.map(fromRow);
    },
  };
}
