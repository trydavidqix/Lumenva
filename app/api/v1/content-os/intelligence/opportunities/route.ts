import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const statusSchema = z.enum(["new", "accepted", "rejected", "archived"]);
const updateSchema = z.object({ id: z.string().uuid(), status: statusSchema }).strict();

export async function GET(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_opportunities" });
  if (!authz.ok) return authz.response;
  const status = request.nextUrl.searchParams.get("status");
  if (status && !statusSchema.safeParse(status).success) return fail("invalid_request", "Status inválido.", 400, { requestId });
  try {
    const db = await createClient();
    let query = db.from("content_opportunities").select("*").eq("organization_id", authz.org.orgId).order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return fail("internal_error", "Não foi possível listar as oportunidades.", 500, { requestId });
    return ok(data ?? [], { requestId });
  } catch {
    return fail("internal_error", "Não foi possível listar as oportunidades.", 500, { requestId });
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "content_os_opportunities" });
  if (!authz.ok) return authz.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return fail("invalid_request", "Dados inválidos.", 400, { requestId, details: parsed.error.flatten() });
  try {
    const db = await createClient();
    const { data, error } = await db.from("content_opportunities").update({ status: parsed.data.status }).eq("organization_id", authz.org.orgId).eq("id", parsed.data.id).select("*").maybeSingle();
    if (error) return fail("internal_error", "Não foi possível atualizar a oportunidade.", 500, { requestId });
    if (!data) return fail("not_found", "Oportunidade não encontrada.", 404, { requestId });
    void audit({ action: "content_os.opportunity_status_changed", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "content_opportunity", resourceId: parsed.data.id, requestId, metadata: { status: parsed.data.status } });
    return ok(data, { requestId });
  } catch {
    return fail("internal_error", "Não foi possível atualizar a oportunidade.", 500, { requestId });
  }
}
