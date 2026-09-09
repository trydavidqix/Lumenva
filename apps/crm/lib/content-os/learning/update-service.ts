/**
 * Turns decay observations into idempotent refresh candidates and learning
 * events.  The persistence boundary is intentionally small so implementations
 * can use the existing `content_items` and `content_learning_events` tables
 * without adding a migration or calling an external provider.
 */

import type { DecayCandidate } from "./decay-service";

export type RefreshCandidate = {
  id: string;
  organizationId: string;
  sourceContentItemId: string;
  title: string;
  contentType: string;
  status: "draft";
  body: Record<string, unknown>;
  idempotencyKey: string;
};

export type LearningEvent = {
  organizationId: string;
  contentItemId: string;
  eventType: "content_decay_detected" | "content_refresh_candidate_created";
  occurredAt: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export type UpdateRepository = {
  findRefreshCandidate(organizationId: string, idempotencyKey: string): Promise<RefreshCandidate | null>;
  createRefreshCandidate(input: Omit<RefreshCandidate, "id">): Promise<RefreshCandidate>;
  findLearningEvent(organizationId: string, idempotencyKey: string): Promise<LearningEvent | null>;
  createLearningEvent(input: LearningEvent): Promise<LearningEvent>;
};

export type RefreshCandidateResult = {
  candidate: RefreshCandidate;
  candidateReused: boolean;
  events: LearningEvent[];
};

export class UpdateValidationError extends Error {
  readonly code = "content_update_invalid";
}

function eventPayload(candidate: DecayCandidate): Record<string, unknown> {
  return {
    reason: candidate.reason,
    severity: candidate.severity,
    source_content_item_id: candidate.contentItemId,
    baseline: candidate.baseline,
    current: candidate.current,
    relative_drop: candidate.relativeDrop,
    metadata: candidate.metadata,
  };
}

function assertCandidate(candidate: DecayCandidate): void {
  if (!candidate.organizationId.trim() || !candidate.contentItemId.trim() || !candidate.title.trim()) throw new UpdateValidationError("Decay candidate is missing tenant, content item or title");
  if (!candidate.idempotencyKey.trim()) throw new UpdateValidationError("Decay candidate idempotency key is required");
}

/** Creates one draft refresh item and records the two learning events exactly once. */
export async function createRefreshCandidate(
  repository: UpdateRepository,
  candidate: DecayCandidate,
  options: { now?: string } = {},
): Promise<RefreshCandidateResult> {
  assertCandidate(candidate);
  const occurredAt = options.now ?? candidate.detectedAt;
  if (!Number.isFinite(Date.parse(occurredAt))) throw new UpdateValidationError("Event time must be an ISO date");
  const candidateKey = `refresh:${candidate.idempotencyKey}`;
  const existing = await repository.findRefreshCandidate(candidate.organizationId, candidateKey);
  let refreshCandidate: RefreshCandidate;
  let candidateReused = false;
  if (existing) {
    if (existing.organizationId !== candidate.organizationId || existing.sourceContentItemId !== candidate.contentItemId) throw new UpdateValidationError("Refresh candidate tenant or source mismatch");
    refreshCandidate = existing;
    candidateReused = true;
  } else {
    refreshCandidate = await repository.createRefreshCandidate({
      organizationId: candidate.organizationId,
      sourceContentItemId: candidate.contentItemId,
      title: `Atualizar: ${candidate.title}`,
      contentType: "blog.refresh",
      status: "draft",
      idempotencyKey: candidateKey,
      body: {
        refresh: true,
        idempotency_key: candidateKey,
        source_content_item_id: candidate.contentItemId,
        decay: eventPayload(candidate),
      },
    });
    if (refreshCandidate.organizationId !== candidate.organizationId) throw new UpdateValidationError("Refresh candidate was created for another organization");
  }

  const payload = eventPayload(candidate);
  const events: LearningEvent[] = [];
  const decayEventKey = `decay:${candidate.idempotencyKey}`;
  const candidateEventKey = `candidate:${candidateKey}`;
  for (const event of [
    { eventType: "content_decay_detected" as const, idempotencyKey: decayEventKey, contentItemId: candidate.contentItemId },
    { eventType: "content_refresh_candidate_created" as const, idempotencyKey: candidateEventKey, contentItemId: refreshCandidate.id },
  ]) {
    const prior = await repository.findLearningEvent(candidate.organizationId, event.idempotencyKey);
    if (prior) {
      if (prior.organizationId !== candidate.organizationId) throw new UpdateValidationError("Learning event tenant mismatch");
      events.push(prior);
      continue;
    }
    events.push(await repository.createLearningEvent({
      organizationId: candidate.organizationId,
      contentItemId: event.contentItemId,
      eventType: event.eventType,
      occurredAt,
      idempotencyKey: event.idempotencyKey,
      payload: { ...payload, refresh_candidate_id: refreshCandidate.id },
    }));
  }
  return { candidate: refreshCandidate, candidateReused, events };
}

export async function createRefreshCandidates(
  repository: UpdateRepository,
  candidates: readonly DecayCandidate[],
  options: { now?: string } = {},
): Promise<RefreshCandidateResult[]> {
  const results: RefreshCandidateResult[] = [];
  for (const candidate of candidates) results.push(await createRefreshCandidate(repository, candidate, options));
  return results;
}
