import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { ContentOsValidationError, ContentSourceService } from "@/lib/content-os/intelligence/source-service";
import { SupabaseIntelligenceRepository } from "@/lib/content-os/intelligence/supabase-repository";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = z.object({ catalog_key: z.string().trim().min(1).max(120) }).strict();

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_sources" });
  if (!authz.ok) return authz.response;

  try {
    const db = await createClient();
    const { data, error } = await db
      .from("content_sources")
      .select("id,organization_id,name,provider,source_type,configuration,status,external_ref,last_collected_at,created_at,updated_at")
      .eq("organization_id", authz.org.orgId)
      .order("created_at", { ascending: false });
    if (error) return fail("internal_error", "Não foi possível listar as fontes.", 500, { requestId });
    return ok(data ?? [], { requestId });
  } catch {
    return fail("internal_error", "Não foi possível listar as fontes.", 500, { requestId });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_sources" });
  if (!authz.ok) return authz.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail("invalid_request", "JSON inválido.", 400, { requestId });
  }
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_request", "Dados inválidos.", 400, { requestId, details: parsed.error.flatten() });

  try {
    const db = await createClient();
    const service = new ContentSourceService(new SupabaseIntelligenceRepository(db));
    const source = await service.createFromCatalog({ organizationId: authz.org.orgId, catalogKey: parsed.data.catalog_key });
    void audit({
      action: "content_os.source_created",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "content_source",
      resourceId: source.id,
      requestId,
      metadata: { provider: source.provider, catalog_key: parsed.data.catalog_key },
    });
    return ok(source, { requestId, status: 201 });
  } catch (error) {
    if (error instanceof ContentOsValidationError) return fail("invalid_request", error.message, 400, { requestId });
    return fail("internal_error", "Não foi possível criar a fonte.", 500, { requestId });
  }
}
