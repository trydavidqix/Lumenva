/**
 * Asynchronous semantic-memory projection.
 *
 * This consumer observes trusted CRM events only. It never participates in the
 * inbound reply path: all provider and extraction failures become retriable
 * event-log results, leaving the WhatsApp response consumer independent.
 *
 * Loads the source message/conversation (handler-specific — this is the only
 * place that knows how a `message.received` event maps to a projectable
 * message), then hands off to `lib/agent-engine/memory/project-message.ts`
 * for the actual extract -> sanitize -> ledger -> upsert core, shared with
 * `scripts/rebuild-mem0.ts` so the two paths can't drift on what counts as
 * safe/eligible to project — or, since that core also does supersession
 * detection/retirement, on what counts as "no longer current."
 */
import type pg from "pg";

import { createPool } from "@/lib/agent-engine/db/pool";
import { llmEdgeConfigFromEnv, type LlmEdgeConfig } from "@/lib/agent-engine/edge/llm/run-model-call";
import type { extractMemoryCandidates } from "@/lib/agent-engine/memory/extract";
import { Mem0Client } from "@/lib/agent-engine/memory/mem0-client";
import { NullMemoryPort, type MemoryPort } from "@/lib/agent-engine/memory/port";
import { projectMessage } from "@/lib/agent-engine/memory/project-message";
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

/**
 * `feature.mode !== "off"` for this org is the normal gate for reaching this
 * code at all — Mem0Client's constructor still validates config eagerly and
 * throws if it's missing regardless. That combination (feature on for an
 * org, sidecar never configured instance-wide) is an inconsistent deploy
 * state, not a reason to fail every message.received event outright — degrade
 * to the null port project-message.ts already tolerates (search returns
 * `[]`, upsert is a no-op) instead of throwing before extraction even runs.
 */
function defaultMemoryPort(): MemoryPort {
  try {
    return new Mem0Client({
      baseUrl: process.env.MEM0_BASE_URL ?? "",
      apiKey: process.env.MEM0_API_KEY ?? "",
      timeoutMs: Number(process.env.MEM0_TIMEOUT_MS ?? 2_000),
    });
  } catch {
    return new NullMemoryPort();
  }
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
  const result = await projectMessage({
    db: db as pg.Pool,
    llmConfig: deps.llmConfig ?? llmEdgeConfigFromEnv({
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      LLM_CACHE_TTL: process.env.LLM_CACHE_TTL,
    }),
    memoryPort: deps.memoryPort ?? defaultMemoryPort(),
    organizationId: row.organization_id,
    contactId: conversation.contact_id,
    message: { id: message.id, body: message.body.trim(), created_at: message.created_at },
    extract: deps.extract,
    now: deps.now,
  });
  return { consumer_key, ...result };
}

export const memoryProjectionHandler = {
  key: MEMORY_PROJECTION_CONSUMER_KEY,
  events: ["message.received"],
  handle: processMemoryProjection,
};
