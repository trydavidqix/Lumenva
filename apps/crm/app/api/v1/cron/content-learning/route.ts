import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { cronSecretMatches } from "@/lib/auth/cron-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectContentDecay, type LearningContentItem, type LearningMetricSnapshot } from "@/lib/content-os/learning/decay-service";
import { createRefreshCandidates, type UpdateRepository } from "@/lib/content-os/learning/update-service";

export const dynamic = "force-dynamic";

type QueryResponse = { data: unknown[] | null; error: { message: string } | null };

type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  ilike(column: string, value: string): QueryBuilder;
  limit(value: number): QueryBuilder;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  insert(row: Record<string, unknown>): QueryBuilder;
  single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

type LearningDb = { from(table: string): QueryBuilder };

function rows(data: unknown[] | null): Record<string, unknown>[] {
  return (data ?? []).filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object");
}

function repository(db: LearningDb, _organizationId: string): { decay: Parameters<typeof detectContentDecay>[0]; update: UpdateRepository } {
  const decay = {
    async listPublishedContent(org: string): Promise<LearningContentItem[]> {
      const result = await db.from("content_items").select("id,organization_id,title,content_type,status,created_at,updated_at").eq("organization_id", org).eq("status", "published").ilike("content_type", "blog%").limit(200);
      if (result.error) throw new Error(result.error.message);
      return rows(result.data).map((row) => ({ id: String(row.id), organizationId: String(row.organization_id), title: String(row.title), contentType: String(row.content_type), status: String(row.status), publishedAt: typeof row.created_at === "string" ? row.created_at : null, updatedAt: typeof row.updated_at === "string" ? row.updated_at : null }));
    },
    async listMetricSnapshots(org: string, itemIds: string[]): Promise<LearningMetricSnapshot[]> {
      if (!itemIds.length) return [];
      const result = await db.from("publication_metrics").select("organization_id,captured_at,metrics,publication_jobs!inner(content_item_id)").eq("organization_id", org).limit(1000);
      if (result.error) throw new Error(result.error.message);
      return rows(result.data).flatMap((row) => {
        const job = row.publication_jobs as Record<string, unknown> | null;
        if (!job || !itemIds.includes(String(job.content_item_id)) || typeof row.captured_at !== "string" || !row.metrics || typeof row.metrics !== "object") return [];
        return [{ organizationId: org, contentItemId: String(job.content_item_id), capturedAt: row.captured_at, metrics: row.metrics as LearningMetricSnapshot["metrics"] }];
      });
    },
  };
  const update: UpdateRepository = {
    async findRefreshCandidate(org, key) {
      const result = await db.from("content_items").select("id,organization_id,title,content_type,status,body").eq("organization_id", org).eq("content_type", "blog.refresh").limit(200);
      if (result.error) throw new Error(result.error.message);
      const row = rows(result.data).find((value) => (value.body as Record<string, unknown> | null)?.idempotency_key === key);
      return row ? { id: String(row.id), organizationId: org, sourceContentItemId: String((row.body as Record<string, unknown>).source_content_item_id), title: String(row.title), contentType: String(row.content_type), status: "draft", body: (row.body as Record<string, unknown>), idempotencyKey: key } : null;
    },
    async createRefreshCandidate(input) {
      const result = await db.from("content_items").insert({ organization_id: input.organizationId, content_type: input.contentType, title: input.title, body: input.body, status: input.status }).select("*").single();
      if (result.error || !result.data) throw new Error(result.error?.message ?? "refresh_candidate_failed");
      return { ...input, id: String(result.data.id) };
    },
    async findLearningEvent(org, key) {
      const result = await db.from("content_learning_events").select("*").eq("organization_id", org).eq("idempotency_key", key).maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) return null;
      return { organizationId: org, contentItemId: String(result.data.content_item_id), eventType: String(result.data.event_type) as "content_decay_detected" | "content_refresh_candidate_created", occurredAt: String(result.data.occurred_at), idempotencyKey: key, payload: (result.data.payload as Record<string, unknown>) ?? {} };
    },
    async createLearningEvent(input) {
      const result = await db.from("content_learning_events").insert({ organization_id: input.organizationId, content_item_id: input.contentItemId, event_type: input.eventType, idempotency_key: input.idempotencyKey, occurred_at: input.occurredAt, payload: input.payload }).select("*").single();
      if (result.error || !result.data) throw new Error(result.error?.message ?? "learning_event_failed");
      return input;
    },
  };
  return { decay, update };
}

export async function runLearningTick(): Promise<{ organizations: number; candidates: number; events: number }> {
  const db = createAdminClient() as unknown as LearningDb;
  const items = await db.from("content_items").select("organization_id").eq("status", "published").ilike("content_type", "blog%").limit(1000);
  if (items.error) throw new Error(items.error.message);
  const organizations = [...new Set(rows(items.data).map((row) => String(row.organization_id)))];
  let candidates = 0;
  let events = 0;
  for (const organizationId of organizations) {
    const services = repository(db, organizationId);
    const detected = await detectContentDecay(services.decay, { organizationId });
    const results = await createRefreshCandidates(services.update, detected);
    candidates += results.length;
    events += results.reduce((sum, result) => sum + result.events.length, 0);
  }
  return { organizations: organizations.length, candidates, events };
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const auth = req.headers.get("authorization") ?? "";
  const secret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : req.headers.get("x-cron-secret")?.trim() ?? "";
  if (!cronSecretMatches(secret)) return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  try { return ok(await runLearningTick(), { requestId }); }
  catch (error) { return fail("internal_error", error instanceof Error ? error.message : "Learning worker unavailable.", 500, { requestId }); }
}

export async function POST(req: NextRequest): Promise<Response> { return GET(req); }
