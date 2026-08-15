# Graphiti: lifecycle (purge) and rebuild

## Delete — automatic, no manual step (tenant scope)

`workers/graph-lifecycle.handler.ts` subscribes to `lgpd.redact_applied` —
the exact same official event `workers/memory-lifecycle.handler.ts` (Mem0)
already listens to, emitted by `workers/lgpd-redact-worker.ts` for both
scopes:

- **`tenant`** (store-level uninstall, `organizations.status='redacted'`):
  the handler calls `GraphContextPort.deleteOrganization(organizationId)` —
  this deletes the tenant's **entire** Graphiti/Neo4j group (`DELETE
  /group/{group_id}`, the only deletion route Graphiti's real wire contract
  exposes) — and bulk-marks every `applied` `ai_projection_ledger` row for
  that org (`projection_type='graph'`, `provider='graphiti'`) as `deleted`,
  so a later rebuild can never silently re-materialize pre-purge data. No
  operator action is needed for LGPD compliance on this path.
- **`contact`** (single contact redaction): **known gap, not silently
  papered over.** `GraphContextPort` has no per-entity/episode delete route
  — Graphiti's packaged REST server (`zepai/graphiti:0.22.0`, confirmed by
  reading the packaged source in Task 4) only exposes group-level deletion.
  Deleting the whole tenant group for a single contact's redaction would be
  a disproportionate side effect on every other contact in the same org, so
  the handler does **not** call `deleteOrganization` for a contact-scope
  event. It only marks that contact's own `applied` graph ledger rows
  `deleted` (same `markProjectionDeletedByEntity` helper
  `memory-lifecycle.handler.ts` uses), which blocks any future rebuild from
  re-projecting that contact's already-redacted messages. **It does not
  remove that contact's existing episodes from Neo4j** — those remain mixed
  into the tenant's shared graph group until either (a) a future
  per-entity-deletion capability is added to `GraphContextPort` and its
  adapter, or (b) the whole tenant group is purged some other way (LGPD
  tenant-scope redact, or an operator-approved `rebuild-graphiti.ts --confirm-purge`
  run). Flag this to the product/compliance owner if per-contact graph
  erasure becomes a hard requirement — it is not achievable within
  Graphiti's current wire contract.

It is a no-op (`skipped: graphiti_not_configured`) on any instance that
never set `GRAPHITI_BASE_URL` — the common case today, since Graphiti stays
`off` by default. It is deliberately **not** gated on the per-org `graphiti`
feature mode: an org that had the feature on during a past SHADOW/CANARY
window can still have graph data today even after the feature flipped back
to `off`, and LGPD does not stop applying just because a flag flipped.

## Rebuild — manual, after a wipe, schema/embedding change, or explicit reset

Graphiti is a disposable, reconstructible projection (`docs/runbooks/graphiti.md`
"Limites e estado seguro"); Postgres (`messages`, `conversations`,
`contacts`) is the source of truth. Unlike `scripts/rebuild-mem0.ts`
(rebuild-only — a Mem0 wipe is a manual Docker-volume operation outside that
script), `scripts/rebuild-graphiti.ts` performs the **full purge + rebuild
sequence itself**, because tenant-scoped purge is a first-class capability
of this script (and of the automatic lifecycle handler above):

1. **read** — resolves the org's STORED `graphiti` rollout mode
   (`resolveStoredAiPlatformFeatureMode`) before touching anything.
   Deliberately **not** the kill-switch-aware resolver
   (`resolveAiPlatformFeature`), which masks its result to `"off"` whenever
   `AI_PLATFORM_KILL_GRAPHITI` is active — using that masked value here would
   make step 6's "never escalate rollout" guarantee silently no-op for an
   org stored at `on`/`canary` while the kill switch happens to be up,
   leaving it stored at `on`/`canary` after an unverified purge+rebuild.
2. **purge** — ONLY for a whole-org rebuild (no `--contact` given):
   `GraphContextPort.deleteOrganization(organizationId)` deletes the whole
   Neo4j group for the tenant. A `--contact`-scoped rebuild performs **no
   purge at all** — `GraphContextPort`/Graphiti's real API has no
   per-contact delete route (only `DELETE /group/{group_id}`), so purging
   the whole org for a single contact's rebuild would silently destroy
   every other contact's already-projected graph data while their ledger
   rows still say `applied`. A `--contact` rebuild instead relies on
   Graphiti's own `MERGE`-based upsert (keyed on the message's stable
   idempotency key) to refresh just that contact's episodes on replay.
3. **reset the ledger** — every `applied` graph/`graphiti` ledger row for
   this org (optionally scoped further to one contact) becomes
   replay-eligible again (`status='pending'`). Rows already `deleted` — an
   irreversible LGPD tombstone — are never touched or resurrected, no matter
   how many times the script runs.
4. **replay** — reuses `workers/graph-projection.handler.ts`'s
   `processGraphProjection` for every eligible message, one synthetic
   `message.received`-shaped event per message, so "rebuilt" can never mean
   something structurally different from "live-projected". Idempotent:
   Graphiti's own episode upsert is keyed on the caller-supplied `uuid`
   (`MERGE (n:Episodic {uuid: $uuid})`, confirmed in Task 4), so replaying
   the same source with the same idempotency key can never duplicate a graph
   node.
5. **compare counts** — the printed JSON line reports
   `applied`/`skipped`/`retried`/`ledgerReset` for the operator to
   sanity-check against the pre-purge state before deciding whether to
   promote the feature mode.
6. **never escalate rollout** — if the org's real stored mode was `on` or
   `canary`, the script forces it down to `shadow` (a purge+rebuild that has
   not been re-verified must not keep serving live/canary traffic
   automatically). If it was already `off`/`shadow`, it is left completely
   untouched. The script never writes `on` or `canary` itself — promotion is
   always a separate, explicit operator decision.

```bash
# One tenant (default scope) — purges the WHOLE org group, then rebuilds:
pnpm exec tsx scripts/rebuild-graphiti.ts --org <organization_id> --confirm-purge

# One contact within a tenant — NO purge; only that contact's ledger is
# reset and replayed, relying on Graphiti's uuid-keyed upsert to refresh its
# episodes without touching any other contact's data:
pnpm exec tsx scripts/rebuild-graphiti.ts --org <organization_id> --contact <contact_id> --confirm-purge
```

`--confirm-purge` is required on every invocation, including a
`--contact`-scoped one that performs no purge at all — unlike
`rebuild-mem0.ts` (which never deletes provider-side data itself), a
whole-org run of this script's own step 2 deletes the tenant's entire
Graphiti group before rebuilding it, and requiring the same flag for both
modes keeps the CLI contract simple rather than conditionally destructive.

There is no `--all-orgs` flag. `deleteOrganization` is destructive per
tenant, and this task's interface doctrine is "tenant-scoped purge/rebuild
by default" — a global purge+rebuild loop across every tenant is
deliberately not offered as a single command.

Output is a single JSON line with aggregate counts only (for example
`{"org":"...","applied":42,"skipped":9,"retried":0,"ledgerReset":42,"featureModeBefore":"canary","featureModeAfter":"shadow"}`)
— never message text or episode text, matching the same zero-PII-in-output
discipline as `rebuild-mem0.ts`.

`retried` means the Graphiti provider call failed for that message during
this run (timeout, 5xx). It is safe to re-run the same command — the ledger
only marks a source `applied` on success, so a retried source is picked up
again on the next run (subject to step 3's reset happening again on that
re-run, since a re-run also purges first).

## Proof this cascade actually holds (Task 8 Step 1)

Covered end-to-end in `tests/unit/rebuild-graphiti.test.ts`, wired against
the real `processGraphProjection`, `processGraphLifecycle`, and
`rebuildTenant` — only the Postgres ledger, the `messages` admin fetch, and
the Graphiti provider are faked as plain in-memory stand-ins:

1. Org A purge (`rebuildTenant` or the LGPD lifecycle handler) never touches
   org B's episodes or ledger rows — proven by seeding both orgs and purging
   only one. Within a single org, a `--contact`-scoped rebuild never touches
   the OTHER contact's episodes/ledger rows either — proven by seeding both
   contacts first, then running a `--contact`-scoped rebuild targeting only
   one and asserting the other contact's episode is still present in the
   graph store and its ledger row still says `applied`.
2. Replay is stable and duplicate replay produces no duplicate graph nodes —
   two full purge+rebuild passes over the same source converge on exactly
   one episode (Graphiti's uuid-keyed `MERGE` semantics, exercised through
   the same idempotency key both times).
3. A delayed/redelivered pre-purge `message.received` event cannot
   resurrect stale graph state, even through an explicit rebuild run
   afterward: once the LGPD tenant-scope lifecycle handler marks a source's
   ledger row `deleted`, `resetAppliedGraphLedger`'s `status='applied'`
   filter can never pick that row back up, so there is no valid *newer*
   source version that could legitimately re-open it — it stays blocked
   (`resurrection_blocked_deleted_entity`) forever.
4. A genuine, non-LGPD provider-side wipe (Neo4j data cleared directly, the
   ledger never touched by the lifecycle handler) is exactly the case
   `rebuild-graphiti.ts` is for — `rebuildTenant` resets the still-`applied`
   ledger rows and replay restores the projection from the still-intact
   official Postgres source.
5. `rebuildTenant` never escalates rollout: `on`/`canary` is downgraded to
   `shadow`; `off`/`shadow` is left with zero writes to
   `ai_platform_feature_flags`. This decision reads the org's STORED mode
   (`resolveStoredAiPlatformFeatureMode`), so an active
   `AI_PLATFORM_KILL_GRAPHITI` kill switch can never mask an `on`/`canary`
   org into looking like `off` and defeating the downgrade.

This sequence is what distinguishes "rebuild" (recovers projection state
that should exist) from "resurrect" (recreates data an LGPD deletion
deliberately removed) — the same distinction `docs/runbooks/mem0-rebuild.md`
documents for Mem0, adapted to Graphiti's group-level-only deletion
contract.
