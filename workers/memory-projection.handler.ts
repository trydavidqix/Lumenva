/**
 * Asynchronous semantic-memory projection.
 *
 * This consumer observes trusted CRM events only. It never participates in the
 * inbound reply path: all provider and extraction failures become retriable
 * event-log results, leaving the WhatsApp response consumer independent.
 */
import type pg from "pg";

import { createPool } from "@/lib/agent-engine/db/pool";
import { llmEdgeConfigFromEnv, type LlmEdgeConfig } from "@/lib/agent-engine/edge/llm/run-model-call";
import { extractMemoryCandidates, type MemoryCandidate } from "@/lib/agent-engine/memory/extract";
import { Mem0Client, Mem0ProviderError } from "@/lib/agent-engine/memory/mem0-client";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { sanitizeMemoryCandidate } from "@/lib/agent-engine/memory/sanitize";
import { beginProjection, markProjectionApplied, markProjectionRetry } from "@/lib/agent-engine/platform/projection-ledger";
import { resolveAiPlatformFeature, type ResolvedAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";

export const MEMORY_PROJECTION_CONSUMER_KEY = "memory_projection_v1";

type SourceMessage = {
  id: string;
  body: string | null;
  organization_id: string;
  conversation_id: string | null;
  created_at: string | null;
};

type SourceConversation = {
  id: string;
  organization_id: string;
  contact_id: string | null;
};

type Queryable = { query: (sql: string, values: unknown[]) => Promise<{ rows: Array<{ id: string; status: string }> }> };

type SourceQuery = {
  select: (columns: string) => SourceQuery;
  eq: (column: string, value: string) => SourceQuery;
  maybeSingle: () => Promise<{ data: unknown; error: unknown | null }>;
};

type SourceAdminClient = {
  from: (table: string) => { select: (columns: string) => SourceQuery };
};

export type MemoryProjectionDeps = {
  resolveFeature?: (input: { organizationId: string; feature: "mem0" }) => Promise<ResolvedAiPlatformFeature>;
  admin?: SourceAdminClient;
  db?: Queryable;
  llmConfig?: LlmEdgeConfig;
  extract?: typeof extractMemoryCandidates;
  memoryPort?: MemoryPort;
  now?: () => Date;
};

let pool: pg.Pool | undefined;

function projectionPool(): pg.Pool {
  pool ??= createPool(process.env.SUPABASE_DB_URL ?? "");
  return pool;
}

function retryAt(now: Date): string {
  return new Date(now.getTime() + 60_000).toISOString();
}

function errorCode(error: unknown): string {
  if (error instanceof Mem0ProviderError) return `mem0_${error.kind}`;
  return "memory_extraction_failed";
}

function defaultMemoryPort(): MemoryPort {
  return new Mem0Client({
    baseUrl: process.env.MEM0_BASE_URL ?? "",
    apiKey: process.env.MEM0_API_KEY ?? "",
    timeoutMs: Number(process.env.MEM0_TIMEOUT_MS ?? 2_000),
  });
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
    confidence: candidate.confidence,
    validFrom: candidate.validFrom ?? null,
    validUntil: candidate.validUntil ?? null,
    text: candidate.text,
  };
}

/** Processes one official message.received event. */
export async function processMemoryProjection(
  row: EventRow,
  deps: MemoryProjectionDeps = {},
): Promise<HandlerResult> {
  const consumer_key = MEMORY_PROJECTION_CONSUMER_KEY;
  const feature = await (deps.resolveFeature ?? resolveAiPlatformFeature)({
    organizationId: row.organization_id,
    feature: "mem0",
  });
  if (feature.mode === "off") {
    return { consumer_key, status: "skipped", detail: "feature_off" };
  }

  const messageId = (typeof row.payload.message_id === "string" ? row.payload.message_id : row.entity_id);
  if (!messageId) return { consumer_key, status: "skipped", detail: "missing_message_id" };

  const admin = deps.admin ?? createAdminClient() as unknown as SourceAdminClient;
  const { data: messageData, error: messageError } = await admin
    .from("messages")
    .select("id, body, organization_id, conversation_id, created_at")
    .eq("id", messageId)
    .eq("organization_id", row.organization_id)
    .maybeSingle();
  const message = messageData as SourceMessage | null;
  // The explicit equality is a defense in depth check for a compromised or
  // incorrectly mocked service client. Event tenant identity always wins.
  if (messageError || !message || message.organization_id !== row.organization_id) {
    return { consumer_key, status: "skipped", detail: "message_not_found" };
  }
  if (!message.conversation_id || !message.body?.trim()) {
    return { consumer_key, status: "skipped", detail: "message_not_projectable" };
  }

  const { data: conversationData, error: conversationError } = await admin
    .from("conversations")
    .select("id, organization_id, contact_id")
    .eq("id", message.conversation_id)
    .eq("organization_id", row.organization_id)
    .maybeSingle();
  const conversation = conversationData as SourceConversation | null;
  if (conversationError || !conversation || conversation.organization_id !== row.organization_id || !conversation.contact_id) {
    return { consumer_key, status: "skipped", detail: "contact_not_found" };
  }

  const db = deps.db ?? projectionPool();
  const sourceVersion = message.created_at ?? row.id;
  const ledger = await beginProjection(db, {
    organizationId: row.organization_id,
    projectionType: "memory",
    provider: "mem0",
    entityType: "contact",
    entityId: conversation.contact_id,
    sourceId: message.id,
    sourceVersion,
    idempotencyKey: `memory_projection_v1:${row.id}:${sourceVersion}`,
  });
  if (ledger.status === "applied") {
    return { consumer_key, status: "skipped", detail: "already_applied" };
  }

  try {
    const extract = deps.extract ?? extractMemoryCandidates;
    const candidates = await extract({
      db: db as pg.Pool,
      llmConfig: deps.llmConfig ?? llmEdgeConfigFromEnv({
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        LLM_CACHE_TTL: process.env.LLM_CACHE_TTL,
      }),
      organizationId: row.organization_id,
      contactId: conversation.contact_id,
      sourceMessageId: message.id,
      sourceText: message.body.trim(),
    });
    const safeCandidates = candidates.filter((candidate) =>
      sanitizeMemoryCandidate({ text: candidate.text, type: candidate.type }).allowed,
    );
    const memoryPort = deps.memoryPort ?? defaultMemoryPort();
    await Promise.all(safeCandidates.map((candidate, index) =>
      memoryPort.upsert(
        candidateRecord(candidate, {
          sourceId: message.id,
          sourceVersion,
          organizationId: row.organization_id,
          contactId: conversation.contact_id!,
          index,
        }),
        `memory_projection_v1:${row.id}:${index}`,
      ),
    ));
    await markProjectionApplied(db, row.organization_id, ledger.id);
    return { consumer_key, status: "ok" };
  } catch (error) {
    const code = errorCode(error);
    await markProjectionRetry(db, row.organization_id, ledger.id, code, retryAt((deps.now ?? (() => new Date()))()));
    return { consumer_key, status: "retry", retry_at: retryAt((deps.now ?? (() => new Date()))()), detail: code };
  }
}

export const memoryProjectionHandler = {
  key: MEMORY_PROJECTION_CONSUMER_KEY,
  events: ["message.received"],
  handle: processMemoryProjection,
};
