# Mem0: lifecycle (delete) and rebuild

## Delete — automatic, no manual step

`workers/memory-lifecycle.handler.ts` subscribes to `lgpd.redact_applied`
(already emitted by `workers/lgpd-redact-worker.ts` for every contact and
tenant anonymization). It deletes the Mem0 namespace for the affected
contact(s) and marks the matching `ai_projection_ledger` rows `deleted`.
No operator action is needed for LGPD compliance — this runs automatically
whenever the existing redact flow runs, exactly like it always has.

It is a no-op (`skipped: mem0_not_configured`) on any instance that never set
`MEM0_BASE_URL` — the common case today, since Mem0 stays `OFF` by default.

## Rebuild — manual, after a wipe or schema/embedding change

Mem0 is a disposable projection; Postgres (`messages`, `conversations`,
`contacts`) is the source of truth. `scripts/rebuild-mem0.ts` reprojects a
tenant's eligible messages through the exact same
extract → sanitize → ledger → upsert path the live consumer uses
(`lib/agent-engine/memory/project-message.ts`), so a rebuild can never
produce memory shaped differently from what live projection would have
produced.

It is idempotent: an already-applied source (message id + version already in
`ai_projection_ledger`) is skipped, not re-upserted. Running it twice, or
running it as a periodic safety net, has no duplication risk. To force a full
rebuild after a Mem0 wipe, wipe the sidecar first (see
`docs/runbooks/mem0.md` → "Wipe e reconstrução completos"), then run this
script — with the sidecar empty, every eligible message is "new" again from
the ledger's perspective... except the ledger itself is Postgres-side and
survives a Mem0-side wipe. A true from-scratch rebuild after wiping Mem0 also
needs the ledger rows for that tenant reset to `pending`/deleted first
(`update ai_projection_ledger set status='deleted' where organization_id=$1
and provider='mem0'`) — otherwise the script sees everything as
`already_applied` and (correctly, by the ledger's contract) projects nothing.

```bash
# One tenant (the default and recommended path):
pnpm exec tsx scripts/rebuild-mem0.ts --org <organization_id>

# One contact within a tenant:
pnpm exec tsx scripts/rebuild-mem0.ts --org <organization_id> --contact <contact_id>

# Every tenant on the instance — refuses without --confirm-global,
# so a global rebuild is never the accidental default:
pnpm exec tsx scripts/rebuild-mem0.ts --all-orgs --confirm-global
```

Output is a single JSON line with aggregate counts only
(`{"orgs":1,"applied":42,"skipped":9,"retried":0}`) — never message text or
extracted candidate text, matching the same zero-PII-in-output discipline as
the rest of the AI platform tooling.

`retried` means a Mem0 provider call failed for that message during this
run (timeout, 5xx). It is safe to re-run the same command — the ledger only
marks a source `applied` on success, so a retried source is picked up again
on the next run.

## Proof this cascade actually holds (Task 10 lifecycle/replay proof)

1. Create a synthetic tenant/contact with a projectable message.
2. Project it (via the live handler or `rebuild-mem0.ts`) — `applied: 1`.
3. Search Mem0 for that contact's namespace — memory present.
4. Run the LGPD contact redact flow — `lgpd.redact_applied` fires,
   `memory-lifecycle.handler.ts` deletes the namespace.
5. Search Mem0 again — namespace empty.
6. Run `rebuild-mem0.ts --org <id> --contact <id>` — the ledger row for
   that source is still `applied` (rebuild does not resurrect what an
   official deletion removed on purpose; deletion is irreversible by design,
   matching the LGPD anonymization contract elsewhere in the product).
7. To rebuild AFTER an intentional Mem0-side wipe (not an LGPD delete —
   see the "reset the ledger first" note above), the source becomes eligible
   again once its ledger row is reset, and step 2's expected result recurs.

This sequence is what distinguishes "rebuild" (recovers projection state
that should exist) from "resurrect" (recreates data an LGPD delete
deliberately removed). Two independent guards enforce it: the LGPD cascade
already wipes the source `messages.body` for a redacted contact, so rebuild's
own source query excludes those messages before projection is even
attempted; and `project-message.ts` (the shared core both the live handler
and this script call) refuses to re-project any source whose ledger row an
official delete marked `deleted` (`resurrection_blocked_deleted_entity`),
even if a future change to the cascade ever stopped wiping the source body.
