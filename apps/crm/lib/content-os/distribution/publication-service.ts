import { createHash } from "node:crypto";

import type { DistributionProvider } from "@/lib/content-os/providers/distribution";
import type { ProviderJobState } from "@/lib/content-os/providers/types";
import { assertJobTransition } from "@/lib/content-os/jobs";

export type PublicationJob = {
  id: string;
  organization_id: string;
  content_item_id: string;
  connection_id: string;
  idempotency_key: string;
  request_hash: string;
  provider_publication_id: string | null;
  state: ProviderJobState;
  scheduled_for: string | null;
  published_at: string | null;
  published_url: string | null;
  attempts: number;
  last_error_code: string | null;
  last_error_at: string | null;
};

type QueryResult<T> = Promise<{ data: T; error: { code?: string; message: string } | null }>;
type Query = { select: (...args: string[]) => Query; eq: (field: string, value: unknown) => Query; maybeSingle: () => QueryResult<PublicationJob | null>; single: () => QueryResult<PublicationJob>; insert: (row: Record<string, unknown>) => Query; update: (row: Record<string, unknown>) => Query };
export type PublicationDb = { from: (table: "publication_jobs" | "content_items" | "distribution_connections" | "event_log") => Query };

export type CreatePublicationInput = {
  organizationId: string;
  contentItemId: string;
  connectionId: string;
  idempotencyKey: string;
  scheduledFor?: string | null;
  payload?: Record<string, unknown>;
};

export type PublishContentInput = CreatePublicationInput & {
  title: string;
  body: Record<string, unknown>;
  likenessRefs?: readonly string[];
  consentRequirements?: readonly PublicationConsentRequirement[];
};

export type PublicationConsentRequirement = {
  consent_id: string;
  subject_ref: string;
  channel: "whatsapp" | "email" | "voice";
  purpose: string;
  likeness_ref?: string;
};

export type PublicationConsentRecord = {
  consent_id: string;
  organization_id: string;
  status: "GRANTED" | "REVOKED" | "EXPIRED" | "UNKNOWN";
  granted_at?: string | null;
  revoked_at?: string | null;
  retention_until?: string | null;
};

export type PublishContentRepository = {
  findContentItem(organizationId: string, contentItemId: string): Promise<{ id: string; organizationId: string; status: string } | null>;
  findPublishGate(organizationId: string, contentItemId: string): Promise<{ status: string } | null>;
  updateContentItem(input: { organizationId: string; contentItemId: string; title: string; body: Record<string, unknown>; status: "scheduled" | "published" }): Promise<void>;
  createPublicationJob(input: CreatePublicationInput): Promise<{ job: PublicationJob; reused: boolean }>;
  findConsent?: (organizationId: string, consentId: string) => Promise<PublicationConsentRecord | null>;
  publishWithConsent?: (input: { organizationId: string; contentItemId: string; title: string; body: Record<string, unknown>; consentIds: readonly string[] }) => Promise<void>;
};

export class PublicationQualityGateError extends Error {
  readonly code = "publish_quality_gate_required";
}

export class PublicationIdempotencyConflict extends Error {
  readonly code = "idempotency_conflict";
}

export class PublicationValidationError extends Error {
  readonly code = "publication_not_publishable";
}

export class PublicationConsentError extends Error {
  readonly code = "publication_consent_required";
}

async function assertPublicationConsent(repository: PublishContentRepository, input: PublishContentInput): Promise<void> {
  const likenessRefs = input.likenessRefs ?? [];
  const requirements = input.consentRequirements ?? [];
  if (likenessRefs.length === 0 && requirements.length === 0) return;
  if (!repository.findConsent || requirements.length === 0) {
    throw new PublicationConsentError("Active consent is required for generated likeness publication.");
  }
  const now = Date.now();
  for (const requirement of requirements) {
    if (requirement.likeness_ref && !likenessRefs.includes(requirement.likeness_ref)) {
      throw new PublicationConsentError("Consent does not cover the generated likeness reference.");
    }
    const consent = await repository.findConsent(input.organizationId, requirement.consent_id);
    if (!consent || consent.organization_id !== input.organizationId || consent.status !== "GRANTED") {
      throw new PublicationConsentError("Active consent is required for generated likeness publication.");
    }
    if (consent.granted_at && Date.parse(consent.granted_at) > now) throw new PublicationConsentError("Consent is not active yet.");
    if (consent.revoked_at && Date.parse(consent.revoked_at) <= now) throw new PublicationConsentError("Consent has been revoked.");
    if (consent.retention_until && Date.parse(consent.retention_until) <= now) throw new PublicationConsentError("Consent has expired.");
  }
}

/** Final local publisher. It never calls a CMS or provider directly. */
export async function publishContentItem(repository: PublishContentRepository, input: PublishContentInput): Promise<{ job: PublicationJob; reused: boolean }> {
  const requirements = input.consentRequirements ?? [];
  const item = await repository.findContentItem(input.organizationId, input.contentItemId);
  if (!item || item.organizationId !== input.organizationId) throw new PublicationValidationError("Content item not found for this organization.");
  const gate = await repository.findPublishGate(input.organizationId, input.contentItemId);
  if (!gate || gate.status !== "passed") throw new PublicationQualityGateError("Content item cannot be published without a passed publish quality gate.");
  await assertPublicationConsent(repository, input);
  // The local item is scheduled until the worker confirms the remote side
  // effect; never claim `published` before that confirmation.
  if (requirements.length > 0) {
    if (!repository.publishWithConsent) throw new PublicationConsentError("Atomic consent publication is unavailable.");
    await repository.publishWithConsent({ organizationId: input.organizationId, contentItemId: input.contentItemId, title: input.title, body: input.body, consentIds: requirements.map((requirement) => requirement.consent_id) });
  } else {
    await repository.updateContentItem({ organizationId: input.organizationId, contentItemId: input.contentItemId, title: input.title, body: input.body, status: "scheduled" });
  }
  return repository.createPublicationJob(input);
}

function hash(input: CreatePublicationInput): string {
  const canonical = JSON.stringify({ contentItemId: input.contentItemId, connectionId: input.connectionId, scheduledFor: input.scheduledFor ?? null, payload: input.payload ?? {} });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Creates the local job before any provider side effect. Safe to retry. */
export async function createPublicationJob(db: PublicationDb, input: CreatePublicationInput): Promise<{ job: PublicationJob; reused: boolean }> {
  const requestHash = hash(input);
  const existing = await db.from("publication_jobs").select("*").eq("organization_id", input.organizationId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    if (existing.data.request_hash !== requestHash) throw new PublicationIdempotencyConflict("Idempotency key was already used with a different payload.");
    return { job: existing.data, reused: true };
  }

  const item = await db.from("content_items").select("id, organization_id, status").eq("organization_id", input.organizationId).eq("id", input.contentItemId).maybeSingle();
  if (item.error) throw new Error(item.error.message);
  if (!item.data) throw new PublicationValidationError("Content item not found for this organization.");
  const connection = await db.from("distribution_connections").select("id, organization_id, status").eq("organization_id", input.organizationId).eq("id", input.connectionId).maybeSingle();
  if (connection.error) throw new Error(connection.error.message);
  if (!connection.data) throw new PublicationValidationError("Distribution connection not found for this organization.");

  const inserted = await db.from("publication_jobs").insert({ organization_id: input.organizationId, content_item_id: input.contentItemId, connection_id: input.connectionId, idempotency_key: input.idempotencyKey, request_hash: requestHash, scheduled_for: input.scheduledFor ?? null, state: "queued" }).select("*").single();
  if (inserted.error) {
    // A concurrent retry may have won the unique idempotency constraint.
    const raced = await db.from("publication_jobs").select("*").eq("organization_id", input.organizationId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (!raced.error && raced.data && raced.data.request_hash === requestHash) return { job: raced.data, reused: true };
    throw new Error(inserted.error.message);
  }
  await db.from("event_log").insert({ organization_id: input.organizationId, event_type: "content.publication_requested", entity_kind: "publication_job", entity_id: inserted.data.id, payload: { organizationId: input.organizationId, entityId: inserted.data.id, contentItemId: input.contentItemId }, metadata: { request_id: input.idempotencyKey } }).select("id").maybeSingle();
  return { job: inserted.data, reused: false };
}

export function applyProviderResult(job: PublicationJob, result: { state: ProviderJobState; providerPublicationId?: string; publishedUrl?: string }): Partial<PublicationJob> {
  if (result.state !== job.state) assertJobTransition(job.state, result.state);
  const patch: Partial<PublicationJob> = { state: result.state, provider_publication_id: result.providerPublicationId ?? job.provider_publication_id, published_url: result.publishedUrl ?? job.published_url };
  if (result.state === "succeeded") patch.published_at = new Date().toISOString();
  return patch;
}

export async function executePublicationJob(db: PublicationDb, provider: DistributionProvider, job: PublicationJob): Promise<PublicationJob> {
  if (job.state === "succeeded" || job.state === "cancelled" || job.last_error_code === "reconcile_required") return job;
  const running = job.state === "running" ? job : await updateJob(db, job, { state: "running", attempts: job.attempts + 1 });
  try {
    const result = await provider.publish({ organizationId: job.organization_id, idempotencyKey: job.idempotency_key, contentId: job.content_item_id, connectionId: job.connection_id, scheduledFor: job.scheduled_for ?? undefined });
    const updated = await updateJob(db, running, applyProviderResult(running, result));
    if (updated.state === "succeeded") {
      const content = await db.from("content_items").update({ status: "published" }).eq("organization_id", job.organization_id).eq("id", job.content_item_id).select("id").single();
      if (content.error) throw new Error(content.error.message);
      await db.from("event_log").insert({ organization_id: job.organization_id, event_type: "content.publication_published", entity_kind: "publication_job", entity_id: job.id, payload: { organizationId: job.organization_id, entityId: job.id, contentItemId: job.content_item_id }, metadata: { request_id: job.idempotency_key } }).select("id").maybeSingle();
    }
    return updated;
  } catch (error) {
    const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    const unknownOutcome = /timeout|timed out|abort/i.test(message);
    return updateJob(db, running, { state: "failed", last_error_code: unknownOutcome ? "reconcile_required" : (error instanceof Error ? error.name : "provider_error"), last_error_at: new Date().toISOString() });
  }
}

async function updateJob(db: PublicationDb, job: PublicationJob, patch: Partial<PublicationJob>): Promise<PublicationJob> {
  const result = await db.from("publication_jobs").update(patch).eq("organization_id", job.organization_id).eq("id", job.id).select("*").single();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
