/**
 * Shared projection core: extract -> sanitize -> ledger -> upsert for a single
 * official message. Used by both the live event handler
 * (`workers/memory-projection.handler.ts`, one message per `message.received`
 * event) and the rebuild script (`scripts/rebuild-mem0.ts`, many messages in
 * a backfill loop) so the two paths can never drift apart on what counts as
 * safe/eligible to project.
 */
import type pg from "pg";

import { extractMemoryCandidates, type ExistingMemoryRef, type MemoryCandidate } from "@/lib/agent-engine/memory/extract";
import { Mem0ProviderError } from "@/lib/agent-engine/memory/mem0-client";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { sanitizeMemoryCandidate } from "@/lib/agent-engine/memory/sanitize";
import type { SemanticMemoryRecord } from "@/lib/agent-engine/memory/types";
import { beginProjection, markProjectionApplied, markProjectionDeleted, markProjectionRetry } from "@/lib/agent-engine/platform/projection-ledger";
import type { LlmEdgeConfig } from "@/lib/agent-engine/edge/llm/run-model-call";

const EXISTING_MEMORY_TOP_K = 5;

export type ProjectableMessage = {
  id: string;
  body: string;
  created_at: string | null;
};

export type ProjectMessageInput = {
  db: pg.Pool;
  llmConfig: LlmEdgeConfig;
  memoryPort: MemoryPort;
  organizationId: string;
  contactId: string;
  message: ProjectableMessage;
  extract?: typeof extractMemoryCandidates;
  now?: () => Date;
};

export type ProjectMessageResult =
  | { status: "ok" }
  | { status: "skipped"; detail: string }
  | { status: "retry"; retry_at: string; detail: string };

function retryAt(now: Date): string {
  return new Date(now.getTime() + 60_000).toISOString();
}

function candidateRecord(candidate: MemoryCandidate, input: {
  sourceId: string;
  sourceVersion: string;
  organizationId: string;
  contactId: string;
  index: number;
}) {
  return {
    id: `memory:${input.sourceId}:${input.index}`,
    organizationId: input.organizationId,
    contactId: input.contactId,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion,
    type: candidate.type,
    authorityDomain: candidate.authorityDomain,
    risk: candidate.risk,
    actionable: candidate.actionable,
    confidence: candidate.confidence,
    validFrom: candidate.validFrom ?? null,
    validUntil: candidate.validUntil ?? null,
    text: candidate.text,
  };
}

/**
 * Best-effort lookup of what's already known about this contact, so
 * extraction can flag supersession instead of silently duplicating a
 * contradicted fact. A search failure degrades to "nothing known" — the
 * same result as today, before supersession detection existed — never a
 * reason to fail the whole projection.
 */
async function lookupExistingMemories(
  memoryPort: MemoryPort,
  input: { organizationId: string; contactId: string; query: string },
): Promise<{ refs: ExistingMemoryRef[]; byId: Map<string, SemanticMemoryRecord> }> {
  try {
    const found = await memoryPort.search({ ...input, topK: EXISTING_MEMORY_TOP_K });
    const records = Array.isArray(found) ? found : [];
    return {
      refs: records.map((r) => ({ id: r.id, text: r.text })),
      byId: new Map(records.map((r) => [r.id, r])),
    };
  } catch {
    return { refs: [], byId: new Map() };
  }
}

/**
 * Authoritative anonymization flag, straight from `contacts` — not the
 * projection ledger. `markProjectionDeletedByEntity` only ever flips ledger
 * rows that are already `'applied'`, so a ledger row still `'pending'` mid-
 * flight (the case here) never gets touched by a concurrent LGPD delete; the
 * ledger alone can't tell us a race happened. `contacts.is_anonymized` can.
 */
async function isContactAnonymized(db: pg.Pool, organizationId: string, contactId: string): Promise<boolean> {
  const result = await db.query(
    `select is_anonymized from contacts where id = $1 and organization_id = $2`,
    [contactId, organizationId],
  );
  return result.rows[0]?.is_anonymized === true;
}

/** Projects one message. Idempotent: re-running an already-applied source is a no-op. */
export async function projectMessage(input: ProjectMessageInput): Promise<ProjectMessageResult> {
  const now = (input.now ?? (() => new Date()))();
  const sourceVersion = input.message.created_at ?? input.message.id;
  const sourceText = input.message.body.trim();

  const existing = await lookupExistingMemories(input.memoryPort, {
    organizationId: input.organizationId,
    contactId: input.contactId,
    query: sourceText,
  });

  let safeCandidates: MemoryCandidate[];
  try {
    const extract = input.extract ?? extractMemoryCandidates;
    const candidates = await extract({
      db: input.db,
      llmConfig: input.llmConfig,
      organizationId: input.organizationId,
      contactId: input.contactId,
      sourceMessageId: input.message.id,
      sourceText,
      existingMemories: existing.refs,
    });
    safeCandidates = candidates.filter((candidate) =>
      sanitizeMemoryCandidate({ text: candidate.text, type: candidate.type }).allowed,
    );
  } catch {
    return { status: "retry", retry_at: retryAt(now), detail: "memory_extraction_failed" };
  }
  if (safeCandidates.length === 0) {
    return { status: "skipped", detail: "no_safe_candidates" };
  }

  const idempotencyBase = `memory_projection_v1:${input.message.id}:${sourceVersion}`;
  const ledger = await beginProjection(input.db, {
    organizationId: input.organizationId,
    projectionType: "memory",
    provider: "mem0",
    entityType: "contact",
    entityId: input.contactId,
    sourceId: input.message.id,
    sourceVersion,
    idempotencyKey: idempotencyBase,
  });
  if (ledger.status === "applied") {
    return { status: "skipped", detail: "already_applied" };
  }
  // A ledger row only reaches 'deleted' via an official LGPD cascade
  // (`markProjectionDeletedByEntity`, called from the memory-lifecycle
  // handler). That is a deliberate, irreversible removal — matching the same
  // "anonymização é irreversível" contract as the rest of the product — not
  // a state a rebuild or a replayed event is allowed to undo. In practice
  // the source message body is already wiped by the same cascade by the time
  // this runs, so this check is defense in depth, not the only guard.
  if (ledger.status === "deleted") {
    return { status: "skipped", detail: "resurrection_blocked_deleted_entity" };
  }

  try {
    const upserts = safeCandidates.map((candidate, index) =>
      input.memoryPort.upsert(
        candidateRecord(candidate, {
          sourceId: input.message.id,
          sourceVersion,
          organizationId: input.organizationId,
          contactId: input.contactId,
          index,
        }),
        `${idempotencyBase}:${index}`,
      ),
    );

    // Retire every existing memory a surviving candidate flagged as
    // superseded. `candidate.supersedes` only ever contains ids that were
    // actually in `existing.refs` (extractMemoryCandidates already dropped
    // anything else) — retiring means setting validUntil to now, not
    // deleting: the record stays as history, fuseContext's expiry filter
    // (this session) is what keeps it out of ranking/prompt from here on.
    const supersededIds = new Set(safeCandidates.flatMap((c) => c.supersedes ?? []));
    const retires = [...supersededIds].flatMap((id) => {
      const oldRecord = existing.byId.get(id);
      if (!oldRecord) return [];
      return [input.memoryPort.upsert({ ...oldRecord, validUntil: now.toISOString() }, `${idempotencyBase}:retire:${id}`)];
    });

    await Promise.all([...upserts, ...retires]);

    // TOCTOU close: the ledger.status check above ran once, before extract()
    // (an LLM call) and the upserts — an LGPD anonymization can complete
    // entirely inside that window. Re-check the authoritative flag right
    // before committing; if it flipped while we were writing, the upserts
    // above just resurrected memory for a contact whose deletion the rest of
    // the product treats as irreversible. Compensate instead of applying.
    if (await isContactAnonymized(input.db, input.organizationId, input.contactId)) {
      await input.memoryPort.deleteContact({ organizationId: input.organizationId, contactId: input.contactId });
      await markProjectionDeleted(input.db, input.organizationId, ledger.id);
      return { status: "skipped", detail: "resurrection_blocked_deleted_entity" };
    }

    await markProjectionApplied(input.db, input.organizationId, ledger.id);
    return { status: "ok" };
  } catch (error) {
    const code = error instanceof Mem0ProviderError ? `mem0_${error.kind}` : "memory_extraction_failed";
    await markProjectionRetry(input.db, input.organizationId, ledger.id, code, retryAt(now));
    return { status: "retry", retry_at: retryAt(now), detail: code };
  }
}
