/**
 * Shared projection core: extract -> sanitize -> ledger -> upsert for a single
 * official message. Used by both the live event handler
 * (`workers/memory-projection.handler.ts`, one message per `message.received`
 * event) and the rebuild script (`scripts/rebuild-mem0.ts`, many messages in
 * a backfill loop) so the two paths can never drift apart on what counts as
 * safe/eligible to project.
 */
import type pg from "pg";

import { extractMemoryCandidates, type MemoryCandidate } from "@/lib/agent-engine/memory/extract";
import { Mem0ProviderError } from "@/lib/agent-engine/memory/mem0-client";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { sanitizeMemoryCandidate } from "@/lib/agent-engine/memory/sanitize";
import { beginProjection, markProjectionApplied, markProjectionRetry } from "@/lib/agent-engine/platform/projection-ledger";
import type { LlmEdgeConfig } from "@/lib/agent-engine/edge/llm/run-model-call";

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

/** Projects one message. Idempotent: re-running an already-applied source is a no-op. */
export async function projectMessage(input: ProjectMessageInput): Promise<ProjectMessageResult> {
  const now = (input.now ?? (() => new Date()))();
  const sourceVersion = input.message.created_at ?? input.message.id;

  let safeCandidates: MemoryCandidate[];
  try {
    const extract = input.extract ?? extractMemoryCandidates;
    const candidates = await extract({
      db: input.db,
      llmConfig: input.llmConfig,
      organizationId: input.organizationId,
      contactId: input.contactId,
      sourceMessageId: input.message.id,
      sourceText: input.message.body.trim(),
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
    await Promise.all(safeCandidates.map((candidate, index) =>
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
    ));
    await markProjectionApplied(input.db, input.organizationId, ledger.id);
    return { status: "ok" };
  } catch (error) {
    const code = error instanceof Mem0ProviderError ? `mem0_${error.kind}` : "memory_extraction_failed";
    await markProjectionRetry(input.db, input.organizationId, ledger.id, code, retryAt(now));
    return { status: "retry", retry_at: retryAt(now), detail: code };
  }
}
