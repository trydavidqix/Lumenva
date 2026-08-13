/**
 * memory-lifecycle.handler — deletes the Mem0 semantic-memory namespace when
 * the official LGPD cascade anonymizes a contact.
 *
 * Subscribes to `lgpd.redact_applied`, already emitted by
 * `workers/lgpd-redact-worker.ts` for both scopes ('contact': single
 * `contact_id` in payload; 'tenant': store-level uninstall, no per-contact
 * id, only aggregate counts). This handler adds no new event — it reacts to
 * the existing official deletion boundary, so a delayed/redelivered LGPD
 * event is the only trigger, never a free-form message or a guess.
 *
 * Mem0 is a disposable projection, never the source of truth (see
 * docs/runbooks/mem0.md): deleting it here is best-effort cleanup on top of
 * an LGPD guarantee that is already complete — the Postgres cascade ran and
 * was audited before this event ever fires. A failure here retries; it never
 * blocks or reverses the cascade.
 *
 * Deliberately NOT gated on the per-org `mem0` feature mode: an org that had
 * the feature on during a past SHADOW/CANARY window can still have Mem0 data
 * today even after the feature was turned back off, and LGPD does not stop
 * applying just because a flag flipped. It IS gated on the sidecar being
 * configured at all (`MEM0_BASE_URL` set) — most orgs never had Mem0
 * provisioned, and without that guard every contact redaction on a
 * self-hosted instance that has never touched Mem0 would open a provider
 * call that can only fail and retry forever.
 */
import type pg from "pg";

import { createPool } from "@/lib/agent-engine/db/pool";
import { Mem0Client } from "@/lib/agent-engine/memory/mem0-client";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { markProjectionDeletedByEntity } from "@/lib/agent-engine/platform/projection-ledger";
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";

export const MEMORY_LIFECYCLE_CONSUMER_KEY = "memory_lifecycle_v1";

const TENANT_BATCH_SIZE = 100;
const TENANT_BATCH_HARD_CAP = 100; // pages, not contacts — 10k contacts before this handler refuses to keep looping in one invocation.

type Queryable = { query: (sql: string, values: unknown[]) => Promise<{ rows: Array<{ id: string; status: string }> }> };

type ContactsPageQuery = {
  select: (columns: string) => ContactsPageQuery;
  eq: (column: string, value: string | boolean) => ContactsPageQuery;
  order: (column: string, opts: { ascending: boolean }) => ContactsPageQuery;
  range: (from: number, to: number) => Promise<{ data: Array<{ id: string }> | null; error: unknown | null }>;
};

type SourceAdminClient = {
  from: (table: string) => { select: (columns: string) => ContactsPageQuery };
};

export type MemoryLifecycleDeps = {
  admin?: SourceAdminClient;
  db?: Queryable;
  memoryPort?: MemoryPort;
  mem0Configured?: boolean;
};

let pool: pg.Pool | undefined;

function lifecyclePool(): pg.Pool {
  pool ??= createPool(process.env.SUPABASE_DB_URL ?? "");
  return pool;
}

function defaultMemoryPort(): MemoryPort {
  return new Mem0Client({
    baseUrl: process.env.MEM0_BASE_URL ?? "",
    apiKey: process.env.MEM0_API_KEY ?? "",
    timeoutMs: Number(process.env.MEM0_TIMEOUT_MS ?? 2_000),
  });
}

async function deleteOneContact(
  db: Queryable,
  memoryPort: MemoryPort,
  organizationId: string,
  contactId: string,
): Promise<void> {
  await memoryPort.deleteContact({ organizationId, contactId });
  await markProjectionDeletedByEntity(db, organizationId, {
    provider: "mem0",
    entityType: "contact",
    entityId: contactId,
  });
}

export async function processMemoryLifecycle(
  row: EventRow,
  deps: MemoryLifecycleDeps = {},
): Promise<HandlerResult> {
  const consumer_key = MEMORY_LIFECYCLE_CONSUMER_KEY;
  const mem0Configured = deps.mem0Configured ?? Boolean(process.env.MEM0_BASE_URL);
  if (!mem0Configured) {
    return { consumer_key, status: "skipped", detail: "mem0_not_configured" };
  }

  const db = deps.db ?? lifecyclePool();
  const memoryPort = deps.memoryPort ?? defaultMemoryPort();
  const organizationId = row.organization_id;

  const contactId = typeof row.payload.contact_id === "string" ? row.payload.contact_id : null;
  const scope = typeof row.payload.scope === "string" ? row.payload.scope : "contact";

  try {
    if (contactId) {
      await deleteOneContact(db, memoryPort, organizationId, contactId);
      return { consumer_key, status: "ok", detail: "contact_deleted" };
    }

    if (scope !== "tenant") {
      return { consumer_key, status: "skipped", detail: "no_contact_id" };
    }

    const admin = deps.admin ?? createAdminClient() as unknown as SourceAdminClient;
    let offset = 0;
    let deleted = 0;
    for (let page = 0; page < TENANT_BATCH_HARD_CAP; page++) {
      const { data, error } = await admin
        .from("contacts")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("is_anonymized", true)
        .order("id", { ascending: true })
        .range(offset, offset + TENANT_BATCH_SIZE - 1);
      if (error) throw new Error(`tenant_batch_select_failed: ${String(error)}`);

      const rows = data ?? [];
      if (rows.length === 0) break;

      for (const contact of rows) {
        await deleteOneContact(db, memoryPort, organizationId, contact.id);
        deleted++;
      }

      offset += rows.length;
      if (rows.length < TENANT_BATCH_SIZE) break;
    }

    return { consumer_key, status: "ok", detail: `tenant_deleted:${deleted}` };
  } catch {
    // Best-effort cleanup on top of an already-complete LGPD guarantee — retry,
    // never resurface as a failure that could look like the cascade itself failed.
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    return { consumer_key, status: "retry", retry_at: retryAt, detail: "mem0_delete_failed" };
  }
}

export const memoryLifecycleHandler = {
  key: MEMORY_LIFECYCLE_CONSUMER_KEY,
  events: ["lgpd.redact_applied"],
  handle: processMemoryLifecycle,
};
