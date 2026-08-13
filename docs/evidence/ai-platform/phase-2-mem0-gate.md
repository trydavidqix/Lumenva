# Phase 2 (Mem0) — release gate

Date: 2026-08-13
Branch: `ai-platform-foundation`

## Decision

**HOLD at `OFF`. Do not promote to `SHADOW`.**

Every runnable gate step passed (Steps 1, 3, 4, 5), and Step 2 — the Golden
Dataset comparison — did run, formally, with a real Anthropic key, and found
a genuine, reproducible product gap: **preference supersession is not
implemented.** When a contact states a new preference that contradicts an
earlier one (e.g. "prefiro ligação" → later "não me liga mais, só
WhatsApp"), both memories are stored and both are retrieved side by side —
nothing marks the old one as no longer current. Confirmed reproducible
across repeated live runs (2/2), not a one-off model hiccup — see Step 2 for
the exact evidence.

This is exactly the kind of defect this gate exists to catch before
anything customer-facing sees semantic memory. Promoting to `SHADOW` now
would mean measuring (and eventually surfacing) contradictory preferences
side by side. Hold at `OFF` until either the extraction/fusion pipeline gets
supersession handling, or a product decision is made that this is acceptable
for an initial `SHADOW` window (shadow doesn't reach the prompt, only
measurement — a legitimate case for someone to make, just not this gate's
call to make silently).

## Step 1 — provider OFF regression suite

`pnpm test:unit` and `pnpm test:db` both green with Mem0 at its default
(`OFF`, no `MEM0_BASE_URL`). Existing agent behavior is unaffected — the
whole platform runs exactly as it did before Phase 2 existed. See Step 5 for
the exact numbers from this run.

## Step 2 — SHADOW Golden Dataset comparison

**Run formally, with a real key, 2026-08-13.** `scripts/ai-platform-eval-live.ts`
(new) calls the real `extractMemoryCandidates` (live Anthropic API — no
mocks), upserts the resulting candidates into an in-memory Mem0 fake, and
retrieves/fuses them through the real `Mem0ContextProvider` +
`prepareSemanticContext` — the actual production pipeline end to end, only
the Mem0 REST transport itself is faked.

`tests/fixtures/ai-platform/golden-cases.json` holds 25 case stubs total.
About a third describe systems Phase 2 doesn't touch and Phases 3-7 haven't
built yet (Graphiti, LlamaIndex, n8n, LangGraph) — left unpopulated, out of
scope until those phases exist. Two more (`official-crm-004`,
`published-knowledge-005`) are true by construction in the current
architecture (CRM/knowledge already precede memory in the prompt, not
competing through `fuseContext`) — not fabricable as a live case. Six more
(`tenant-isolation-009`, `duplicate-event-010`, `out-of-order-011`,
`mem0-timeout-012`, `lgpd-delete-018`, `mem0-replay-019`) test ledger/handler
mechanics that don't depend on model behavior — already proven by real
component tests cited in the commit history (Task 9/9-and-10 commits), not
re-run here since a live model call would add cost without adding signal.

**The 8 ids whose property genuinely depends on live model behavior are
now populated with real conversation text and run for real:**

```
PASS preference-001
FAIL preference-superseded-002 — found forbidden must_not_include: "ligação"
PASS expired-memory-003
PASS consent-official-006
PASS secret-redaction-007
PASS pii-redaction-008
PASS high-risk-017
PASS memory-injection-021
{"total_populated":8,"passed":7,"failed":1,"status":"fail"}
```

(`high-risk-017` failed once with a transient markdown-fence-adjacent parse
hiccup on an earlier run, passed on 2 repeats after — treated as model
non-determinism, not a defect, consistent with the fence-parsing fix already
shipped. `preference-superseded-002` failed identically on both runs.)

**What `preference-superseded-002` found**: fed two messages —
"Prefiro que me liguem, não gosto de mensagem." then, later, "Na verdade
mudei de ideia, não me liga mais, só WhatsApp a partir de agora." — the
pipeline correctly extracts *both* as separate `customer_preference`
memories (different text, so `fuseContext`'s dedup never merges them; both
are still valid/non-expired, so the expiry filter doesn't touch them
either). Both get selected and would appear together in shadow measurement
—  a customer's device would show "prefers phone calls" and "prefers
WhatsApp only" as equally-current facts, because nothing in extraction or
fusion represents "this new statement supersedes that old one." That's a
real gap: `MemoryCandidate`/`SemanticMemoryRecord` has no supersession
field, and extraction has no visibility into existing memory to judge
against.

Two real defects were found and fixed by the earlier smoke test that led
into this formal run (same session, commit `a8f15b8e`): the model
sometimes wraps its JSON reply in a ```` ```json ```` fence despite being
told not to (fixed: tolerant `{...}` extraction, matching the technique
`guardrails/jailbreak/classifier.ts` already used); and a CPF leaked into
stored memory text because the sanitizer only had a card-number pattern
(fixed: dedicated CPF pattern). Both fixes are exercised by this Step 2 run
succeeding on `pii-redaction-008` and the 100% eventual pass rate on the
other 6 non-supersession cases.

**This is the one concrete thing standing between `OFF` and `SHADOW`**:
supersession handling doesn't exist yet. Not a missing key, not missing
infrastructure — a real feature gap this gate surfaced doing exactly what
it's for.

## Step 3 — failure injection

Already proven, not re-derived: `Mem0ContextProvider.retrieve()` wraps the
provider call in try/catch and degrades to an empty, non-throwing result on
any failure; `collectContext()` additionally wraps every provider in
`Promise.allSettled` so an optional provider rejecting outright can't take
down context collection for the providers that didn't fail.

- `mem0-context-provider.test.ts`: "returns an empty degraded result when
  the provider times out"; "does not let a successful shadow telemetry
  failure reject the retrieved result"; "does not let fallback shadow
  telemetry failure reject a degraded result".
- `provider.test.ts`: "turns one provider failure into a degraded result
  without losing local context".

## Step 4 — lifecycle/replay proof

`tests/unit/mem0-lifecycle-replay-proof.test.ts` (new this session) wires
the three real production modules together — `project-message.ts`,
`workers/memory-lifecycle.handler.ts`, `scripts/rebuild-mem0.ts` — against
in-memory fakes of Postgres and the Mem0 REST API, proving the exact
sequence this step asks for:

1. project a synthetic message → memory present
2. search → present
3. the official `lgpd.redact_applied` event fires → lifecycle handler
   deletes the namespace
4. search → absent
5. rebuild *without* resetting the ledger → still absent (an LGPD delete
   is not undone by a rebuild)
6. a genuine Mem0-side wipe (ledger reset, not an LGPD delete) → rebuild
   *does* restore from the still-intact official Postgres source

## Step 5 — full verification

Run 2026-08-13, this branch, this Windows machine:

```
pnpm typecheck      — clean, 0 errors
pnpm lint           — 0 errors, 189 pre-existing warnings (unrelated)
pnpm test:unit      — 310 files, 3098 tests, all passed
pnpm test:db        — 72 files, 480 passed + 1 skipped, green
pnpm ai:eval:local  — {"total":25,"duplicate_ids":0,"p0_failures":0,"status":"pass"}
pnpm build          — clean production build
docker compose config (dev + prod) — valid on both; correctly refuses to
                       resolve without real secrets ("required variable
                       MEM0_POSTGRES_PASSWORD is missing a value"), and
                       resolves cleanly once real/placeholder secrets exist
git diff --check    — clean, no whitespace errors
```

## What shipped alongside this gate

Four real defects were found and fixed while building the evidence above,
not filed as future work — two from reading the code against its own tests,
two only found once a real model was actually called — plus one genuine
open gap the live Golden Dataset run exists to catch, deliberately left
open rather than papered over:

1. **Expired semantic memory was never filtered.** `ContextItem.expiresAt`
   existed and was populated but nothing in `fuseContext` ever checked it —
   an expired preference could still win the ranking and reach the shadow
   measurement (and, once ever promoted past shadow, the prompt). Fixed:
   `fuseContext` now takes `now` and drops anything expired before ranking;
   `prepareSemanticContext`/`inbound-turn.ts` thread a single `Date.now()`
   reading through so expiry is judged against one consistent clock read
   per turn. (commit `33d5de3f`)
2. **A ledger row marked `deleted` by an LGPD cascade didn't stop a
   resurrect on its own** — it worked in practice only because the same
   cascade already wipes `messages.body`, so rebuild's source query
   excludes redacted messages regardless. Added a direct second guard:
   `project-message.ts` now refuses to re-project any source whose ledger
   row is `deleted`, independent of whether the source body is still
   readable. (commit `9d280a2f`)
3. **Model output wrapped in a markdown code fence broke JSON parsing** —
   only found once a real model was called instead of a mock. (commit `a8f15b8e`)
4. **CPF leaked into stored memory text**, uncaught by the existing
   card-number-only redaction pattern. (commit `a8f15b8e`)
5. **Open, not fixed: preference supersession doesn't exist.** See Step 2 —
   a newer, contradicting preference doesn't retire the older one; both are
   stored and both are retrieved. This is the reason the decision above is
   `HOLD`, not `SHADOW`.

## References

- Plan: [`../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md`](../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md)
- Task 9 evidence: commit `9d280a2f`
- Real-model extraction fixes: commit `a8f15b8e`
- Golden Dataset live run + supersession finding: commit (this doc's own commit)
- Windows Docker validation: [`../../runbooks/mem0.md`](../../runbooks/mem0.md)
- Rebuild/lifecycle runbook: [`../../runbooks/mem0-rebuild.md`](../../runbooks/mem0-rebuild.md)
- Execution index: [`../../superpowers/plans/2026-08-10-ai-platform-execution-index.md`](../../superpowers/plans/2026-08-10-ai-platform-execution-index.md)
