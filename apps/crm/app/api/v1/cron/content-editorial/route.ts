import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { cronSecretMatches } from "@/lib/auth/cron-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupabaseIntelligenceRepository } from "@/lib/content-os/intelligence/supabase-repository";
import { ContentCollectionService } from "@/lib/content-os/intelligence/collection-service";
import { ContentOsNotFoundError, ContentOsValidationError } from "@/lib/content-os/intelligence/source-service";
import { getRssHubClientFromEnv } from "@/lib/content-os/providers/rsshub/client";
import { RSSHubIntelligenceProvider } from "@/lib/content-os/providers/rsshub/provider";
import { z } from "zod";
import { SupabaseEditorialRepository } from "@/lib/content-os/editorial/supabase-repository";
import { createEditorialRun, createEditorialStages, createProductionEditorialAdapters, runEditorialWorkflow } from "@/lib/content-os/orchestrator";
import { listEditorialRuns, saveEditorialRun } from "@/lib/content-os/orchestrator-persistence";

export const dynamic = "force-dynamic";

const collectionBodySchema = z.object({ source_id: z.uuid() }).strict();

export type EditorialCollectionDependencies = {
  collect: (input: { organizationId: string; sourceId: string }) => Promise<unknown>;
};

export async function handleEditorialCollection(
  req: NextRequest,
  dependencies: EditorialCollectionDependencies,
): Promise<Response> {
  const requestId = randomUUID();
  const organizationId = req.headers.get("x-organization-id");
  if (!organizationId || !z.uuid().safeParse(organizationId).success) {
    return fail("validation_failed", "x-organization-id válido é obrigatório.", 422, { requestId });
  }
  let raw: unknown;
  try { raw = await req.json(); } catch { return fail("invalid_request", "Body JSON inválido.", 400, { requestId }); }
  const parsed = collectionBodySchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "source_id UUID válido é obrigatório.", 422, { requestId });
  try {
    const result = await dependencies.collect({ organizationId, sourceId: parsed.data.source_id });
    return ok(result, { requestId });
  } catch (error) {
    const status = error instanceof ContentOsNotFoundError ? 404 : error instanceof ContentOsValidationError ? 422 : 500;
    const code = status === 404 ? "not_found" : status === 422 ? "validation_failed" : "internal_error";
    console.error("[content-editorial.cron] collection failed", { requestId, error });
    return fail(code, status === 404 ? "Editorial source not found." : status === 422 ? "Editorial request is invalid." : "Content collection failed.", status, { requestId });
  }
}

function createCollectionDependencies(): EditorialCollectionDependencies {
  const db = createAdminClient();
  const repository = new SupabaseIntelligenceRepository(db);
  const client = getRssHubClientFromEnv();
  const provider = client
    ? new RSSHubIntelligenceProvider({
      client,
      resolveSource: async ({ organizationId, sourceId }) => {
        const source = await repository.findSource(organizationId, sourceId);
        const route = source?.configuration.route;
        const sourceUrl = source?.configuration.sourceUrl;
        return source?.provider === "rsshub" && typeof route === "string" && typeof sourceUrl === "string"
          ? { id: source.id, route, sourceUrl }
          : null;
      },
    })
    : undefined;
  const service = new ContentCollectionService(repository, { get: (name) => name === "rsshub" ? provider : undefined });
  return { collect: ({ organizationId, sourceId }) => service.collect({ organizationId, sourceId }) };
}

/** Cron reconciliation for local dry-run runs. No provider or publication side effect. */
export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : req.headers.get("x-cron-secret")?.trim() ?? "";
  if (!cronSecretMatches(provided)) return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  try {
    const admin = createAdminClient();
    const repository = new SupabaseEditorialRepository(admin as never);
    // The scheduler owns discovery: collect all active curated sources before
    // creating runs, so a fresh signal can enter the pipeline without a
    // browser request. A single provider failure must not starve other tenants.
    const sources = await admin.from("content_sources").select("id,organization_id").eq("status", "active").eq("provider", "rsshub").limit(25);
    if (sources.error) throw new Error(sources.error.message);
    const collections: unknown[] = [];
    for (const source of sources.data ?? []) {
      try { collections.push(await createCollectionDependencies().collect({ organizationId: source.organization_id, sourceId: source.id })); }
      catch { /* provider health/error is represented by the next run retry */ }
    }
    const adapters = createProductionEditorialAdapters(repository);
    const allRuns = await listEditorialRuns(repository, 100);
    const resumable = allRuns.filter((run) => ["waiting_retry", "queued", "running"].includes(run.status));
    const runs = [];
    for (const run of resumable) {
      const next = await runEditorialWorkflow(run, { stages: createEditorialStages(adapters) });
      await saveEditorialRun(repository, next);
      await repository.persistArtifacts(next);
      runs.push(next);
    }
    const opportunities = await admin.from("content_opportunities").select("id,organization_id,title,created_at").eq("status", "new").order("priority", { ascending: false }).limit(10);
    if (opportunities.error) throw new Error(opportunities.error.message);
    let started = 0;
    for (const opportunity of opportunities.data ?? []) {
      const hasRecent = allRuns.some((run) => run.organizationId === opportunity.organization_id && run.topic === opportunity.title && Date.parse(run.createdAt) > Date.now() - 86_400_000);
      if (hasRecent) continue;
      const created = createEditorialRun({ organizationId: opportunity.organization_id, topic: opportunity.title });
      const next = await runEditorialWorkflow(created, { stages: createEditorialStages(adapters) });
      await saveEditorialRun(repository, next);
      await repository.persistArtifacts(next);
      started += 1;
      runs.push(next);
      if (next.status === "succeeded" || next.status === "blocked") {
        const updatedOpportunity = await admin.from("content_opportunities").update({ status: "accepted" }).eq("organization_id", opportunity.organization_id).eq("id", opportunity.id).select("id").maybeSingle();
        if (updatedOpportunity.error) throw new Error(updatedOpportunity.error.message);
      }
    }
    return ok({ dry_run: true, collections: collections.length, resumed: runs.length - started, started, runs }, { requestId });
  } catch (error) {
    console.error("[content-editorial.cron] tick failed", { requestId, error });
    return fail("not_configured", "Editorial repository unavailable.", 503, { requestId });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : req.headers.get("x-cron-secret")?.trim() ?? "";
  if (!cronSecretMatches(provided)) return fail("forbidden", "Cron secret missing or invalid.", 403);
  return handleEditorialCollection(req, createCollectionDependencies());
}
