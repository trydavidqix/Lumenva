import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { cronSecretMatches } from "@/lib/auth/cron-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectPublicationMetrics, type PublicationMetricSnapshot } from "@/lib/content-os/distribution/metrics-service";
import { getPostizClientFromEnv } from "@/lib/content-os/providers/postiz/client";

export const dynamic = "force-dynamic";

type MetricsQuery = {
  select(columns: string): MetricsQuery;
  eq(column: string, value: string): MetricsQuery;
  order(column: string, options: { ascending: boolean }): MetricsQuery;
  limit(value: number): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  upsert(row: Record<string, unknown>, options: { onConflict: string }): MetricsQuery;
  single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};
type MetricsDb = { from(table: string): MetricsQuery };

export async function runMetricsTick(): Promise<{ processed: number; collected: number; skipped: number }> {
  const db = createAdminClient() as unknown as MetricsDb;
  const client = getPostizClientFromEnv();
  if (!client) throw new Error("Content OS Postiz provider is not configured");
  const provider = { metrics: (id: string) => client.metrics(id) };
  const jobs = await db.from("publication_jobs").select("id,organization_id,provider_publication_id,state,connection_id").eq("state", "succeeded").order("published_at", { ascending: false }).limit(50);
  if (jobs.error) throw new Error(jobs.error.message);
  let collected = 0;
  let skipped = 0;
  for (const job of jobs.data ?? []) {
    if (typeof job.provider_publication_id !== "string" || !job.provider_publication_id) { skipped += 1; continue; }
    const connection = await db.from("distribution_connections").select("provider,status").eq("organization_id", String(job.organization_id)).eq("id", String(job.connection_id)).maybeSingle();
    if (connection.error) throw new Error(connection.error.message);
    if (!connection.data || connection.data.provider !== "postiz" || connection.data.status !== "active") { skipped += 1; continue; }
    const metricsRepository = {
      findPublication: async (organizationId: string, publicationJobId: string) => ({ id: publicationJobId, providerPublicationId: String(job.provider_publication_id), state: "succeeded" }),
      upsertSnapshot: async (snapshot: PublicationMetricSnapshot) => {
        const result = await db.from("publication_metrics").upsert(snapshot, { onConflict: "organization_id,publication_job_id,captured_at" }).select("*").single();
        if (result.error || !result.data) throw new Error(result.error?.message ?? "metrics_snapshot_failed");
        return result.data as typeof snapshot;
      },
    };
    await collectPublicationMetrics(metricsRepository, provider, { organizationId: String(job.organization_id), publicationJobId: String(job.id) });
    collected += 1;
  }
  return { processed: jobs.data?.length ?? 0, collected, skipped };
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const auth = req.headers.get("authorization") ?? "";
  const secret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : req.headers.get("x-cron-secret")?.trim() ?? "";
  if (!cronSecretMatches(secret)) return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  try { return ok(await runMetricsTick(), { requestId }); }
  catch (error) { return fail("provider_unavailable", error instanceof Error ? error.message : "Metrics worker unavailable.", 503, { requestId }); }
}

export async function POST(req: NextRequest): Promise<Response> { return GET(req); }
