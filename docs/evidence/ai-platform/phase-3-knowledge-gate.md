# Phase 3 (Knowledge / Obsidian / LlamaIndex) — release gate

Date: 2026-08-14
Branch: `ai-platform-foundation`
Commit range: `8735d69a..f29bffac` (Task 1 through Task 8, this plan's own commits)
Gate commit: recorded below, after this document is committed.

## Decision

**GO, with one explicit, named gap** (Step 3 coverage — see below; zero P0
failures found anywhere in this gate). All four required properties (native-only baseline, DRAFT/REVIEW export
block, PUBLISHED export→search path, LlamaIndex shadow/failure isolation) are
proven by real, freshly re-run test suites on this final tree, and the full
Step 5 verification suite is green: `typecheck`, `lint`, `test:unit`,
`test:db`, `ai:eval:local`, `build`, and `git diff --check` (working tree)
all passed with real command output captured below. `lint:channels` was also
run as a bonus check (not in the brief's literal Step 5 list, but required by
`CLAUDE.md`'s own gate list) and is clean.

One explicit, named gap: Step 3 ("export → upload → index") is proven in two
real halves — export+search and upload+event-emission — but no single
automated test chains them together, because production itself doesn't
either: the Obsidian export CLI deliberately stops at a local artifact, and a
human uploads it via the CRM UI (`docs/runbooks/obsidian-knowledge.md`,
"O export CLI **não** faz esse upload sozinho"). See Step 3 below for detail.
This is a documented architectural boundary, not a missing regression test,
but it means "export→upload→index" as one continuous *automated* code path
has never been exercised end-to-end in a single run — flagged as a residual
gap rather than rounded up to full coverage.

## Step 1 — native-only mode matches baseline

`workers/rag-indexer.ts` routes chunk generation through
`resolveIngestionNodes` (Task 6/7), but with the `llamaindex` feature at its
default (`off`), the resolver's `off` branch returns the native adapter's
output unchanged — same chunker, same metadata contract as pre-Phase-3.

Re-run fresh on this tree:

```
pnpm vitest run workers/rag-indexer.test.ts
```

```
Test Files  1 passed (1)
     Tests  11 passed (11)
```

This is the same file/assertions Task 7 built specifically to prove this
property (see `"feature off: uses the native adapter's output and activates
the new version"` and the equivalent product-path test) — re-run now, not
re-derived from memory, and green on the final Task 8 tree.

## Step 2 — Obsidian DRAFT/REVIEW cannot export

Re-run fresh:

```
pnpm vitest run tests/unit/obsidian-export.test.ts tests/unit/knowledge-publication-golden.test.ts
```

```
Test Files  2 passed (2)
     Tests  21 passed (21)
```

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

Re-run fresh (same command as Step 2, scenario 1 of the same file):

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
     Tests  12 passed (12)
```

This file's first test — `"uploads, valida extração, insere a fonte e emite
knowledge_source.updated"` — proves upload→validate→insert→emit for real.
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

Re-run fresh:

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
     Tests  11 passed (11)
```

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

## Step 5 — full verification

Run 2026-08-14, this branch, this Windows machine (8 GB host, Docker Desktop
29.6.2, multiple other dev processes — 2 concurrent `next dev` servers, a
Playwright MCP server, the Mem0/channel-messaging Docker containers from
Phase 2/Phase-0 work — already running throughout):

| Command | Result |
|---|---|
| `pnpm typecheck` | PASS — `tsc --noEmit`, 0 errors. |
| `pnpm lint` | PASS — exit 0, 0 errors, 200 pre-existing warnings (all in files this phase never touched — `no-console` in seed/sonda scripts, `@typescript-eslint/consistent-type-imports` in test files, unrelated unused-var lint in test fixtures). |
| `pnpm lint:channels` | PASS (bonus, not in the brief's literal Step 5 list but required by `CLAUDE.md`) — `ok (61 arquivos de dívida conhecida, nenhum novo)`. |
| `pnpm test:unit` | PASS — 321 test files, 3278 tests, exit code 0, 983.93s. **See "test:unit had to be restarted" below — the first attempt stalled and was killed/rerun; this number is from the successful rerun.** |
| `pnpm test:db` | PASS — 72 test files, 480 tests passed + 1 skipped, exit code 0, 243.05s. Disposable `pgvector/pgvector:pg17` container via `scripts/test-db.sh`, torn down on exit (`==> teardown: removendo container deskcomm-test-db-10191`). Baseline install + idempotent update both applied; the `ERROR`/`NOTICE` lines visible mid-run are the RLS-isolation and idempotency assertions' own expected negative-path output (e.g. `new row violates row-level security policy`, `already exists, skipping`), not failures — the suite's own summary line, `==> test:db verde`, confirms pass. |
| `pnpm ai:eval:local` | PASS — `{"total":30,"duplicate_ids":0,"p0_failures":0,"status":"pass"}`. |
| `pnpm build` | PASS — exit code 0. `next build` (Turbopack, Next.js 16.3.0): `Compiled successfully in 88s`, TypeScript finished in 57s, all routes/pages collected. The `[env] No AI_GATEWAY_API_KEY...`/`No OPENAI_API_KEY...`/`IMPERSONATE_COOKIE_SECRET not set...` lines are the platform's documented graceful-degradation warnings for optional envs, not build errors — consistent with the self-host doctrine that a missing optional env must degrade a feature, not break the build. |
| `git diff --check` (working tree) | PASS — exit code 0, no output (no uncommitted changes at the time of this check). |

**`git diff --check` over the branch range** (extra, since the working-tree
check is trivially clean on a fully-committed branch and the brief invited
judgment on which range to use): `git diff --check main...HEAD` exits **2**
with 10 trailing-whitespace findings, all inside
`docs/superpowers/plans/2026-08-10-ai-platform-execution-index.md`,
`docs/superpowers/plans/2026-08-10-ai-platform-phase-0-foundation.md`,
`docs/superpowers/specs/2026-08-10-ai-platform-master-design.md`, and
`docs/superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`. All four
files were last touched by commits `6e99e0dc`/`9d685a6f`/`a3d2928c`/`6a33f016`
("add master architecture spec" / "add QA and release gates" / "add phase 0
foundation plan" / "add execution index") — verified via
`git log --oneline -- <files>` — which predate this phase's own commit range
(`8735d69a..f29bffac`) entirely; no Phase 3 commit touches any of these four
files. The trailing whitespace is Markdown's two-space hard-break syntax in
planning prose, pre-existing since Phase 0, unrelated to this phase's own
diff. Reported per the doctrine that a pre-existing, unrelated failure must
still be disclosed, not silently treated as blocking or silently omitted —
**not fixed here**, since fixing unrelated files is out of this task's scope
(`CLAUDE.md`: "não corrija automaticamente" for out-of-scope issues found
during a task). Not counted as a Step 5 failure for this gate because it is
outside this phase's own change set and the literal `git diff --check`
command (working tree) is what the brief's exact command list specifies.

### `test:unit` had to be restarted — real finding, not hidden

The first `pnpm test:unit` run was started, redirected to a log file, and
appeared to make no visible progress for an extended period. Direct
inspection (`Get-Process`/`Get-CimInstance Win32_Process`) showed the actual
`vitest.mjs` process's CPU time had gone flat (not increasing across a
9-minute re-check window) while the process itself was still alive — genuinely
stalled, not merely slow or output-buffered, on this loaded 8 GB host running
several other concurrent Node processes (two `next dev` servers, a Playwright
MCP process, Mem0/channel-messaging Docker containers). It was killed
(`Stop-Process -Id 2468,...`) and restarted fresh; the second run's CPU time
climbed normally and it completed in 983.93s with a clean 321/3278 pass. This
is recorded as a real environmental observation (resource contention on this
machine can stall a single-worker Vitest run), not swept under the rug — the
number reported above is from the successful, verified-progressing rerun, not
the stalled attempt.

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
Decision: GO (with one named, explicit gap — see Step 3)
Commit range: 8735d69a..f29bffac
Tests executed:
- pnpm vitest run workers/rag-indexer.test.ts -> 11/11 passed
- pnpm vitest run tests/unit/obsidian-export.test.ts tests/unit/knowledge-publication-golden.test.ts -> 21/21 passed
- pnpm vitest run lib/ai/rag/publication/publish-policy.test.ts -> 12/12 passed
- pnpm vitest run lib/ai/rag/ingestion/llamaindex-adapter.test.ts lib/ai/rag/ingestion/resolve-adapter.test.ts -> 24/24 passed
- pnpm typecheck -> pass
- pnpm lint -> pass (0 errors, 200 pre-existing warnings)
- pnpm lint:channels -> pass
- pnpm test:unit -> pass (321 files, 3278 tests; first attempt stalled and was restarted, see above)
- pnpm test:db -> pass (72 files, 480 passed + 1 skipped)
- pnpm ai:eval:local -> pass (30 cases, 0 duplicate ids, 0 P0 failures)
- pnpm build -> pass
- git diff --check (working tree) -> pass, clean
- git diff --check (branch vs main) -> 10 pre-existing whitespace findings in Phase-0 docs, unrelated to this phase, not blocking
Metrics:
- ai:eval:local baseline (Phase 2 gate): 25 cases, 0 P0 -> candidate (this gate): 30 cases, 0 P0
P0 open: 0
P1 open: 0
Residual P2:
- Step 3's export->upload->index path is proven in two halves, not one continuous automated run (architectural: a human bridges export and upload by design, per docs/runbooks/obsidian-knowledge.md)
- 200 pre-existing lint warnings, unrelated to this phase
- 10 pre-existing trailing-whitespace findings in Phase-0 planning docs, unrelated to this phase
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
