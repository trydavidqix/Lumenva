import { createHash } from "node:crypto";

import { assertJobTransition } from "@/lib/content-os/jobs";
import type { ProviderJobState } from "@/lib/content-os/providers/types";

export type CreativeJob = {
  id: string;
  organization_id: string;
  content_item_id: string | null;
  provider: string;
  operation: string;
  request_hash: string;
  idempotency_key: string;
  provider_job_id: string | null;
  state: ProviderJobState;
  parameters: Record<string, unknown>;
  attempts: number;
  last_error_code: string | null;
  last_error_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancel_requested_at: string | null;
};

type QueryResult<T> = { data: T; error: { code?: string; message: string } | null };
type CreativeJobQuery = {
  select: (columns?: string) => CreativeJobQuery;
  insert: (row: Record<string, unknown>) => CreativeJobQuery;
  update: (row: Record<string, unknown>) => CreativeJobQuery;
  eq: (field: string, value: unknown) => CreativeJobQuery;
  maybeSingle: () => Promise<QueryResult<CreativeJob | null>>;
  single: () => Promise<QueryResult<CreativeJob>>;
};
export type CreativeJobDb = {
  from: (table: "creative_jobs" | "event_log") => CreativeJobQuery;
};

export type CreateCreativeJobInput = {
  organizationId: string;
  contentItemId?: string | null;
  provider: string;
  operation: string;
  idempotencyKey: string;
  parameters?: Record<string, unknown>;
};

export class CreativeJobIdempotencyConflict extends Error { readonly code = "idempotency_conflict"; }
export class CreativeJobValidationError extends Error { readonly code = "creative_job_invalid"; }

function hash(input: CreateCreativeJobInput): string {
  return createHash("sha256").update(JSON.stringify({
    contentItemId: input.contentItemId ?? null,
    provider: input.provider,
    operation: input.operation,
    parameters: input.parameters ?? {},
  })).digest("hex");
}

function assertInput(input: CreateCreativeJobInput): void {
  if (!input.organizationId.trim() || !input.provider.trim() || !input.operation.trim() || !input.idempotencyKey.trim()) {
    throw new CreativeJobValidationError("Organization, provider, operation and idempotency key are required.");
  }
}

export async function createCreativeJob(db: CreativeJobDb, input: CreateCreativeJobInput): Promise<{ job: CreativeJob; reused: boolean }> {
  assertInput(input);
  const requestHash = hash(input);
  const existing = await db.from("creative_jobs").select("*").eq("organization_id", input.organizationId).eq("idempotency_key", input.idempotencyKey).maybeSingle() as QueryResult<CreativeJob | null>;
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    if (existing.data.request_hash !== requestHash) throw new CreativeJobIdempotencyConflict("Idempotency key was already used with a different payload.");
    return { job: existing.data, reused: true };
  }
  const inserted = await db.from("creative_jobs").insert({
    organization_id: input.organizationId,
    content_item_id: input.contentItemId ?? null,
    provider: input.provider,
    operation: input.operation,
    request_hash: requestHash,
    idempotency_key: input.idempotencyKey,
    state: "queued",
    parameters: input.parameters ?? {},
  }).select("*").single() as QueryResult<CreativeJob>;
  if (inserted.error) {
    const raced = await db.from("creative_jobs").select("*").eq("organization_id", input.organizationId).eq("idempotency_key", input.idempotencyKey).maybeSingle() as QueryResult<CreativeJob | null>;
    if (!raced.error && raced.data && raced.data.request_hash === requestHash) return { job: raced.data, reused: true };
    throw new Error(inserted.error.message);
  }
  await db.from("event_log").insert({
    organization_id: input.organizationId,
    event_type: "content.asset_requested",
    entity_kind: "creative_job",
    entity_id: inserted.data.id,
    payload: { organizationId: input.organizationId, entityId: inserted.data.id, provider: input.provider, operation: input.operation },
    metadata: { request_id: input.idempotencyKey },
  }).select("id").maybeSingle();
  return { job: inserted.data, reused: false };
}

export async function getCreativeJob(db: CreativeJobDb, organizationId: string, id: string): Promise<CreativeJob | null> {
  const result = await db.from("creative_jobs").select("*").eq("organization_id", organizationId).eq("id", id).maybeSingle() as QueryResult<CreativeJob | null>;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function requestCreativeJobCancellation(db: CreativeJobDb, job: CreativeJob): Promise<CreativeJob> {
  if (job.state === "succeeded" || job.state === "failed" || job.state === "cancelled") throw new CreativeJobValidationError("Terminal creative jobs cannot be cancelled.");
  const result = await db.from("creative_jobs").update({ cancel_requested_at: new Date().toISOString(), state: "cancelled", completed_at: new Date().toISOString() }).eq("organization_id", job.organization_id).eq("id", job.id).eq("state", job.state).select("*").single() as QueryResult<CreativeJob>;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function applyCreativeProviderResult(db: CreativeJobDb, job: CreativeJob, result: { state: ProviderJobState; providerJobId?: string | null; errorCode?: string | null }): Promise<CreativeJob> {
  if (result.state !== job.state) assertJobTransition(job.state, result.state);
  const terminal = ["succeeded", "failed", "cancelled"].includes(result.state);
  const updated = await db.from("creative_jobs").update({
    state: result.state,
    provider_job_id: result.providerJobId ?? job.provider_job_id,
    ...(result.errorCode !== undefined ? { last_error_code: result.errorCode, last_error_at: new Date().toISOString() } : {}),
    ...(result.state === "running" ? { started_at: job.started_at ?? new Date().toISOString(), attempts: job.attempts + 1 } : {}),
    ...(terminal ? { completed_at: new Date().toISOString() } : {}),
  }).eq("organization_id", job.organization_id).eq("id", job.id).select("*").single() as QueryResult<CreativeJob>;
  if (updated.error) throw new Error(updated.error.message);
  return updated.data;
}
