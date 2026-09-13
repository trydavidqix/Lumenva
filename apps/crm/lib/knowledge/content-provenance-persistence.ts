import type { ContentProvenanceInput } from "./content-provenance";

type Queryable = { query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[] }> };

export async function ensureContentProvenanceStore(db: Queryable): Promise<void> {
  await db.query(`CREATE TABLE IF NOT EXISTS content_provenance (
    content_id text PRIMARY KEY, skill text NOT NULL, content text NOT NULL,
    source text NOT NULL, freshness text NOT NULL, confidence double precision NOT NULL,
    generated_at timestamptz NOT NULL, organization_id text NOT NULL
  )`);
}

export async function persistContentProvenance(db: Queryable, organizationId: string, input: ContentProvenanceInput): Promise<void> {
  if (!organizationId.trim()) throw new Error("content_provenance_tenant_required");
  await db.query(`INSERT INTO content_provenance (content_id, skill, content, source, freshness, confidence, generated_at, organization_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (content_id) DO NOTHING`,
    [input.contentId, input.skill, input.content, input.source, input.freshness, input.confidence, input.generatedAt, organizationId]);
}

export async function loadContentProvenance(db: Queryable, organizationId: string, contentId: string): Promise<ContentProvenanceInput | null> {
  const result = await db.query<any>("SELECT content_id,skill,content,source,freshness,confidence,generated_at,organization_id FROM content_provenance WHERE organization_id=$1 AND content_id=$2", [organizationId, contentId]);
  const row = result.rows[0]; if (!row) return null;
  return { contentId: row.content_id, skill: row.skill, content: row.content, source: row.source, freshness: row.freshness, confidence: Number(row.confidence), generatedAt: new Date(row.generated_at).toISOString() };
}
