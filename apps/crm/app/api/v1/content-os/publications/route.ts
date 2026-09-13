import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { publishContentItem, createPublicationJob, type PublishContentRepository } from "@/lib/content-os/distribution/publication-service";

export const dynamic = "force-dynamic";
const schema = z.object({ content_item_id: z.string().uuid(), connection_id: z.string().uuid(), title: z.string().trim().min(1).max(300), body: z.record(z.string(), z.unknown()), scheduled_for: z.string().datetime({ offset: true }).nullable().optional(), payload: z.record(z.string(), z.unknown()).optional() }).strict();

function repo(db: Awaited<ReturnType<typeof createClient>>): PublishContentRepository {
  return {
    async findContentItem(org, id) { const { data, error } = await db.from("content_items").select("id,organization_id,status").eq("organization_id", org).eq("id", id).maybeSingle(); if (error) throw error; return data ? { id: data.id, organizationId: data.organization_id, status: data.status } : null; },
    async findPublishGate(org, id) { const { data, error } = await db.from("content_quality_gates").select("status").eq("organization_id", org).eq("content_item_id", id).eq("gate_type", "publish").maybeSingle(); if (error) throw error; return data; },
    async updateContentItem(input) { const { error } = await db.from("content_items").update({ title: input.title, body: input.body, status: input.status }).eq("organization_id", input.organizationId).eq("id", input.contentItemId); if (error) throw error; },
    async createPublicationJob(input) { return createPublicationJob(db as never, input); },
  };
}

export async function GET(): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_publications" }); if (!authz.ok) return authz.response;
  const db = await createClient(); const { data, error } = await db.from("publication_jobs").select("*").eq("organization_id", authz.org.orgId).order("created_at", { ascending: false }).limit(100);
  if (error) return fail("internal_error", "Não foi possível listar as publicações.", 500, { requestId }); return ok(data ?? [], { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_publications" }); if (!authz.ok) return authz.response;
  const idempotencyKey = req.headers.get("idempotency-key")?.trim(); if (!idempotencyKey) return fail("invalid_request", "Idempotency-Key é obrigatório.", 400, { requestId });
  let raw: unknown; try { raw = await req.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = schema.safeParse(raw); if (!parsed.success) return fail("invalid_request", "Dados inválidos.", 400, { requestId, details: parsed.error.flatten() });
  try {
    const input = { organizationId: authz.org.orgId, contentItemId: parsed.data.content_item_id, connectionId: parsed.data.connection_id, idempotencyKey, scheduledFor: parsed.data.scheduled_for ?? null, payload: parsed.data.payload };
    const result = await publishContentItem(repo(await createClient()), { ...input, title: parsed.data.title, body: parsed.data.body });
    void audit({ action: "content_os.publication_requested", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "publication_job", resourceId: result.job.id, requestId, metadata: { reused: result.reused } });
    return ok(result, { requestId, status: result.reused ? 200 : 201 });
  } catch (error) { const code = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : "internal_error"; if (code === "idempotency_conflict") return fail(code, "Idempotency-Key já foi usada com outro payload.", 409, { requestId }); if (code === "publish_quality_gate_required" || code === "publication_not_publishable" || code === "publication_consent_required") return fail(code, "A publicação não está pronta para ser publicada.", 422, { requestId }); return fail("internal_error", "Não foi possível criar a publicação.", 500, { requestId }); }
}
