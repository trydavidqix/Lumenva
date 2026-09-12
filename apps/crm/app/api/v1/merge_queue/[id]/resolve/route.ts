import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "merge_queue" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data, error } = await supabase.from("merge_queue").select("id, organization_id, candidates, reason, status, created_at").eq("organization_id", authz.org.orgId).eq("status", "pending").order("created_at", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ?? [], { requestId });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "merge_queue" });
  if (!authz.ok) return authz.response;
  const input = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || (input.action !== "merge" && input.action !== "discard")) return fail("invalid_action", "Ação inválida.", 422, { requestId });
  const supabase = await createClient();
  const { id } = await ctx.params;
  const { data: item, error: itemError } = await supabase.from("merge_queue").select("id, organization_id, candidates, status").eq("id", id).eq("organization_id", authz.org.orgId).eq("status", "pending").maybeSingle();
  if (itemError) return fail("internal_error", itemError.message, 500, { requestId });
  if (!item) return fail("not_found", "Merge queue item não encontrado.", 404, { requestId });
  if (input.action === "discard") {
    const { error } = await supabase.from("merge_queue").update({ status: "discarded", resolved_by_user_id: authz.user.id, resolved_at: new Date().toISOString() }).eq("id", id).eq("organization_id", authz.org.orgId);
    if (error) return fail("internal_error", error.message, 500, { requestId });
    return ok({ action: "discarded", id }, { requestId });
  }
  const primaryId = typeof input.primary_id === "string" ? input.primary_id : "";
  const losers = Array.isArray(input.loser_ids) ? input.loser_ids.filter((v): v is string => typeof v === "string") : [];
  if (!primaryId || losers.length === 0 || !item.candidates.includes(primaryId) || losers.some((v) => !item.candidates.includes(v) || v === primaryId)) return fail("invalid_merge", "Primary/losers inválidos.", 422, { requestId });
  const { data, error } = await supabase.rpc("merge_contacts" as never, { p_primary_id: primaryId, p_loser_ids: losers, p_actor_user_id: authz.user.id, p_queue_id: id } as never);
  if (error) return fail("merge_failed", error.message, 500, { requestId });
  return ok({ action: "merged", id, result: data }, { requestId });
}
