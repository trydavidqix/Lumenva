import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { env } from "@/lib/env";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { listEditorialRuns, loadEditorialRun, saveEditorialRun } from "@/lib/content-os/orchestrator-persistence";
import { SupabaseEditorialRepository } from "@/lib/content-os/editorial/supabase-repository";
import { createEditorialStages, createEditorialRun, createProductionEditorialAdapters, runEditorialWorkflow } from "@/lib/content-os/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  topic: z.string().trim().min(1).max(240),
  run_id: z.uuid().optional(),
}).strict();

function authorized(req: NextRequest): boolean {
  const expected = env.INTERNAL_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-internal-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() ?? "";
  return [header, bearer].some((provided) => provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected)));
}

function trustedOrganizationId(req: NextRequest): string | null {
  const value = req.headers.get("x-organization-id");
  return value && z.uuid().safeParse(value).success ? value : null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!authorized(req)) return fail("unauthenticated", "Internal secret missing or invalid.", 401, { requestId });
  const requestedLimit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  const organizationId = trustedOrganizationId(req);
  if (!organizationId) return fail("validation_failed", "x-organization-id válido é obrigatório.", 422, { requestId });
  try {
    const repository = new SupabaseEditorialRepository(createAdminClient() as never);
    const runs = await listEditorialRuns(repository, Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50);
    return ok({ dry_run: true, runs: runs.filter((run) => run.organizationId === organizationId) }, { requestId });
  } catch (error) { return fail("internal_error", error instanceof Error ? error.message : "Editorial persistence failed", 500, { requestId }); }
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!authorized(req)) return fail("unauthenticated", "Internal secret missing or invalid.", 401, { requestId });
  let raw: unknown;
  try { raw = await req.json(); } catch { return fail("invalid_request", "Body JSON inválido.", 400, { requestId }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Campos inválidos.", 422, { requestId, details: { errors: parsed.error.flatten() } });
  const organizationId = trustedOrganizationId(req);
  if (!organizationId) return fail("validation_failed", "x-organization-id válido é obrigatório.", 422, { requestId });

  try {
    const repository = new SupabaseEditorialRepository(createAdminClient() as never);
    const previous = parsed.data.run_id ? await loadEditorialRun(repository, organizationId, parsed.data.run_id) : null;
    if (parsed.data.run_id && !previous) return fail("not_found", "Editorial run not found.", 404, { requestId });
    if (previous && previous.topic !== parsed.data.topic) return fail("validation_failed", "Run does not match topic.", 422, { requestId });
    const adapters = createProductionEditorialAdapters(repository);
    const run = await runEditorialWorkflow(previous ?? createEditorialRun({ organizationId, topic: parsed.data.topic }), { stages: createEditorialStages(adapters) });
    await saveEditorialRun(repository, run);
    await repository.persistArtifacts(run);
    return ok({ dry_run: true, run }, { requestId });
  } catch (error) {
    return fail("not_configured", error instanceof Error ? error.message : "Editorial repository unavailable.", 503, { requestId });
  }
}
