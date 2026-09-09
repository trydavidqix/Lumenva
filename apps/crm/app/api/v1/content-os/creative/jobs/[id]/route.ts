import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { getCreativeJob, requestCreativeJobCancellation, CreativeJobValidationError } from "@/lib/content-os/creative/job-service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_creative_jobs" }); if (!authz.ok) return authz.response;
  const { id } = await context.params; const job = await getCreativeJob(await createClient() as never, authz.org.orgId, id);
  if (!job) return fail("not_found", "Job criativo não encontrado.", 404, { requestId }); return ok(job, { requestId });
}

export async function DELETE(_request: NextRequest, context: Context): Promise<Response> {
  const requestId = randomUUID(); const authz = await requireRole("manager", { requestId, resource: "content_os_creative_jobs" }); if (!authz.ok) return authz.response;
  const { id } = await context.params; const db = await createClient(); const job = await getCreativeJob(db as never, authz.org.orgId, id);
  if (!job) return fail("not_found", "Job criativo não encontrado.", 404, { requestId });
  try { return ok(await requestCreativeJobCancellation(db as never, job), { requestId }); }
  catch (error) { if (error instanceof CreativeJobValidationError) return fail("invalid_state_transition", error.message, 422, { requestId }); return fail("internal_error", "Não foi possível cancelar o job criativo.", 500, { requestId }); }
}
