import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createCreativeJob, CreativeJobIdempotencyConflict, CreativeJobValidationError } from "@/lib/content-os/creative/job-service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const schema = z.object({ provider: z.string().trim().min(1).max(80), operation: z.string().trim().min(1).max(120), content_item_id: z.string().uuid().nullable().optional(), parameters: z.record(z.string(), z.unknown()).optional() }).strict();

export async function GET(): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_creative_jobs" }); if (!authz.ok) return authz.response;
  const db = await createClient(); const { data, error } = await db.from("creative_jobs").select("*").eq("organization_id", authz.org.orgId).order("created_at", { ascending: false }).limit(100);
  if (error) return fail("internal_error", "Não foi possível listar os jobs criativos.", 500, { requestId }); return ok(data ?? [], { requestId });
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_creative_jobs" }); if (!authz.ok) return authz.response;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim(); if (!idempotencyKey) return fail("invalid_request", "Idempotency-Key é obrigatório.", 400, { requestId });
  let raw: unknown; try { raw = await request.json(); } catch { return fail("invalid_request", "JSON inválido.", 400, { requestId }); }
  const parsed = schema.safeParse(raw); if (!parsed.success) return fail("invalid_request", "Dados inválidos.", 400, { requestId, details: parsed.error.flatten() });
  try {
    const db = await createClient();
    const result = await createCreativeJob(db as never, { organizationId: authz.org.orgId, provider: parsed.data.provider, operation: parsed.data.operation, idempotencyKey, contentItemId: parsed.data.content_item_id ?? null, parameters: parsed.data.parameters ?? {} });
    void audit({ action: "content_os.creative_job_created", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "creative_job", resourceId: result.job.id, requestId, metadata: { reused: result.reused, provider: result.job.provider } });
    return ok(result, { requestId, status: result.reused ? 200 : 201 });
  } catch (error) {
    if (error instanceof CreativeJobIdempotencyConflict) return fail(error.code, error.message, 409, { requestId });
    if (error instanceof CreativeJobValidationError) return fail(error.code, error.message, 400, { requestId });
    return fail("internal_error", "Não foi possível criar o job criativo.", 500, { requestId });
  }
}
