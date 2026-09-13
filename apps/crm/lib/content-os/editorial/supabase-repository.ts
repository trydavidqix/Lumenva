import { createHash } from "node:crypto";
import type { Evidence } from "./contracts";
import type { EditorialRun, ProductionEditorialRepository } from "../orchestrator";
import type { EditorialPersistenceDb } from "../orchestrator-persistence";
import { createPublicationJob, publishContentItem, type CreatePublicationInput, type PublishContentRepository, type PublicationConsentRecord } from "../distribution/publication-service";

type Row = Record<string, unknown>;
type Query = {
  select(columns?: string): Query;
  eq(column: string, value: string): Query;
  ilike(column: string, value: string): Query;
  or(filters: string): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(value: number): Promise<{ data: Row[] | null; error: { message: string } | null }>;
  insert(values: Row | Row[]): Query;
  update(values: Row): Query;
  maybeSingle(): Promise<{ data: Row | null; error: { message: string } | null }>;
  single(): Promise<{ data: Row | null; error: { message: string } | null }>;
  then<TResult1 = { data: Row[] | null; error: { message: string } | null }, TResult2 = never>(onfulfilled?: ((value: { data: Row[] | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): Promise<TResult1 | TResult2>;
};
export type EditorialSupabaseClient = { from(table: string): Query };

function asIso(value: unknown): string {
  return typeof value === "string" && value ? value : new Date().toISOString();
}

export class SupabaseEditorialRepository implements ProductionEditorialRepository, EditorialPersistenceDb, PublishContentRepository {
  constructor(private readonly db: EditorialSupabaseClient) {}

  from(table: "content_research_runs"): Query {
    return this.db.from(table);
  }

  async listSignals(organizationId: string, topic: string) {
    const query = this.db.from("content_signals").select("id,title,body,source_url,published_at,observed_at")
      .eq("organization_id", organizationId).or(`title.ilike.%${topic}%,body.ilike.%${topic}%`).order("observed_at", { ascending: false }).limit(50);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []).map((row) => ({ id: String(row.id), title: String(row.title), body: typeof row.body === "string" ? row.body : null, sourceUrl: typeof row.source_url === "string" ? row.source_url : null, publishedAt: typeof row.published_at === "string" ? row.published_at : null, observedAt: asIso(row.observed_at) }));
  }

  async listEvidence(organizationId: string, topic: string): Promise<Evidence[]> {
    const result = await this.db.from("content_evidence").select("id,source_url,source_type,publisher,title,excerpt,published_at,retrieved_at").eq("organization_id", organizationId).or(`title.ilike.%${topic}%,excerpt.ilike.%${topic}%`).order("retrieved_at", { ascending: false }).limit(100);
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []).map((row) => ({ id: String(row.id), url: String(row.source_url), title: String(row.title ?? row.source_url), publisher: String(row.publisher ?? "Unknown"), kind: row.source_type === "primary" || row.source_type === "official" ? "primary" : row.source_type === "community" ? "community" : "secondary", excerpt: typeof row.excerpt === "string" ? row.excerpt : undefined, publishedAt: typeof row.published_at === "string" ? row.published_at : undefined, retrievedAt: asIso(row.retrieved_at) }));
  }

  async persistArtifacts(run: EditorialRun): Promise<void> {
    const research = run.outputs.research;
    const factcheck = run.outputs.factcheck;
    const gate = run.outputs.quality_gate;
    if (research) {
      const result = await this.db.from("content_research_runs").update({ result: research }).eq("id", run.id).eq("organization_id", run.organizationId);
      if (result.error) throw new Error(result.error.message);
      const evidence = Array.isArray(research.evidence) ? research.evidence : [];
      const existingEvidence = await this.db.from("content_evidence").select("id").eq("organization_id", run.organizationId).eq("research_run_id", run.id).limit(1);
      if (existingEvidence.error) throw new Error(existingEvidence.error.message);
      if (!existingEvidence.data?.length) {
        for (const item of evidence) {
          if (!item || typeof item !== "object") continue;
          const value = item as Record<string, unknown>;
          const url = typeof value.url === "string" ? value.url : "";
          if (!url) continue;
          const contentHash = createHash("sha256").update(JSON.stringify({ url, title: value.title, excerpt: value.excerpt })).digest("hex");
          const inserted = await this.db.from("content_evidence").insert({
            organization_id: run.organizationId,
            research_run_id: run.id,
            source_url: url,
            source_type: value.kind === "primary" ? "primary" : "secondary",
            publisher: typeof value.publisher === "string" ? value.publisher : null,
            title: typeof value.title === "string" ? value.title : url,
            excerpt: typeof value.excerpt === "string" ? value.excerpt : null,
            content_hash: contentHash,
            verification_status: "unreviewed",
            published_at: typeof value.publishedAt === "string" ? value.publishedAt : null,
            retrieved_at: typeof value.retrievedAt === "string" ? value.retrievedAt : run.updatedAt,
            metadata: { supportsClaimIds: value.supportsClaimIds ?? [], contradictsClaimIds: value.contradictsClaimIds ?? [] },
          });
          if (inserted.error) throw new Error(inserted.error.message);
        }
      }
    }
    const editor = run.outputs.editor ?? {};
    const title = typeof editor.title === "string" && editor.title.trim() ? editor.title : run.topic;
    // Persist the complete structured article contract. The public blog
    // adapter needs slug/type/SEO/sources in addition to the body blocks.
    const body = typeof editor.body === "string" ? { ...editor, markdown: editor.body } : editor;
    const existingItem = await this.db.from("content_items").select("id").eq("organization_id", run.organizationId).eq("id", run.id).maybeSingle();
    if (existingItem.error) throw new Error(existingItem.error.message);
    const contentItemId = existingItem.data?.id ? String(existingItem.data.id) : run.id;
    if (!existingItem.data) {
      const item = await this.db.from("content_items").insert({ id: contentItemId, organization_id: run.organizationId, content_type: "blog_article", title, body, status: "draft" }).select().single();
      if (item.error || !item.data) throw new Error(item.error?.message ?? "Editorial content item creation failed");
    } else {
      const item = await this.db.from("content_items").update({ title, body, status: "draft" }).eq("id", contentItemId).eq("organization_id", run.organizationId).select("id").single();
      if (item.error) throw new Error(item.error.message);
    }
    const linked = await this.db.from("content_research_runs").update({ content_item_id: contentItemId }).eq("id", run.id).eq("organization_id", run.organizationId);
    if (linked.error) throw new Error(linked.error.message);
    if (factcheck) {
      const claims = Array.isArray(factcheck.evaluations) ? factcheck.evaluations : [];
      const researchClaims = Array.isArray(research?.claims) ? research.claims : [];
      const existingClaims = await this.db.from("content_claims").select("id").eq("organization_id", run.organizationId).eq("research_run_id", run.id).limit(1);
      if (existingClaims.error) throw new Error(existingClaims.error.message);
      if (!existingClaims.data?.length) {
        for (const claim of claims) {
          if (!claim || typeof claim !== "object") continue;
          const value = claim as Record<string, unknown>;
          const sourceClaim = researchClaims.find((candidate) => String((candidate as Record<string, unknown>).id) === String(value.claimId));
          const sourceValue = (sourceClaim ?? {}) as Record<string, unknown>;
          const rawStatus = String(value.status ?? "open");
          const verificationStatus = rawStatus === "confirmed" ? "confirmed" : rawStatus === "conflicting" ? "conflicted" : rawStatus === "attributed" ? "partially_confirmed" : rawStatus === "rejected" ? "rejected" : "unconfirmed";
          const inserted = await this.db.from("content_claims").insert({ organization_id: run.organizationId, research_run_id: run.id, claim_key: String(value.claimId ?? value.id ?? "claim"), claim_text: String(value.text ?? sourceValue.text ?? ""), verification_status: verificationStatus, confidence: typeof value.confidence === "number" ? value.confidence : null, is_critical: sourceValue.importance === "critical", checked_at: run.updatedAt, notes: typeof value.reason === "string" ? value.reason : null });
          if (inserted.error) throw new Error(inserted.error.message);
        }
      }
      const claimRows = await this.db.from("content_claims").select("id,claim_key").eq("organization_id", run.organizationId).eq("research_run_id", run.id).limit(100);
      const evidenceRows = await this.db.from("content_evidence").select("id,metadata").eq("organization_id", run.organizationId).eq("research_run_id", run.id).limit(100);
      if (claimRows.error) throw new Error(claimRows.error.message);
      if (evidenceRows.error) throw new Error(evidenceRows.error.message);
      const evidenceByClaim = new Map<string, string[]>();
      for (const row of evidenceRows.data ?? []) {
        const metadata = row.metadata as Record<string, unknown> | null;
        for (const claimId of Array.isArray(metadata?.supportsClaimIds) ? metadata.supportsClaimIds : []) {
          const list = evidenceByClaim.get(String(claimId)) ?? [];
          list.push(String(row.id));
          evidenceByClaim.set(String(claimId), list);
        }
      }
      for (const row of claimRows.data ?? []) {
        for (const evidenceId of evidenceByClaim.get(String(row.claim_key)) ?? []) {
          const linked = await this.db.from("content_claim_evidence").insert({ organization_id: run.organizationId, claim_id: row.id, evidence_id: evidenceId, relationship: "supports" });
          if (linked.error && linked.error.message.toLowerCase().includes("duplicate") === false) throw new Error(linked.error.message);
        }
      }
    }
    if (gate) {
      const existingGate = await this.db.from("content_quality_gates").select("id").eq("organization_id", run.organizationId).eq("research_run_id", run.id).maybeSingle();
      if (existingGate.error) throw new Error(existingGate.error.message);
      if (existingGate.data) return;
      const inserted = await this.db.from("content_quality_gates").insert({ organization_id: run.organizationId, content_item_id: contentItemId, research_run_id: run.id, gate_type: "publish", status: gate.blocked ? "failed" : "passed", score: typeof gate.score === "number" ? gate.score : null, findings: gate, checked_by: "content-os-editorial", checked_at: run.updatedAt });
      if (inserted.error) throw new Error(inserted.error.message);
    }
  }

  async publishApproved(input: { organizationId: string; contentItemId: string | null; body: Record<string, unknown>; idempotencyKey: string }): Promise<Record<string, unknown>> {
    if (!input.contentItemId) return { published: false, dryRun: true, reason: "content_item_not_configured", idempotencyKey: input.idempotencyKey };
    const connections = await this.db.from("distribution_connections").select("id").eq("organization_id", input.organizationId).eq("status", "active").limit(1);
    if (connections.error) throw new Error(connections.error.message);
    const connectionId = connections.data?.[0]?.id ? String(connections.data[0].id) : null;
    if (!connectionId) return { published: false, dryRun: true, reason: "distribution_connection_not_configured", contentItemId: input.contentItemId, idempotencyKey: input.idempotencyKey };
    const title = typeof input.body.title === "string" ? input.body.title : "";
    const likenessRefs = Array.isArray(input.body.likeness_refs) ? input.body.likeness_refs.filter((value): value is string => typeof value === "string") : [];
    const consentRequirements = Array.isArray(input.body.consent_requirements) ? input.body.consent_requirements.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object")).map((value) => ({ consent_id: String(value.consent_id ?? ""), subject_ref: String(value.subject_ref ?? ""), channel: value.channel === "whatsapp" || value.channel === "voice" ? value.channel : "email", purpose: String(value.purpose ?? ""), likeness_ref: typeof value.likeness_ref === "string" ? value.likeness_ref : undefined })) : [];
    return publishContentItem(this, { organizationId: input.organizationId, contentItemId: input.contentItemId, connectionId, idempotencyKey: input.idempotencyKey, title, body: input.body, likenessRefs, consentRequirements });
  }

  async findContentItem(organizationId: string, contentItemId: string) {
    const result = await this.db.from("content_items").select("id,organization_id,status").eq("organization_id", organizationId).eq("id", contentItemId).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data ? { id: String(result.data.id), organizationId: String(result.data.organization_id), status: String(result.data.status) } : null;
  }

  async findPublishGate(organizationId: string, contentItemId: string) {
    const result = await this.db.from("content_quality_gates").select("status").eq("organization_id", organizationId).eq("content_item_id", contentItemId).eq("gate_type", "publish").maybeSingle();
    if (result.error) throw new Error(result.error.message);
    return result.data ? { status: String(result.data.status) } : null;
  }

  async findConsent(organizationId: string, consentId: string): Promise<PublicationConsentRecord | null> {
    const result = await this.db.from("contact_consents").select("consent_id,organization_id,status,granted_at,revoked_at,retention_until").eq("organization_id", organizationId).eq("consent_id", consentId).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) return null;
    const status = String(result.data.status);
    return { consent_id: String(result.data.consent_id), organization_id: String(result.data.organization_id), status: status === "GRANTED" || status === "REVOKED" || status === "EXPIRED" ? status : "UNKNOWN", granted_at: typeof result.data.granted_at === "string" ? result.data.granted_at : null, revoked_at: typeof result.data.revoked_at === "string" ? result.data.revoked_at : null, retention_until: typeof result.data.retention_until === "string" ? result.data.retention_until : null };
  }

  async updateContentItem(input: { organizationId: string; contentItemId: string; title: string; body: Record<string, unknown>; status: "scheduled" | "published" }): Promise<void> {
    const result = await this.db.from("content_items").update({ title: input.title, body: input.body, status: input.status }).eq("id", input.contentItemId).eq("organization_id", input.organizationId).select("id").single();
    if (result.error) throw new Error(result.error.message);
  }

  async createPublicationJob(input: CreatePublicationInput) {
    return createPublicationJob(this.db as never, input);
  }
}
