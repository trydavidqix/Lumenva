import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { fail, noContent, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
interface RouteParams { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  if (process.env.CONVERSATION_ARCHIVE_V1 !== "true") return fail("not_found", "Recurso não encontrado.", 404, { requestId });
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { id } = await params;
  const supabase = await createClient();
  const conv = await supabase.from("conversations").select("organization_id").eq("id", id).eq("organization_id", authz.org.orgId).maybeSingle();
  if (conv.error) return fail("internal_error", conv.error.message, 500, { requestId });
  if (!conv.data) return fail("not_found", "Conversa não encontrada.", 404, { requestId });
  const { data, error } = await supabase.from("conversation_archives").upsert({ organization_id: authz.org.orgId, conversation_id: id, user_id: authz.user.id }, { onConflict: "conversation_id,user_id" }).select("conversation_id, archived_at").single();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  void audit({ action: "conversation.archived", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "conversation", resourceId: id, requestId });
  return ok(data, { requestId });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  if (process.env.CONVERSATION_ARCHIVE_V1 !== "true") return fail("not_found", "Recurso não encontrado.", 404, { requestId });
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("conversation_archives").delete().eq("conversation_id", id).eq("organization_id", authz.org.orgId).eq("user_id", authz.user.id).select("conversation_id").maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Conversa não arquivada.", 404, { requestId });
  void audit({ action: "conversation.unarchived", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "conversation", resourceId: id, requestId });
  return noContent(requestId);
}
