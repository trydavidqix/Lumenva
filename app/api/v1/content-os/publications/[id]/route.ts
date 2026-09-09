import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: Params): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_publications" }); if (!authz.ok) return authz.response;
  const { id } = await context.params; const db = await createClient(); const { data, error } = await db.from("publication_jobs").select("*").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (error) return fail("internal_error", "Não foi possível ler a publicação.", 500, { requestId }); if (!data) return fail("not_found", "Publicação não encontrada.", 404, { requestId }); return ok(data, { requestId });
}

export async function DELETE(_req: NextRequest, context: Params): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_publications" }); if (!authz.ok) return authz.response;
  const { id } = await context.params; const db = await createClient(); const current = await db.from("publication_jobs").select("id,state").eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (current.error) return fail("internal_error", "Não foi possível ler a publicação.", 500, { requestId }); if (!current.data) return fail("not_found", "Publicação não encontrada.", 404, { requestId });
  if (current.data.state === "succeeded" || current.data.state === "cancelled") return fail("invalid_state_transition", "Esta publicação não pode ser cancelada.", 422, { requestId });
  const { data, error } = await db.from("publication_jobs").update({ state: "cancelled" }).eq("organization_id", authz.org.orgId).eq("id", id).select("*").single(); if (error || !data) return fail("internal_error", "Não foi possível cancelar a publicação.", 500, { requestId });
  void audit({ action: "content_os.publication_cancelled", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "publication_job", resourceId: id, requestId, metadata: {} }); return ok(data, { requestId });
}
