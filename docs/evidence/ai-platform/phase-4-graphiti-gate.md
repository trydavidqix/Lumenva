# Phase 4 (Graphiti temporal graph projection) — release gate

Date: 2026-08-15
Branch: `ai-platform-foundation`
Commit range: `cd4158ff..c522a33a` (Task 1 through Task 9, this plan's own
commits)
Gate commit: recorded below, after this document is committed.

## Decision

**GO — end Phase 4 at `SHADOW`.** No P0/P1 findings open. All four
Global Constraints from the plan hold on the current tree: no graph result
can authorize a HIGH-risk action (enforced structurally, not by convention —
`mapGraphFact` hardcodes `actionable: false` for every domain in this
phase); `group_id` is trusted-adapter-derived, never caller-supplied; no
public Graphiti/Neo4j port exists in either compose file; no
secret/credential is ever ingested as episode content (`sanitizeGraphEpisode`
rejects, never redacts, and is wired directly into
`GraphitiClient.addEpisode()`). The full gate command list (Step 6 below)
is green: `typecheck`, `lint`, `lint:channels`, `test:unit`, `test:db`,
`ai:eval:local`, `build`, both `docker compose ... config --services`
invocations, and `git diff --check` all passed with real command output
captured below.

One architecture correction and one disclosed upstream API limitation are
carried into this decision explicitly rather than smoothed over — see
"Architecture deviation: FalkorDB → Neo4j" and "Known limitation:
per-contact LGPD redaction cannot remove already-projected Graphiti facts"
below. Both are pre-existing conditions, not new findings from this gate.
Neither blocks `SHADOW` as this phase's shipped/default state (no
`ai_platform_feature_flags` row exists for any tenant, so `graphiti`
resolves to `off` platform-wide) — but see the corrected LGPD reasoning
below: the per-contact redaction gap is **not** resolved merely by
`SHADOW`'s prompt-safety property, and must be explicitly weighed by a
compliance owner before `SHADOW` is turned on for any real tenant, not only
before a future `canary`/`on` promotion. A separate, disclosed gap — the
read/context-provider path is not wired into the running worker in
production — means no `SHADOW` metrics are actually being collected today
even where the write path is theoretically live; see "Known limitation: the
Graphiti read path is not wired into production" below.

## Architecture deviation: FalkorDB → Neo4j (disclosed, human-approved)

The original Phase 4 plan text wired the sidecar to FalkorDB
(`falkordb/falkordb-server`). Task 4's live inspection of the pinned
`zepai/graphiti:0.22.0` image found that its packaged REST server
(`graph_service/config.py`) only accepts `neo4j_uri`/`neo4j_user`/
`neo4j_password` — there is no FalkorDB field at all, and the `FALKORDB_*`
env vars Task 3 had originally configured were silently ignored
(`extra='ignore'` in the image's Pydantic settings), causing a crash-loop.
Independently confirmed via the public upstream issue
[getzep/graphiti#749](https://github.com/getzep/graphiti/issues/749) during
this session's research: this is a known, acknowledged limitation of the
packaged Graphiti REST server, not a misconfiguration on this repo's side.

The human project owner explicitly approved swapping the sidecar to Neo4j
Community Edition (free, no new paid-service obligation — self-host
invariant 9) — commit `c53da4aa`, "ops(graph): swap FalkorDB sidecar for
Neo4j (Graphiti's actual dependency)". `docker-compose.yml`,
`docker-compose.prod.yml`, `.env.example`, `lib/env.ts`, and
`docs/runbooks/graphiti.md` were updated together. `graphiti-client.ts`
needed zero changes — the REST wire contract
(`POST /messages`, `POST /search`, `DELETE /group/{id}`,
`GET /healthcheck`) is database-agnostic by construction.

**Current state, verified fresh on this gate's HEAD (`c522a33a`):** both
`docker-compose.yml` and `docker-compose.prod.yml` pin `neo4j:5.26.0` and
`zepai/graphiti:0.22.0`; neither file references `falkordb`/
`falkordb/falkordb-server` as an active service anywhere (`grep -n
falkordb docker-compose*.yml` returns no matches). See Step 1 below for the
full compose-validation evidence.

**Residual, deferred, harmless:** stale "FalkorDB" wording remains in a
handful of doc comments that predate the swap and were never load-bearing
(the concept — "the graph DB behind Graphiti" — is unchanged regardless of
which engine runs behind it):
`lib/agent-engine/graph/port.ts:13,20`, `types.ts:10,13`, `namespace.ts:7`,
`graphiti-client.ts:122`. Flagged by Task 4's own report as a doc-only
cleanup, not fixed in this gate task per its own scope (`docs/runbooks/`,
comments already correctly describe Neo4j as of the swap commit; only these
specific in-code doc comments still say "FalkorDB").

## Step 1 — compose validation and pinned image compatibility

Per the brief, `--services` only (never the bare `config` form, which
printed real `.env.local` secrets into a subagent's tool output earlier in
this plan — see Task 3's ledger entry). Interpolation requires the
required-no-default vars to be set; ran with clearly-labeled placeholder
values (never real secrets) for `GRAPHITI_NEO4J_PASSWORD`,
`GRAPHITI_API_KEY`, `GRAPHITI_LLM_API_KEY`, `MEM0_JWT_SECRET`,
`MEM0_OPENAI_API_KEY`, `MEM0_POSTGRES_PASSWORD` — the same placeholder
technique the Phase 2 gate used ("resolves cleanly once real/placeholder
secrets exist").

```
docker compose config --services
  waha
  worker
docker compose -f docker-compose.prod.yml config --services
  redis
  srh
  waha
  app
  caddy
  scheduler
  worker
```

The `ai-graph` profile (neo4j/graphiti/mem0) is opt-in and not listed by
default — re-ran with `--profile "*"` to confirm the gated services
themselves still resolve cleanly:

```
docker compose --profile "*" config --services
  mem0-postgres
  neo4j
  waha
  worker
  graphiti
  mem0
docker compose -f docker-compose.prod.yml --profile "*" config --services
  mem0-postgres
  redis
  srh
  waha
  app
  scheduler
  caddy
  neo4j
  graphiti
  mem0
  worker
```

Both exit 0, no errors — only benign warnings for optional envs left unset
(`WAHA_HMAC_SECRET`, `DOMAIN`, `ACME_EMAIL`, etc., same class of warning
the Phase 2 gate recorded for `docker compose config`).

**Pinned image tags confirmed** (`grep -n "image:" docker-compose*.yml`):
`neo4j:5.26.0` and `zepai/graphiti:0.22.0` in both files — matches Task 3/4's
swap exactly. **No `falkordb` reference remains as an active service**
(`grep -n falkordb docker-compose*.yml` returns zero matches in either
file — the only surviving "FalkorDB" text anywhere is the historical
doc-comment residue named above and explanatory prose in
`docs/runbooks/graphiti.md`'s "Histórico" section, which is deliberate
documentation of the correction, not a stale config reference).

**No public port in production**, read directly from
`docker-compose.prod.yml`:
- `neo4j` (lines ~223–256) and `graphiti` (lines ~257–291) declare no
  `ports:` at all.
- Both are on `networks: [ai-graph-internal]` only (`graphiti` also joins
  `internal`), and `ai-graph-internal: internal: true` is declared under
  `networks:` — Docker refuses to route this network off-host regardless of
  any `ports:` a future edit might add. `app`/`worker` are the only other
  members that can reach `graphiti`; `graphiti` is the only member besides
  `neo4j` itself that can reach `neo4j`.
- Dev compose (`docker-compose.yml`) binds the Graphiti REST port to
  `127.0.0.1:${GRAPHITI_DEV_PORT:-8890}` (loopback-only, for local adapter
  debugging) and `neo4j` publishes no port at all even in dev — documented
  in `docs/runbooks/graphiti.md` as live-tested: Docker cannot publish a
  host port for a container whose only network is `internal: true`, "even
  with `ports:` declared."

This satisfies the Step 1 property in full without needing to bring the
stack up live.

## Steps 2–5 — indices/build, project/search/purge/rebuild, cross-tenant isolation, outage resilience

Per the brief, these properties are already functionally proven by Tasks
4/6/7/8's real test suites (in-memory fakes exercising the real production
functions, not mocked-arg assertions) — cited here by file:test rather than
re-derived from a live stack, since host RAM was constrained throughout
this session (see "Live-stack decision" below for why a light live check
was judged not worth the risk this time).

**Adapter wire-contract correctness** (Task 4, `graphiti-client.test.ts`,
26 tests, re-run fresh this gate — see Step 6): `"sends the trusted group id
derived from organizationId, never a caller-supplied one"`, `"uses the
idempotency key as the message uuid so retries upsert instead of
duplicating"`, `"throws invalid_response for a malformed facts array
instead of returning it, or any subset of it, as data"` (and two sibling
cases for a wrong top-level shape and an unparseable timestamp) — together
these prove the client only ever trusts a well-formed, schema-valid
response, never partial/malformed data as if it were real facts.

**Build/idempotent-write proof** (Step 2/3 — "build indices" has no
separate index-creation step in this image; Graphiti's own `/messages`
route creates/merges nodes on ingest): `graph-projection.handler.test.ts`
(17 tests) — `"uses source identity and version as the stable ledger and
provider idempotency key"`, `"does not write again when the projection
ledger is already applied"`, and `graphiti-client.test.ts`'s `"uses the
idempotency key as the message uuid so retries upsert instead of
duplicating"` — Graphiti's own `MERGE (n:Episodic {uuid: $uuid})` semantics
(confirmed reading the packaged source, Task 4) mean a replayed idempotency
key can never create a duplicate node.

**Project/search/purge/rebuild, one synthetic tenant** (Step 3):
`tests/unit/rebuild-graphiti.test.ts` (`rebuildTenant`, 8 tests, wired
against the real `processGraphProjection`, `processGraphLifecycle`, and
`rebuildTenant`, only Postgres/the Graphiti provider faked as in-memory
stand-ins):
- `"purges, resets nothing on a first run, and replays every eligible
  message as applied"`
- `"replay is stable and duplicate replay produces no duplicate graph
  nodes — two full rebuild passes converge on one episode"`
- `"rebuild DOES restore projection after a genuine provider-side wipe that
  never went through the LGPD lifecycle handler"`
- `"scopes the rebuild to a single contact when one is given, without
  touching the rest of the org's ledger"`

**Cross-tenant isolation with two group IDs** (Step 4): proven at three
independent layers, not one:
- Namespace derivation (`lib/agent-engine/graph/namespace.test.ts`,
  `"Tenant isolation"` block): `"ensures organizations A and B with
  different UUIDs never share a namespace"`, plus `"produces different
  namespaces for different organizations (no collisions)"` and
  `"embeds only the UUID, not human-readable identifiers"`.
- Read path (`graphiti-client.test.ts`): `"sends group_ids as a
  single-element array derived from organizationId only"`, `"cannot be made
  to search a second or raw group id through any input the method
  accepts"`.
- Write path (`workers/graph-projection.handler.test.ts`): `"re-reads the
  message from the trusted source, filtered by the event's organization id,
  ignoring event payload content"`, `"never accepts a source message
  returned from another organization"`.
- Purge path (`tests/unit/rebuild-graphiti.test.ts`): `"org A purge never
  touches org B — deleteOrganization and the ledger reset are scoped
  strictly to the target org"`.
- Resurrection-blocking, the property that closes the loop between
  isolation and LGPD (`tests/unit/rebuild-graphiti.test.ts`): `"a delayed
  pre-purge message.received event cannot resurrect stale graph state, even
  via an explicit rebuild — no valid newer source version exists"`.

**Outage simulation, agent core unaffected** (Step 5):
`lib/agent-engine/context/graphiti-context-provider.test.ts` (10 tests):
`"returns an empty degraded result when the provider times out, without
leaking GraphitiProviderError"`, `"degrades to disabled bucket (not shadow)
when a timeout happens outside shadow mode"`, `"does not let a successful
shadow telemetry failure reject the retrieved result"`. Separately,
`workers/graph-projection.handler.test.ts`: `"retries when Graphiti is
unreachable, without leaking the raw provider error into the ledger"`,
`"degrades to a no-op null port instead of throwing when the sidecar is
unconfigured while the feature is on"`. At the turn level,
`lib/agent-engine/agent/retrieve-optional-context-blocks.test.ts` (Task 7
fix round) uses a deadlock-gate pattern to prove Mem0 and Graphiti retrieval
run via `Promise.all`, never one serialized after the other — sabotage-
verified by the implementer (temporarily serialized, confirmed the test
times out, then reverted) — so a slow/down Graphiti sidecar cannot silently
compound its latency onto Mem0's or block the turn.

### Live-stack decision

The brief made a light live check (start neo4j+graphiti only, confirm
healthy, tear down immediately) explicitly optional, not required, citing
constrained host RAM. This session's own memory reading during Step 6
(`wmic OS get FreePhysicalMemory`) showed free physical memory swinging
between roughly 400 MB and 1.9 GB over the course of the gate run, on an
8 GB host already running a `next dev` server and other project worktree
processes — the same class of contention the Phase 3 gate's `test:unit`
crash was traced to. Task 3/4 already performed a live health/connectivity
check of this exact `neo4j`+`graphiti` pairing earlier in this plan
(`.superpowers/sdd/2026-08-10-ai-platform-phase-4-graphiti/task-3-neo4j-swap-report.md`
— both containers reached `healthy`, no crash-loop, real Cypher queries
executed against Neo4j). That check did NOT include a completed
write→search round trip: `POST /search` returned `500` because the
intentionally-dummy `GRAPHITI_LLM_API_KEY` failed OpenAI auth, and the
source report states plainly the round trip "was not proven." Repeating
even the narrower health/connectivity check here would not add new signal
proportional to the RAM risk on this run, so it was not repeated.
This is a judgment call disclosed per the brief's own instruction, not a
skipped requirement.

## Step 6 — full gate command list

Run 2026-08-15, this branch at HEAD `c522a33a`, this Windows machine (8 GB
host, other dev processes running throughout — see "Live-stack decision"
above for the memory-contention detail). `pnpm test:unit` and
`pnpm test:db` were deliberately run sequentially, not concurrently, after
this session observed free memory drop to ~400 MB with both queued — the
same resource-contention class that crashed `test:unit` outright during the
Phase 3 gate.

Targeted Phase 4 test files, re-run fresh first (all real production
functions, not re-derived from the task ledger's memory):

```
pnpm vitest run lib/agent-engine/graph/namespace.test.ts lib/agent-engine/graph/port.test.ts \
  lib/agent-engine/graph/graphiti-client.test.ts lib/agent-engine/graph/episode-sanitize.test.ts \
  lib/agent-engine/graph/fact-map.test.ts
  Test Files  5 passed (5)
       Tests  111 passed (111)

pnpm vitest run workers/graph-projection.handler.test.ts workers/graph-lifecycle.handler.test.ts
  Test Files  2 passed (2)
       Tests  25 passed (25)

pnpm vitest run tests/unit/rebuild-graphiti.test.ts lib/agent-engine/context/graphiti-context-provider.test.ts \
  lib/agent-engine/agent/retrieve-optional-context-blocks.test.ts tests/unit/graph-context-golden.test.ts
  Test Files  4 passed (4)
       Tests  26 passed (26)
```

11 Phase 4 test files, 162 tests, all real and all green on this HEAD.

Full gate command list:

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS — `tsc --noEmit`, 0 errors, no output. |
| `pnpm lint` | PASS — exit 0, 0 errors, 201 pre-existing warnings (same class as prior gates: `no-console` in seed/sonda scripts, `@typescript-eslint/consistent-type-imports` and unused-var warnings in test fixtures — none in a Phase 4 file). |
| `pnpm lint:channels` | PASS — `lint-channels: ok (61 arquivos de dívida conhecida, nenhum novo)`, identical known-debt count to the Phase 3 gate; no new Phase 4 violation. |
| `pnpm test:unit` | PASS — **332 test files, 3450 tests**, exit code 0, 1125.03s (`Start at 15:23:14`, `transform 11.40s, setup 118.89s, import 360.99s, tests 64.00s, environment 481.07s`). Run alone (not concurrently with `test:db` — see below) after this session observed free memory at ~400 MB with both queued; no crash this run. |
| `pnpm test:db` | PASS — 72 test files, 480 tests passed + 1 skipped, exit code 0, 230.07s (`==> test:db verde`). Disposable `pgvector/pgvector:pg17` container via `scripts/test-db.sh`, torn down on exit (`==> teardown: removendo container deskcomm-test-db-790`). Baseline install + idempotent update both applied; the `ERROR`/`NOTICE`/`WARNING` lines visible mid-run (RLS violations, duplicate-key violations, a `system_version` check-constraint violation) are the suite's own expected negative-path assertions, not failures — the summary line confirms pass. Ran alone after `test:unit` finished, avoiding the memory contention observed earlier. |
| `pnpm ai:eval:local` | PASS — `{"total":36,"duplicate_ids":0,"p0_failures":0,"status":"pass"}`. 36 vs. Phase 3's 30 — the 6 new cases are Task 9's temporal-graph golden dataset (`graph-temporal-order-031`, `graph-preference-changed-032`, `graph-relationship-expired-033`, `graph-contradicts-crm-034`, `graph-tenant-isolation-035`, `graph-injection-inert-036`), all with empty `input_events` by design (see "Golden dataset scope" below). |
| `pnpm build` | PASS — exit code 0. `next build` (Turbopack, Next.js 16.3.0): `Compiled successfully in 32.8s`, full route/page manifest generated (all `/app/*`, `/api/v1/*` routes present, including the Phase 4 surfaces — `graph-projection`/`graph-lifecycle` are workers, not routes, so they do not appear in the route list but their imports compiled cleanly as part of the overall build). |
| `docker compose config --services` (dev) | PASS — see Step 1. |
| `docker compose -f docker-compose.prod.yml config --services` (prod) | PASS — see Step 1. |
| `git diff --check` (working tree) | PASS — exit 0, no output. |

`git diff --check origin/main...HEAD` was also run as a bonus check (same
discipline as the Phase 3 gate): exit 0, clean — no whitespace findings on
this branch relative to `origin/main`.

### Golden dataset scope (Task 9)

All 6 of Task 9's temporal-graph cases ship with `input_events: []` by
design, matching the `tenant-isolation-009` precedent from Phase 2: they
are proven by `tests/unit/graph-context-golden.test.ts` directly exercising
the real production functions (`mapGraphFact`, `GraphitiContextProvider`,
`fuseContext`, `promptSafeContextItems`, `prepareSemanticContext`) against
synthetic fixtures, not by a live-model pipeline. `scripts/ai-platform-eval-live.ts`
(the real-API pipeline used for Mem0's live Golden Dataset cases in the
Phase 2 gate) has no Graphiti code path at all, so leaving `input_events`
populated would silently be a no-op there rather than genuine live
coverage — Task 9's fix round emptied all 6 rows specifically to avoid that
false signal. `pnpm ai:eval:local`'s 36/36-with-0-duplicates/0-p0 result
above is the correct proof surface for these cases, not `ai:eval:live`.

## What shipped across Phase 4 (for context, not re-derived here)

Nine tasks landed across commits `cd4158ff..c522a33a`:

1. `GraphContextPort` contract + types (`lib/agent-engine/graph/port.ts`,
   `types.ts`), reusing the canonical `AuthorityDomain`/`MemoryRisk` from
   `lib/agent-engine/platform/contracts.ts`.
2. `graphGroupId(organizationId)` — deterministic, UUID-validated tenant
   namespace helper (`lib/agent-engine/graph/namespace.ts`).
3. Docker Compose `ai-graph` profile (originally FalkorDB, corrected to
   Neo4j mid-phase — see "Architecture deviation" above).
4. `GraphitiClient implements GraphContextPort` — REST adapter built
   against the real wire contract read from the image source (`POST
   /messages`, `POST /search`, `DELETE /group/{id}`, `GET /healthcheck`),
   typed errors, `AbortController` timeout, no secret leakage.
5. `sanitizeGraphEpisode()` (reject-not-redact, wired directly into
   `GraphitiClient.addEpisode()`) and `mapGraphFact()` (protected-domain
   risk mapping — consent/legal/commercial_status always floor to
   `risk: "high"`, `actionable: false`; the uninformative `"behavior"`
   adapter default also floors to `"high"` after a fix-round correction —
   see `fact-map.ts`'s doc comment for the review finding that drove it).
6. `workers/graph-projection.handler.ts` — projects `message.received`
   events into Graphiti via `ai_projection_ledger`, mirroring the Mem0
   projection handler pattern (`projection_type='graph'` already allowed by
   the existing check constraint — no schema migration needed).
7. `lib/agent-engine/context/graphiti-context-provider.ts` —
   rollout-mode-gated (off/shadow/canary/on) read path, wired into
   `inbound-turn.ts` alongside Mem0 via `Promise.all` (concurrency
   regression-tested after a fix round, see Step 5 above).
8. `workers/graph-lifecycle.handler.ts` + `scripts/rebuild-graphiti.ts` —
   LGPD purge/rebuild, tenant isolation and resurrection-blocking proven
   functionally (see Steps 2–5 above). Known, disclosed limitation carried
   forward below.
9. 6 temporal-graph golden dataset cases in
   `tests/fixtures/ai-platform/golden-cases.json` (see "Golden dataset
   scope" above).

Per-task fix rounds and their specific findings are documented in each
task's own report under
`.superpowers/sdd/2026-08-10-ai-platform-phase-4-graphiti/task-*-report.md`
and in the plan ledger (`progress.md`) — not repeated here; this gate cites
and re-runs their regression suites rather than re-deriving their history.

## Known limitation: per-contact LGPD redaction cannot remove already-projected Graphiti facts (disclosed, not a defect)

This is a real, accepted gap for a `SHADOW`-only phase, stated plainly per
the brief's instruction — not glossed over.

`GraphContextPort` (Task 1) exposes only `deleteOrganization(organizationId)`.
Graphiti's real REST API (`zepai/graphiti:0.22.0`, confirmed by Task 4
reading the packaged source) has **no per-entity/episode delete route** —
only whole-group deletion (`DELETE /group/{group_id}`). Consequently:

- **Tenant-scope LGPD redaction** (`organizations.status='redacted'`) works
  correctly and completely: `workers/graph-lifecycle.handler.ts` calls
  `deleteOrganization()` for the whole org group and bulk-marks every
  `applied` ledger row `deleted`. No operator action required; fully
  automatic.
- **Contact-scope LGPD redaction** (a single contact's data request) cannot
  achieve the same completeness. Deleting the entire tenant's graph group
  over one contact's redaction would be a disproportionate side effect on
  every other contact in the same org, so the handler deliberately does
  **not** call `deleteOrganization` for a contact-scope event. It marks that
  contact's own `applied` graph ledger rows `deleted` — which correctly
  blocks any future rebuild from re-projecting that contact's
  already-redacted messages — but it **does not and cannot remove that
  contact's already-projected facts from Neo4j**. Those facts remain live
  and org-wide-searchable (mixed into the shared tenant graph group) until
  either a future per-entity-deletion capability is added upstream/to the
  port, or the whole tenant group is purged some other way.

Disclosed in three places in the source tree, not just this gate:
`workers/graph-lifecycle.handler.ts`'s own doc comment ("Granularity gap vs
Mem0 — documented, not silently papered over"), `docs/runbooks/graphiti-rebuild.md`
("known gap, not silently papered over"), and `docs/runbooks/graphiti.md`'s
"Wipe e reconstrução completos" section. Escalated to the human project
owner during Task 8 for awareness.

**Correction (this fix wave): the argument below originally conflated two
different questions — prompt-influence risk and erasure/LGPD obligation —
and used the wrong one to justify `SHADOW`. Restated accurately:**

*What IS true, and independently verified:* at `SHADOW`, no graph fact
reaches a prompt or influences a decision
(`GraphitiContextProvider.retrieve()` routes shadow-mode results to
`shadowItems`, never `items`; `influencePrompt` stays `false`, and there is
no other consumer of `search()` in this codebase today). A contact's
residual facts sitting in Neo4j under `SHADOW` are not disclosed to that
contact, another tenant, or any automated action via the prompt path.

*What is NOT true, and was the actual reasoning error:* this does **not**
mean `SHADOW` is "measurement-only" in the sense of creating no real,
retained personal data. `processGraphProjection`
(`workers/graph-projection.handler.ts`) writes to Graphiti whenever the
org's mode is anything other than `"off"` — `SHADOW` is a full write/egress
path. Enabling Graphiti at `SHADOW` for a real tenant means that tenant's
message content is genuinely sent to the Graphiti sidecar, processed by an
external LLM/embedder subprocessor
(`GRAPHITI_LLM_PROVIDER`/`GRAPHITI_EMBEDDER_PROVIDER`), and persisted in
Neo4j — not merely measured and discarded. Combined with the disclosed
whole-group-only delete limitation above, a contact who exercises LGPD
erasure while their org is at `SHADOW` leaves residue that cannot be
selectively removed from Neo4j, regardless of whether that residue ever
reaches a prompt. Prompt-safety and data-retention/erasure are separate
properties; only the first was actually proven by this phase's tests.

**Correct compliance framing:** the decision point for the per-contact
redaction gap above is **before `SHADOW` is enabled for any real tenant**,
not "before canary/on" as previously implied here. `SHADOW`'s prompt-safety
guarantee does not resolve the LGPD question — it only means a residual
fact cannot influence a reply while `SHADOW` holds. This phase still ends at
`SHADOW` as its default/shipped state (no tenant is enabled by default —
`graphiti` has no `ai_platform_feature_flags` row, so it resolves to `off`
platform-wide per `lib/agent-engine/platform/features.ts`), but a human/
compliance owner must explicitly weigh this data-flow fact — not just the
prompt-safety property — before turning `SHADOW` on for any specific
organization, not only before a future `canary`/`on` promotion.

## Known limitation: the Graphiti read path is not wired into production (disclosed, this fix wave)

Stated plainly, not glossed over: **nothing outside test files constructs
`GraphitiContextProvider` today.** `InboundTurnDeps.graphContextProvider`
(`lib/agent-engine/agent/inbound-turn.ts`) is never populated by any real
caller in the running application — only by test harnesses
(`lib/agent-engine/context/graphiti-context-provider.test.ts`,
`lib/agent-engine/agent/retrieve-optional-context-blocks.test.ts`). This
means that even where the write path is live for an org (`SHADOW` or
higher), **no `SHADOW`-mode read/metrics are actually being collected in a
real deployment today** — a reader of this gate could reasonably have
assumed shadow measurement was happening in production because the provider
exists and is fully tested; it is not exercised outside tests.

This is inherited, not a Phase 4 regression: Phase 2's `semanticContextProvider`
(Mem0) has the identical gap, undisclosed at the time of that phase's gate.
Both context providers are fully implemented, fully unit-tested, and neither
is instantiated by the process that actually handles an inbound turn in
production.

**Follow-up required, out of scope for this fix wave:** wire
`GraphitiContextProvider` (and, ideally in the same pass,
`Mem0ContextProvider`) into the real `InboundTurnDeps` construction path used
by the production worker/route entrypoint, so `SHADOW`-mode metrics
genuinely start accumulating. Track this as a named Phase 5 (or earlier,
operator-approved out-of-band) task — do not treat this gate's `SHADOW`
decision as implying measurement is already underway.

## Release Gate

```
Decision: GO — end Phase 4 at SHADOW (no canary/on promotion in this task)
Commit range: cd4158ff..c522a33a
Tests executed (fresh reruns on c522a33a):
- pnpm vitest run lib/agent-engine/graph/{namespace,port,graphiti-client,episode-sanitize,fact-map}.test.ts -> 111/111 passed (5 files)
- pnpm vitest run workers/graph-projection.handler.test.ts workers/graph-lifecycle.handler.test.ts -> 25/25 passed (2 files)
- pnpm vitest run tests/unit/rebuild-graphiti.test.ts lib/agent-engine/context/graphiti-context-provider.test.ts lib/agent-engine/agent/retrieve-optional-context-blocks.test.ts tests/unit/graph-context-golden.test.ts -> 26/26 passed (4 files)
- pnpm typecheck -> pass, 0 errors
- pnpm lint -> pass (0 errors, 201 pre-existing warnings, none in a Phase 4 file)
- pnpm lint:channels -> pass, clean (61 known-debt files, 0 new)
- pnpm test:unit -> pass (332 files, 3450 tests, 1125.03s)
- pnpm test:db -> pass (72 files, 480 passed + 1 skipped, 230.07s)
- pnpm ai:eval:local -> pass (36 cases, 0 duplicate ids, 0 P0 failures)
- pnpm build -> pass (Compiled successfully in 32.8s, exit 0)
- docker compose config --services (dev) -> pass, no falkordb reference, ai-graph profile services resolve with placeholder secrets
- docker compose -f docker-compose.prod.yml config --services (prod) -> pass, same
- git diff --check (working tree) -> pass, clean
- git diff --check (origin/main...HEAD) -> pass, clean
Global Constraints verified:
- No graph result can authorize a HIGH-risk action: mapGraphFact hardcodes actionable:false for every domain (lib/agent-engine/graph/fact-map.ts); GraphitiContextProvider only ever sets influencePrompt:true in canary/on, and shadow results never leave shadowItems.
- group_id is trusted-adapter-derived, never caller-supplied: proven at namespace/client/handler layers (see Steps 2-5).
- No public Graphiti/Neo4j port in production: confirmed reading docker-compose.prod.yml directly (no ports:, ai-graph-internal is internal:true).
- No secrets/raw credentials ingested: sanitizeGraphEpisode wired into GraphitiClient.addEpisode(), reject-not-redact (episode-sanitize.test.ts).
P0 open: 0
P1 open: 0
Residual/deferred (not blocking SHADOW as this phase's shipped/default OFF state):
- Per-contact LGPD redaction cannot remove already-projected Graphiti facts from Neo4j (upstream API limitation, whole-group-only delete). CORRECTED this fix wave: this must be resolved or explicitly risk-accepted BEFORE SHADOW is enabled for any real tenant, not only before canary/on — SHADOW is a full write/egress path (message content reaches an external LLM/embedder subprocessor and is persisted in Neo4j), and its prompt-safety property does not resolve the erasure/LGPD question.
- The Graphiti read path (GraphitiContextProvider) is not wired into any production entrypoint — disclosed this fix wave. No SHADOW-mode metrics are actually being collected today regardless of an org's stored mode. Inherited from Phase 2's identical Mem0 gap. Tracked as a named follow-up task, not fixed in this wave.
- Stale "FalkorDB" wording in doc comments (port.ts:13,20, types.ts:10,13, namespace.ts:7, graphiti-client.ts:122) — harmless, doc-only, deferred to a future doc pass.
- 201 pre-existing lint warnings, unrelated to this phase.
- Live neo4j+graphiti round-trip smoke test not repeated in this gate (already proven live in Task 3/4; RAM-constrained host, judged non-redundant risk not worth repeating — see "Live-stack decision").
Human actions required:
- None to keep Graphiti at its default OFF/native state.
- A human/compliance owner must decide how to handle the disclosed per-contact-redaction gap BEFORE enabling SHADOW for any specific real organization — not deferred until a future canary/on promotion.
- Wiring GraphitiContextProvider (and Mem0ContextProvider) into the real production entrypoint is required before SHADOW measurement claims can be made for any org — tracked as follow-up work, not done in this phase.
Rollback verified: yes — graphiti defaults to off (no ai_platform_feature_flags row = off, per lib/agent-engine/platform/features.ts), AI_PLATFORM_KILL_GRAPHITI kill switch exists and is checked before any per-org rollout mode (and, per this fix wave, rebuild-graphiti.ts's own escalation-downgrade decision now reads the STORED mode directly rather than the kill-switch-masked one, so it cannot be defeated by an active kill switch), and GraphitiContextProvider degrades to an empty/disabled result on any failure rather than breaking a turn.
```

## References

- Plan: [`../../superpowers/plans/2026-08-10-ai-platform-phase-4-graphiti.md`](../../superpowers/plans/2026-08-10-ai-platform-phase-4-graphiti.md)
- Task reports and ledger: [`../../../.superpowers/sdd/2026-08-10-ai-platform-phase-4-graphiti/`](../../../.superpowers/sdd/2026-08-10-ai-platform-phase-4-graphiti/)
- Neo4j swap verification: `.superpowers/sdd/2026-08-10-ai-platform-phase-4-graphiti/task-3-neo4j-swap-report.md`
- Operator runbooks: [`../../runbooks/graphiti.md`](../../runbooks/graphiti.md), [`../../runbooks/graphiti-rebuild.md`](../../runbooks/graphiti-rebuild.md)
- QA/release gate format: [`../../superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`](../../superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md)
- Prior gates: [`phase-0-gate.md`](phase-0-gate.md), [`phase-1-gate.md`](phase-1-gate.md), [`phase-2-mem0-gate.md`](phase-2-mem0-gate.md), [`phase-3-knowledge-gate.md`](phase-3-knowledge-gate.md)
