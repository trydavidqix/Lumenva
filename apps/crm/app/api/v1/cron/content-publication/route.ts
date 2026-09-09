import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { cronSecretMatches } from "@/lib/auth/cron-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { executePublicationJob, type PublicationJob } from "@/lib/content-os/distribution/publication-service";
import { getPostizClientFromEnv } from "@/lib/content-os/providers/postiz/client";
import { PostizDistributionProvider } from "@/lib/content-os/providers/postiz/provider";

export const dynamic = "force-dynamic";

function secretFrom(req: NextRequest): string {
  const auth = req.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : req.headers.get("x-cron-secret")?.trim() ?? "";
}

type CronQuery = {
  select(columns: string): CronQuery;
  eq(column: string, value: string): CronQuery;
  order(column: string, options: { ascending: boolean }): CronQuery;
  limit(value: number): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
};
type CronDb = { from(table: string): CronQuery };

/** Claims queued local publication jobs and reconciles them through Postiz. */
export async function runPublicationTick(): Promise<{ processed: number; succeeded: number; failed: number; skipped: number }> {
  const db = createAdminClient() as never;
  const client = getPostizClientFromEnv();
  if (!client) throw new Error("Content OS Postiz provider is not configured");
  const provider = new PostizDistributionProvider(client);
  const queued = await (db as CronDb).from("publication_jobs").select("*").eq("state", "queued").order("created_at", { ascending: true }).limit(25);
  if (queued.error) throw new Error(queued.error.message);
  const summary = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  for (const row of (queued.data ?? []) as Record<string, unknown>[]) {
    const connection = await (db as CronDb).from("distribution_connections").select("provider,provider_connection_id,status").eq("organization_id", String(row.organization_id)).eq("id", String(row.connection_id)).maybeSingle();
    if (connection.error) throw new Error(connection.error.message);
    if (!connection.data || connection.data.status !== "active" || connection.data.provider !== "postiz") {
      summary.skipped += 1;
      continue;
    }
    const job: PublicationJob = {
      id: String(row.id), organization_id: String(row.organization_id), content_item_id: String(row.content_item_id),
      connection_id: String(connection.data.provider_connection_id ?? row.connection_id), idempotency_key: String(row.idempotency_key),
      request_hash: String(row.request_hash), provider_publication_id: typeof row.provider_publication_id === "string" ? row.provider_publication_id : null,
      state: String(row.state) as PublicationJob["state"], scheduled_for: typeof row.scheduled_for === "string" ? row.scheduled_for : null,
      published_at: typeof row.published_at === "string" ? row.published_at : null, published_url: typeof row.published_url === "string" ? row.published_url : null,
      attempts: Number(row.attempts ?? 0), last_error_code: typeof row.last_error_code === "string" ? row.last_error_code : null, last_error_at: typeof row.last_error_at === "string" ? row.last_error_at : null,
    };
    const result = await executePublicationJob(db, provider, job);
    summary.processed += 1;
    if (result.state === "succeeded") summary.succeeded += 1;
    if (result.state === "failed") summary.failed += 1;
  }
  return summary;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!cronSecretMatches(secretFrom(req))) return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  try { return ok(await runPublicationTick(), { requestId }); }
  catch (error) { return fail("provider_unavailable", error instanceof Error ? error.message : "Publication worker unavailable.", 503, { requestId }); }
}

export async function POST(req: NextRequest): Promise<Response> { return GET(req); }
