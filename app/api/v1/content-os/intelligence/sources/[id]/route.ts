import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { ContentOsNotFoundError, ContentOsValidationError, ContentSourceService } from "@/lib/content-os/intelligence/source-service";
import { SupabaseIntelligenceRepository } from "@/lib/content-os/intelligence/supabase-repository";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const patchSchema = z.object({ status: z.enum(["active", "disabled"]) }).strict();
const actionSchema = z.object({ action: z.literal("collect") }).strict();

export async function GET(_request: NextRequest, context: Params): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_sources" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  try {
    const db = await createClient();
    const { data, error } = await db.from("content_sources").select("*").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
    if (error) return fail("internal_error", "Não foi possível ler a fonte.", 500, { requestId });
    if (!data) return fail("not_found", "Fonte não encontrada.", 404, { requestId });
    return ok(data, { requestId });
  } catch {
    return fail("internal_error", "Não foi possível ler a fonte.", 500, { requestId });
  }
}

export async function PATCH(request: NextRequest, context: Params): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_sources" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_request", "Dados inválidos.", 400, { requestId, details: parsed.error.flatten() });
  try {
    const source = await new ContentSourceService(new SupabaseIntelligenceRepository(await createClient())).setStatus({ organizationId: authz.org.orgId, sourceId: id, status: parsed.data.status });
    void audit({ action: "content_os.source_status_changed", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "content_source", resourceId: id, requestId, metadata: { status: parsed.data.status } });
    return ok(source, { requestId });
  } catch (error) {
    if (error instanceof ContentOsNotFoundError) return fail("not_found", "Fonte não encontrada.", 404, { requestId });
    if (error instanceof ContentOsValidationError) return fail("invalid_request", error.message, 400, { requestId });
    return fail("internal_error", "Não foi possível atualizar a fonte.", 500, { requestId });
  }
}

export async function POST(request: NextRequest, context: Params): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_sources" });
  if (!authz.ok) return authz.response;
  const { id } = await context.params;
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  if (!actionSchema.safeParse(raw).success) return fail("invalid_request", "Dados inválidos.", 400, { requestId });
  try {
    const db = await createClient();
    const repository = new SupabaseIntelligenceRepository(db);
    const source = await repository.findSource(authz.org.orgId, id);
    if (!source) return fail("not_found", "Fonte não encontrada.", 404, { requestId });
    if (source.status !== "active") return fail("invalid_request", "Somente fontes ativas podem ser coletadas.", 422, { requestId });
    await new ContentSourceService(repository).requestCollection({ organizationId: authz.org.orgId, sourceId: id });
    void audit({ action: "content_os.source_collection_requested", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "content_source", resourceId: id, requestId, metadata: {} });
    return ok({ requested: true, source_id: id }, { requestId });
  } catch (error) {
    if (error instanceof ContentOsNotFoundError) return fail("not_found", "Fonte não encontrada.", 404, { requestId });
    if (error instanceof ContentOsValidationError) return fail("invalid_request", error.message, 422, { requestId });
    return fail("internal_error", "Não foi possível solicitar a coleta.", 500, { requestId });
  }
}
