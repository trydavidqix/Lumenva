import { describe, expect, it } from "vitest";

import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import type { SemanticMemoryRecord } from "@/lib/agent-engine/memory/types";
import { projectMessage } from "@/lib/agent-engine/memory/project-message";
import { processMemoryLifecycle } from "@/workers/memory-lifecycle.handler";
import { rebuildTenant } from "@/scripts/rebuild-mem0";
import type { EventRow } from "@/lib/event-log/dispatcher";

/**
 * Task 10 Step 4 — lifecycle/replay proof, wired against the real production
 * modules (project-message, memory-lifecycle handler, rebuild script), not
 * against a re-description of what they do. Only the Postgres ledger and the
 * Mem0 provider are faked — both as plain in-memory stand-ins that satisfy
 * the exact same interfaces those modules already depend on.
 *
 * Sequence proven, in order:
 *   1. create synthetic tenant/contact/message
 *   2. project -> memory present in the fake Mem0 namespace
 *   3. search -> confirms presence
 *   4. LGPD delete fires -> memory-lifecycle handler deletes the namespace
 *   5. search -> confirms absence
 *   6. rebuild (without resetting the ledger) -> still absent: an LGPD
 *      delete is not something a rebuild is allowed to undo
 *   7. a genuine Mem0-side wipe (ledger rows reset, not an LGPD delete) ->
 *      rebuild DOES restore -> search confirms presence again
 */

const orgA = "00000000-0000-4000-8000-000000000001";
const contactId = "00000000-0000-4000-8000-000000000020";
const message = { id: "00000000-0000-4000-8000-000000000010", body: "Prefere contato só depois das 18h.", created_at: "2026-08-10T12:00:00.000Z" };

type LedgerRow = { id: string; organization_id: string; provider: string; entity_type: string; entity_id: string; idempotency_key: string; status: string };

type SourceMessageRow = { message_id: string; body: string; created_at: string | null; contact_id: string; organization_id: string };

/**
 * Minimal in-memory stand-in for the ai_projection_ledger statements
 * project-message.ts / projection-ledger.ts issue, plus the eligible-messages
 * page query rebuild-mem0.ts issues — same fake object, since both go
 * through the same `db.query` call in the real code.
 */
function fakeLedgerDb(messages: SourceMessageRow[] = []) {
  const rows = new Map<string, LedgerRow>();
  let seq = 0;
  const query = async (sql: string, values: unknown[]) => {
    if (sql.includes("from messages")) {
      const [organizationId, contactId, limit, offset] = values as [string, string | null, number, number];
      const eligible = messages.filter((m) => m.organization_id === organizationId && (contactId === null || m.contact_id === contactId));
      return { rows: eligible.slice(offset, offset + limit) };
    }
    if (sql.startsWith("insert into ai_projection_ledger")) {
      const [organizationId, , provider, entityType, entityId, , , idempotencyKey] = values as string[];
      const key = `${organizationId}:${provider}:${idempotencyKey}`;
      const existing = rows.get(key);
      if (existing) return { rows: [{ id: existing.id, status: existing.status }] };
      const id = `ledger-${++seq}`;
      rows.set(key, { id, organization_id: organizationId!, provider: provider!, entity_type: entityType!, entity_id: entityId!, idempotency_key: idempotencyKey!, status: "pending" });
      return { rows: [{ id, status: "pending" }] };
    }
    if (sql.includes("status = 'applied'")) {
      const [id, organizationId] = values as string[];
      const row = [...rows.values()].find((r) => r.id === id && r.organization_id === organizationId);
      if (row) row.status = "applied";
      return { rows: row ? [{ id: row.id, status: row.status }] : [] };
    }
    if (sql.includes("status='deleted'") && sql.includes("entity_type=$3")) {
      const [organizationId, provider, entityType, entityId] = values as string[];
      const matched = [...rows.values()].filter(
        (r) => r.organization_id === organizationId && r.provider === provider && r.entity_type === entityType && r.entity_id === entityId && r.status === "applied",
      );
      matched.forEach((r) => (r.status = "deleted"));
      return { rows: matched.map((r) => ({ id: r.id, status: r.status })) };
    }
    // TOCTOU close (project-message.ts `isContactAnonymized`) re-reads the
    // authoritative flag straight from `contacts` right before committing.
    // This fake has no contacts table — the scenario this test proves never
    // actually anonymizes the contact (step 7 is a Mem0-side ledger wipe,
    // not an LGPD delete), so the flag is always false here.
    if (sql.includes("select is_anonymized from contacts")) {
      return { rows: [{ is_anonymized: false }] };
    }
    throw new Error(`fakeLedgerDb: unhandled query: ${sql}`);
  };
  return {
    query,
    // Test-only escape hatch to simulate a genuine Mem0-side wipe: reset this
    // tenant/contact's ledger rows so the next rebuild treats them as new —
    // exactly the manual step docs/runbooks/mem0-rebuild.md documents.
    resetForWipe(organizationId: string, entityId: string) {
      for (const row of rows.values()) {
        if (row.organization_id === organizationId && row.entity_id === entityId) rows.delete(`${row.organization_id}:${row.provider}:${row.idempotency_key}`);
      }
    },
  };
}

/** Minimal in-memory stand-in for the Mem0 REST API, namespaced exactly like the real client. */
function fakeMemoryPort(): MemoryPort & { namespace(organizationId: string, contactId: string): SemanticMemoryRecord[] } {
  const store = new Map<string, SemanticMemoryRecord>();
  return {
    async upsert(record) {
      store.set(record.id, record);
    },
    async search(input) {
      return [...store.values()].filter((r) => r.organizationId === input.organizationId && r.contactId === input.contactId);
    },
    async deleteContact(input) {
      for (const [id, record] of store) {
        if (record.organizationId === input.organizationId && record.contactId === input.contactId) store.delete(id);
      }
    },
    async health() {
      return { ok: true, latencyMs: 0 };
    },
    namespace(organizationId, contactId) {
      return [...store.values()].filter((r) => r.organizationId === organizationId && r.contactId === contactId);
    },
  };
}

const fakeExtract = async () => [
  { type: "preference" as const, authorityDomain: "customer_preference" as const, risk: "low" as const, confidence: 0.9, actionable: true, sensitiveClassification: "none" as const, validFrom: null, validUntil: null, text: "Prefere contato só depois das 18h." },
];

describe("Mem0 lifecycle/replay proof (Task 10 Step 4)", () => {
  it("project -> present -> LGPD delete -> absent -> rebuild does not resurrect -> genuine wipe -> rebuild restores", async () => {
    const db = fakeLedgerDb([
      { message_id: message.id, body: message.body, created_at: message.created_at, contact_id: contactId, organization_id: orgA },
    ]);
    const memoryPort = fakeMemoryPort();

    // 1+2. project the synthetic message.
    const projected = await projectMessage({
      db: db as never,
      llmConfig: {} as never,
      memoryPort,
      organizationId: orgA,
      contactId,
      message,
      extract: fakeExtract,
    });
    expect(projected).toEqual({ status: "ok" });

    // 3. present.
    expect(memoryPort.namespace(orgA, contactId)).toHaveLength(1);
    expect(memoryPort.namespace(orgA, contactId)[0]?.text).toContain("depois das 18h");

    // 4. the official LGPD deletion boundary fires.
    const redactEvent: EventRow = {
      id: "event-1",
      organization_id: orgA,
      event_type: "lgpd.redact_applied",
      entity_kind: "lgpd_request",
      entity_id: "request-1",
      payload: { request_id: "request-1", contact_id: contactId },
      metadata: {},
      consumed_by: [],
      attempts: 0,
    };
    const lifecycle = await processMemoryLifecycle(redactEvent, { mem0Configured: true, db: db as never, memoryPort });
    expect(lifecycle).toMatchObject({ status: "ok", detail: "contact_deleted" });

    // 5. absent.
    expect(memoryPort.namespace(orgA, contactId)).toHaveLength(0);

    // 6. rebuild WITHOUT resetting the ledger — must not resurrect the deleted memory.
    const rebuildAfterDelete = await rebuildTenant(
      { db: db as never, memoryPort, llmConfig: {} as never, extract: fakeExtract },
      { organizationId: orgA, contactId },
    );
    expect(rebuildAfterDelete).toEqual({ applied: 0, skipped: 1, retried: 0 });
    expect(memoryPort.namespace(orgA, contactId)).toHaveLength(0);

    // 7. a genuine Mem0-side wipe (not an LGPD delete) resets the ledger —
    // now rebuild is expected to restore the projection from the still-intact
    // official Postgres source.
    db.resetForWipe(orgA, contactId);
    const rebuildAfterWipe = await rebuildTenant(
      { db: db as never, memoryPort, llmConfig: {} as never, extract: fakeExtract },
      { organizationId: orgA, contactId },
    );
    expect(rebuildAfterWipe).toEqual({ applied: 1, skipped: 0, retried: 0 });
    expect(memoryPort.namespace(orgA, contactId)).toHaveLength(1);
  });
});
