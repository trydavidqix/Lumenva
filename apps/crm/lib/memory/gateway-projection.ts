export type MemoryRecord = {
  recordId: string;
  organizationId: string;
  subject: string;
  scope: string;
  namespace: `owner:${string}` | `home:${string}` | `company:${string}`;
  content: unknown;
  observedAt: string;
  confidence: number;
  supersedes?: string;
};
export type ProjectionQuery = { organizationId: string; subject: string; scope: string; namespace: MemoryRecord["namespace"] };
export type MemoryGateway = { listBackends(): readonly string[]; read(backend: string, query: ProjectionQuery): Promise<readonly MemoryRecord[]> };
function validNamespace(namespace: string): boolean { return /^(owner|home|company):[^:]+$/.test(namespace); }
function newer(a: MemoryRecord, b: MemoryRecord): MemoryRecord { const at = Date.parse(a.observedAt); const bt = Date.parse(b.observedAt); if (at !== bt) return at > bt ? a : b; return a.confidence >= b.confidence ? a : b; }
export async function rebuildProjectionViaGateway(gateway: MemoryGateway, query: ProjectionQuery): Promise<MemoryRecord[]> {
  if (!query.organizationId.trim() || !query.subject.trim() || !query.scope.trim() || !validNamespace(query.namespace)) throw new Error("projection_query_invalid");
  const backends = [...new Set(gateway.listBackends())].sort();
  const batches = await Promise.all(backends.map((backend) => gateway.read(backend, query)));
  const byId = new Map<string, MemoryRecord>();
  for (const record of batches.flat()) {
    if (record.organizationId !== query.organizationId || record.subject !== query.subject || record.scope !== query.scope || record.namespace !== query.namespace || !validNamespace(record.namespace)) continue;
    const previous = byId.get(record.recordId); byId.set(record.recordId, previous ? newer(previous, record) : { ...record });
  }
  const superseded = new Set<string>(); for (const record of byId.values()) if (record.supersedes) superseded.add(record.supersedes);
  return [...byId.values()].filter((record) => !superseded.has(record.recordId)).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}
