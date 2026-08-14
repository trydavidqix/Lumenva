# Phase 3 (Knowledge / Obsidian / LlamaIndex) — release gate

Date: 2026-08-14 (original gate); re-verified 2026-08-14 after a merge + fix
wave (see "Post-review fix wave" below).
Branch: `ai-platform-foundation`
Original commit range: `8735d69a..f29bffac` (Task 1 through Task 8, this
plan's own commits)
Re-verification HEAD: `f564ae0e` (`origin/main` merged in at `fa5090a5`, then
fix-wave commits `c3432ba6`, `0683131a`, `f04b0e6f`, then unrelated
`lint:channels` fix `f564ae0e`)
Gate commit: recorded below, after this document is committed.

## Decision

**GO — no caveats remaining beyond the one explicit, named Step 3 gap**
(zero P0/P1 findings open anywhere in this gate). All four required
properties (native-only baseline, DRAFT/REVIEW export block, PUBLISHED
export→search path, LlamaIndex shadow/failure isolation) are proven by real,
freshly re-run test suites on the current, merged HEAD (`f564ae0e`), and the
full Step 5 verification suite is green: `typecheck`, `lint`, `test:unit`,
`test:db`, `ai:eval:local`, `build`, and `git diff --check` (working tree)
all passed with real command output captured below. `lint:channels` was also
run as a bonus check (not in the brief's literal Step 5 list, but required by
`CLAUDE.md`'s own gate list) and is clean — including on this re-verification,
where it caught and blocked on a real pre-existing violation the `origin/main`
merge brought in (see "Post-review fix wave").

This supersedes the original 2026-08-14 gate run, which was later found by a
final whole-branch review to have been run on a tree 65 commits behind
`origin/main`, plus two Important findings. All of that is now resolved — see
"Post-review fix wave" below — and this re-verification is real, freshly
executed evidence on the current tree, not a re-statement of the original
run's numbers.

One explicit, named gap carried forward unchanged (not something the fix wave
was asked to address): Step 3 ("export → upload → index") is proven in two
real halves — export+search and upload+event-emission — but no single
automated test chains them together, because production itself doesn't
either: the Obsidian export CLI deliberately stops at a local artifact, and a
human uploads it via the CRM UI (`docs/runbooks/obsidian-knowledge.md`,
"O export CLI **não** faz esse upload sozinho"). See Step 3 below for detail.
This is a documented architectural boundary, not a missing regression test,
but it means "export→upload→index" as one continuous *automated* code path
has never been exercised end-to-end in a single run — flagged as a residual
gap rather than rounded up to full coverage.

## Post-review fix wave

After the original gate was recorded, a final whole-branch review found the
gate's verification had run on a tree 65 commits behind `origin/main`, plus
**2 Important and 10 Minor findings**. All were fixed, in order, on this
branch:

1. `fa5090a5` — merged `origin/main` in, resolving the staleness. The
   rate-limit code the reviewer flagged as at-risk in the merge (Important 1)
   survived the merge intact.
2. `c3432ba6` — covered the 429 rate-limit path with a real test (Important 1)
   and restored the pre-extraction file-size check ordering (Minor: buffer-
   before-validation regression).
3. `0683131a` — hoisted the FAQ-reindex feature/adapter resolution to run once
   per event instead of once per item (Important 2 — the untested per-item
   DB-query loop in `workers/rag-indexer.ts`), plus fixed shadow-mode
   `ingestion_mode` mislabeling and deduplicated a telemetry callback (Minors).
4. `f04b0e6f` — fixed a vacuous golden-suite assertion, corrected a fake that
   discarded production's real `version_number`, added a missing
   secret-shape characterization test, fixed runbook step-ordering and a
   provider-name doc leak, added missing storage-upload-error coverage
   (remaining Minors from the review, 9 of the 10 total).
5. `f564ae0e` — fixed the 10th Minor: a `lint:channels` violation
   (`lib/messaging/stop-keyword.ts` comment naming "WAHA" outside the channel
   boundary) that `origin/main`'s own bug-sweep merge (`4691624c`) had
   introduced before this branch ever merged it in. Pre-existing and unrelated
   to Phase 3, but caught while re-running this gate's verification suite and
   fixed as a comment-only reword (no logic change) so the gate could report a
   genuinely clean `lint:channels` run.

This re-verification (Step 5 below, run fresh on `f564ae0e`) confirms all of
the above fixes hold on the current tree: the rate-limit test passes, the FAQ
reindex path resolves the feature flag once per event (proven by the new
2-item test in `workers/rag-indexer.test.ts`), and `lint:channels` is clean
with zero new violations.

## Step 1 — native-only mode matches baseline

`workers/rag-indexer.ts` routes chunk generation through
`resolveIngestionNodes` (Task 6/7), but with the `llamaindex` feature at its
default (`off`), the resolver's `off` branch returns the native adapter's
output unchanged — same chunker, same metadata contract as pre-Phase-3.

Re-run fresh on the current, merged, fix-wave HEAD (`f564ae0e`):

```
pnpm vitest run workers/rag-indexer.test.ts
```

```
Test Files  1 passed (1)
     Tests  12 passed (12)
```

12 tests, not the original 11 — the fix wave (`0683131a`, Important 2) added
`"N>1 FAQ items: resolves the feature/adapter ONCE for the whole event, not
once per item, and indexes every item"`, which is itself a property this gate
cares about (see "Post-review fix wave"). This is the same file/assertions
Task 7 built specifically to prove the native-only baseline (see `"feature
off: uses the native adapter's output and activates the new version"` and the
equivalent product-path test) — re-run now, not re-derived from memory, and
green on the current tree.

## Step 2 — Obsidian DRAFT/REVIEW cannot export

Re-run fresh on `f564ae0e`:

```
pnpm vitest run tests/unit/obsidian-export.test.ts tests/unit/knowledge-publication-golden.test.ts
```

```
Test Files  2 passed (2)
     Tests  21 passed (21)
```

Same count as the original gate — the fix wave's golden-suite changes
(Minors 4/5: fixed a vacuous assertion and a fake that discarded production's
real `version_number`) corrected what existing assertions checked, not how
many tests exist.

Direct proof lives in `tests/unit/obsidian-export.test.ts`: `"refuses a DRAFT
note"`, `"refuses a REVIEW note"`, `"refuses an ARCHIVED note"` — each calls
the real `exportObsidianNote()` (the same function
`pnpm knowledge:obsidian:export` runs) and asserts it throws before any file
is written. `tests/unit/knowledge-publication-golden.test.ts`'s scenario 2
(`"the real Obsidian export gate refuses DRAFT/REVIEW/ARCHIVED and writes no
export artifact"`) repeats this against all three non-PUBLISHED statuses in
one golden-case-backed assertion, and additionally proves a subsequent
`searchKnowledge()` call against an empty fake pool finds nothing
draft-derived — i.e., not just "export refuses" but "nothing draft ever
becomes retrievable."

## Step 3 — PUBLISHED export→upload→index path

Re-run fresh on `f564ae0e` (same command as Step 2, scenario 1 of the same file):

```
pnpm vitest run tests/unit/knowledge-publication-golden.test.ts
```

```
Test Files  1 passed (1)
     Tests  6 passed (6)
```

Scenario 1 (`"exports a PUBLISHED refund-policy note and retrieval returns
its real published content"`) writes a real Obsidian note to a temp dir,
calls the real `exportObsidianNote()` (which internally runs
`assertPublishableDocument()` + `scanPublishableKnowledge()`), reads the
exported Markdown back off disk, feeds it into a fake `pg.Pool` as a
`retrieve_top_k_chunks` row, and calls the real `searchKnowledge()`
(`lib/agent-engine/agent/search-knowledge.ts` — the function the agent's
`search_knowledge` tool actually calls) to retrieve it. This proves
**export → sanitize/scan → search/retrieval** end to end with synthetic
Markdown, exactly as the brief specifies.

**Named gap — "upload" is not literally chained to this run.** The word
"upload" in the brief maps to `publishKnowledgePolicy()`
(`lib/ai/rag/publication/publish-policy.ts`, Task 4) and the route
`app/api/v1/ai/knowledge/sources/upload/route.ts`, which is what actually
inserts an `ai_knowledge_sources` row and emits the `knowledge_source.updated`
event that `workers/rag-indexer.ts`'s `handleKnowledgeSourceUpdated` consumes
to index it into `ai_chunks`. Scenario 1 above does not call
`publishKnowledgePolicy()` — it constructs the fake `pg.Pool` row directly.

Re-run separately, fresh, to confirm the upload half on its own:

```
pnpm vitest run lib/ai/rag/publication/publish-policy.test.ts
```

```
Test Files  1 passed (1)
     Tests  13 passed (13)
```

13 tests, not the original 12 — the fix wave (`c3432ba6` restored the
pre-extraction file-size ordering; `f04b0e6f`/Minor 11 added
`"upload no storage falha → internal_error, sem insert/emit e sem tentar
limpar"`). This file's first test — `"uploads, valida extração, insere a
fonte e emite knowledge_source.updated"` — proves upload→validate→insert→emit
for real.
Combined with `workers/rag-indexer.test.ts`'s proof that
`handleKnowledgeSourceUpdated` correctly consumes that same event type and
indexes via `resolveIngestionNodes`, **both halves of the chain are proven
independently**, but no single test file drives one exported Markdown file
through `publishKnowledgePolicy()`, through the emitted event, through the
worker's handler, into `ai_chunks`, and back out through `searchKnowledge()`
in one continuous run.

This is not an accidental coverage hole: `docs/runbooks/obsidian-knowledge.md`
documents that production itself has no such continuous path — the export
CLI stops at two local files in `.local/knowledge-publish/`, and a human
reviews and uploads them via the UI as a deliberate control point (defense in
depth against publishing unreviewed content, per the same runbook's "Limite
conhecido do scanner" section). So there is no single production code path
this gate could exercise start-to-finish even if it tried; the two halves
meeting at a human action is the actual architecture, not a defect. Recorded
here explicitly per the brief's instruction not to silently treat partial
coverage as complete.

## Step 4 — LlamaIndex shadow failure cannot replace active knowledge

Re-run fresh on `f564ae0e`:

```
pnpm vitest run lib/ai/rag/ingestion/llamaindex-adapter.test.ts lib/ai/rag/ingestion/resolve-adapter.test.ts
```

```
Test Files  2 passed (2)
     Tests  24 passed (24)
```

```
pnpm vitest run workers/rag-indexer.test.ts
```

```
Test Files  1 passed (1)
     Tests  12 passed (12)
```

(`rag-indexer.test.ts` is 12 here for the same reason as Step 1 — the fix
wave's new N>1 FAQ-items test; `llamaindex-adapter.test.ts`/
`resolve-adapter.test.ts` are unchanged at 24, since the fix wave's change to
`workers/rag-indexer.ts` did not touch the adapter/resolver files themselves.)

Two independent properties, both re-proven on this tree:

- **Shadow-mode purity** (Task 6, `resolve-adapter.test.ts`): in `shadow`
  mode, `resolveIngestionNodes` always returns the native adapter's `nodes`
  (`result.nodes === nativeNodes`), even when the LlamaIndex adapter's output
  differs or throws — the LlamaIndex side is wrapped so a failure there
  degrades the comparison, never the returned content.
  `workers/rag-indexer.test.ts`'s `"shadow mode: stores only the resolver's
  returned (native) nodes, never llamaindex output"` proves the worker layer
  on top of that never reads the shadow comparison payload for content.
- **Adapter failure leaves the previously active version untouched** (Task 7,
  `workers/rag-indexer.test.ts`): with `resolveIngestionNodes` mocked to
  reject entirely (both adapters unavailable), the tests
  `"resolver failure (both adapters unavailable) leaves the previously active
  version untouched"` (FAQ path) and `"resolver failure leaves the previously
  active version untouched"` (product path) assert zero
  `ai_knowledge_versions` inserts/updates, zero `activate_kb_version` RPC
  calls, and zero `ai_chunks` upserts — because the resolver call happens
  strictly before `createKnowledgeVersion`. Separately, `canary`/`on` mode's
  own fail-open behavior (Task 6 fix round 1, `resolve-adapter.test.ts`:
  `"fails open to the native adapter's output when the LlamaIndex adapter
  throws in canary/on mode"`) proves a mid-flight LlamaIndex throw falls back
  to native output rather than propagating or corrupting the active version.

Together these cover both failure shapes the plan's Global Constraint names
("Failed new ingestion must never replace the previously active knowledge
version"): a hard resolver-level failure (nothing gets written, old version
stays active) and a soft adapter-level failure in canary/on (native output is
substituted transparently, old version is never touched because a new one
successfully activates on native content instead).

## Step 5 — full verification (re-verification on `f564ae0e`)

Re-run 2026-08-14, this branch at HEAD `f564ae0e`, this Windows machine (8 GB
host, Docker Desktop, other dev processes — a `next dev` server, mem0/
channel-messaging containers — running throughout):

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS — `tsc --noEmit`, 0 errors, no output. |
| `pnpm lint` | PASS — exit 0, 0 errors, 200 pre-existing warnings (identical count to the original gate; confirmed none are in files this phase or the fix wave touched — `no-console` in seed/sonda scripts, `@typescript-eslint/consistent-type-imports` in test files, unrelated unused-var lint in test fixtures). |
| `pnpm lint:channels` | PASS — `lint-channels: ok (61 arquivos de dívida conhecida, nenhum novo)`. This is the check that was failing before `f564ae0e` (see "Post-review fix wave") — confirmed clean on this re-verification. |
| `pnpm test:unit` | PASS — **321 test files, 3287 tests**, exit code 0, 1192.40s (`Start at 19:25:23`, `transform 15.25s, setup 147.01s, import 291.06s, tests 49.45s, environment 581.63s`). 3287 vs. the original gate's 3278 — the 9 extra are the fix wave's new tests (429 rate-limit path, N>1 FAQ-items feature-resolution-once test, sanitize.test.ts secret-shape characterization, storage-upload-error coverage, etc.). **See "test:unit needed a kill-and-restart" below — the first attempt on this re-verification crashed outright (not just stalled) and was restarted once; this number is from the clean restart.** |
| `pnpm test:db` | PASS — 72 test files, 480 tests passed + 1 skipped, exit code 0, 306.73s (`==> test:db verde`). Disposable `pgvector/pgvector:pg17` container via `scripts/test-db.sh`, torn down on exit (`==> teardown: removendo container deskcomm-test-db-11989`). Baseline install + idempotent update both applied; the `ERROR`/`NOTICE`/`WARNING` lines visible mid-run (e.g. `new row for relation "system_version" violates check constraint`, `duplicate key value violates unique constraint`) are the suite's own expected negative-path assertions, not failures — the summary line confirms pass. Identical file/test counts to the original gate. |
| `pnpm ai:eval:local` | PASS — `{"total":30,"duplicate_ids":0,"p0_failures":0,"status":"pass"}`. Identical to the original gate. |
| `pnpm build` | PASS — exit code 0. `next build` (Turbopack, Next.js 16.3.0): `Compiled successfully in 2.7min`, TypeScript finished in 83s, 43/43 static pages generated, all routes/pages collected. The `[env] No AI_GATEWAY_API_KEY...`/`No OPENAI_API_KEY...`/`IMPERSONATE_COOKIE_SECRET not set...` lines are the same documented graceful-degradation warnings for optional envs as the original gate, not build errors. |
| `git diff --check` (working tree) | PASS — exit code 0, no output. |

**`git diff --check origin/main...HEAD`** (branch vs. current main, re-run
against the now-merged tree): exits **2** with the same **10** trailing-
whitespace findings as the original gate, in the same four files —
`docs/superpowers/plans/2026-08-10-ai-platform-execution-index.md`,
`docs/superpowers/plans/2026-08-10-ai-platform-phase-0-foundation.md`,
`docs/superpowers/specs/2026-08-10-ai-platform-master-design.md`, and
`docs/superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`. Diffed
line-for-line against the original gate's list: identical findings, nothing
new. These predate this phase's own commits entirely (Phase 0 planning docs,
Markdown two-space hard-break syntax) and remain unrelated to Phase 3 or the
fix wave — **not fixed here**, out of scope per `CLAUDE.md`'s "não corrija
automaticamente" for unrelated issues found during a task.

### `test:unit` needed a kill-and-restart during this re-verification too

The first `pnpm test:unit` attempt on this re-verification did not merely
stall — it crashed outright after processing exactly one test file
(`lib/ui/icons.test.ts`), terminating with `ELIFECYCLE Command failed with
exit code 4294967295` (a killed/crashed-process exit signature, not a normal
failure exit). Direct process inspection confirmed a competing memory-heavy
process set (stray mem0/channel-messaging containers) was contending for RAM
on this 8 GB host. Those were stopped, the crashed process tree was killed,
and `pnpm test:unit` was restarted fresh. The restart's CPU climbed normally
throughout and completed cleanly at 321/3287 passed, exit 0, 1192.40s — the
number reported above is from that clean restart, not the crashed attempt.
This is the same class of environmental finding the original gate recorded
(resource contention on this host can take down a single vitest run) — here
it manifested as an outright crash rather than a silent stall, but the
resolution and disclosure discipline are the same: killed, restarted once,
and the real number reported is from the verified-clean rerun.

## What shipped across Phase 3 (for context, not re-derived here)

Nine tasks (frontmatter validator, secret/PII scanner, Obsidian export CLI,
shared publication service, pluggable ingestion port, LlamaIndex adapter,
RAG-indexer wiring, provenance/publication golden suite, this gate) landed
across commits `8735d69a..f29bffac`. Per-task fix rounds and their specific
findings are documented in each task's own report under
`.superpowers/sdd/2026-08-10-ai-platform-phase-3-knowledge/task-*-report.md`
and are not repeated here; this gate cites and re-runs their regression
suites rather than re-deriving their history.

## Release Gate

```
Decision: GO (with one named, explicit gap — see Step 3; unchanged from original gate)
Original commit range: 8735d69a..f29bffac
Re-verification HEAD: f564ae0e (origin/main merged at fa5090a5, fix wave
  c3432ba6/0683131a/f04b0e6f, unrelated lint:channels fix f564ae0e)
Tests executed (fresh reruns on f564ae0e):
- pnpm vitest run workers/rag-indexer.test.ts -> 12/12 passed (was 11/11; +1 fix-wave test)
- pnpm vitest run tests/unit/obsidian-export.test.ts tests/unit/knowledge-publication-golden.test.ts -> 21/21 passed
- pnpm vitest run tests/unit/knowledge-publication-golden.test.ts -> 6/6 passed
- pnpm vitest run lib/ai/rag/publication/publish-policy.test.ts -> 13/13 passed (was 12/12; +1 fix-wave test)
- pnpm vitest run lib/ai/rag/ingestion/llamaindex-adapter.test.ts lib/ai/rag/ingestion/resolve-adapter.test.ts -> 24/24 passed
- pnpm typecheck -> pass, 0 errors
- pnpm lint -> pass (0 errors, 200 pre-existing warnings, identical to original gate)
- pnpm lint:channels -> pass, clean (this is the check f564ae0e fixed — was failing pre-fix)
- pnpm test:unit -> pass (321 files, 3287 tests, 1192.40s; +9 tests vs original 3278, all from the fix wave; first attempt on this re-verification crashed from RAM contention and was restarted once, see Step 5)
- pnpm test:db -> pass (72 files, 480 passed + 1 skipped, 306.73s; identical counts to original gate)
- pnpm ai:eval:local -> pass (30 cases, 0 duplicate ids, 0 P0 failures; identical to original gate)
- pnpm build -> pass (Compiled successfully in 2.7min, 43/43 static pages, exit 0)
- git diff --check (working tree) -> pass, clean
- git diff --check (origin/main...HEAD) -> 10 pre-existing whitespace findings in Phase-0 docs, unrelated to this phase, identical list to original gate, not blocking
Metrics:
- ai:eval:local baseline (Phase 2 gate): 25 cases, 0 P0 -> candidate (this gate): 30 cases, 0 P0
P0 open: 0
P1 open: 0 (both Important findings from the whole-branch review are fixed and re-confirmed — see "Post-review fix wave")
Residual P2:
- Step 3's export->upload->index path is proven in two halves, not one continuous automated run (architectural: a human bridges export and upload by design, per docs/runbooks/obsidian-knowledge.md) — unchanged, not something the fix wave was asked to address
- 200 pre-existing lint warnings, unrelated to this phase
- 10 pre-existing trailing-whitespace findings in Phase-0 planning docs, unrelated to this phase
Fixed since original gate (see "Post-review fix wave" for detail):
- 2 Important findings (429 rate-limit path merge risk; untested per-item FAQ-reindex DB-query loop)
- 10 Minor findings (buffer-before-validation ordering, vacuous golden-suite assertion, fake version_number, shadow-mode ingestion_mode mislabeling, runbook citation/ordering, provider-name doc leak, duplicated telemetry callback, missing storage-upload-error coverage, and a pre-existing lint:channels violation surfaced by re-running this gate)
Human actions required:
- None to keep llamaindex/obsidian features at their default OFF/native state.
- A human must still manually upload any exported Obsidian artifact via the knowledge UI, per the documented (not automated) publication flow — this is expected operation, not a follow-up task.
Rollback verified: yes — llamaindex defaults to off/native, AI_PLATFORM_KILL_LLAMAINDEX kill switch exists (Task 6), and canary/on mode fails open to native on adapter error (Task 6 fix round 1) rather than breaking ingestion.
```

## References

- Plan: [`../../superpowers/plans/2026-08-10-ai-platform-phase-3-knowledge.md`](../../superpowers/plans/2026-08-10-ai-platform-phase-3-knowledge.md)
- Task reports: [`../../../.superpowers/sdd/2026-08-10-ai-platform-phase-3-knowledge/`](../../../.superpowers/sdd/2026-08-10-ai-platform-phase-3-knowledge/)
- Obsidian operator runbook: [`../../runbooks/obsidian-knowledge.md`](../../runbooks/obsidian-knowledge.md)
- QA/release gate format: [`../../superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`](../../superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md)
- Prior gates: [`phase-0-gate.md`](phase-0-gate.md), [`phase-1-gate.md`](phase-1-gate.md), [`phase-2-mem0-gate.md`](phase-2-mem0-gate.md)
