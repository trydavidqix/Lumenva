# Phase 2 (Mem0) — release gate

Date: 2026-08-13
Branch: `ai-platform-foundation`

## Decision

**HOLD at `OFF`.** Do not promote to `SHADOW` yet.

This plan's own default end-state is `SHADOW`, and every gate this document
can actually run is green (see below). But one required piece —
Step 2, comparing native context against Mem0 shadow retrieval on the
Golden Dataset — cannot be executed with real evidence right now, and this
gate does not promote on a step it could not run. See "What's still
blocked" for the exact, single reason and what unblocks it.

Everything that follows is what was actually run, with real results — not a
restatement of the plan's checklist as if it had already passed.

## Step 1 — provider OFF regression suite

`pnpm test:unit` and `pnpm test:db` both green with Mem0 at its default
(`OFF`, no `MEM0_BASE_URL`). Existing agent behavior is unaffected — the
whole platform runs exactly as it did before Phase 2 existed. See Step 5 for
the exact numbers from this run.

## Step 2 — SHADOW Golden Dataset comparison

**Not run — genuinely blocked, not skipped.**

`tests/fixtures/ai-platform/golden-cases.json` holds 25 case stubs (ids,
`organization_id`/`contact_id`, `query`, and an `expected` shape) but every
`input_events` is `[]` — the fixture was scaffolded in Phase 0 as a schema
contract for the *entire* 7-phase plan, not populated with content. About a
third of the 25 ids describe systems Phase 2 doesn't touch and Phases 3-7
haven't built yet (Graphiti, LlamaIndex, n8n, LangGraph) — those can't be
populated honestly until those phases exist.

For the ~13 ids that *are* Mem0/Phase-2-relevant, the property each one
names is already covered by a real, passing test — listed below so the
mapping is checkable, not asserted:

| Golden case | Property | Proven by |
|---|---|---|
| `preference-001` | basic retrieval + authority/recency ranking | `lib/agent-engine/context/fusion.test.ts` — "orders by authority, then recency and confidence" |
| `expired-memory-003` | expired memory never wins | `fusion.test.ts` — "drops an expired item and never lets it win over a live one" (new this session — see the fix below) |
| `consent-official-006`, `high-risk-017` | high-risk/consent facts never reach the prompt | `fusion.test.ts` — "excludes high-risk and protected authority facts from prompt context" |
| `secret-redaction-007` | `sk-`-style keys never get memorized | `lib/agent-engine/memory/sanitize.test.ts` — "an API-key-looking value" (literal `sk-proj-...` case) |
| `pii-redaction-008` | PII-shaped text rejected at extraction | `sanitize.test.ts` / `extract.test.ts` |
| `tenant-isolation-009` | one org's memory never reaches another | `mem0-client.test.ts` (namespace scoping) + `workers/memory-lifecycle.handler.test.ts` — "never wipes another org" + `workers/memory-projection.handler.test.ts` — "never accepts a source message returned from another organization" |
| `duplicate-event-010` | replaying the same source doesn't duplicate | `lib/agent-engine/memory/project-message.test.ts` — "replaying the same source id+version is idempotent" |
| `out-of-order-011` | a delayed event after a delete doesn't resurrect memory | `workers/memory-projection.handler.test.ts` — "a delayed event for an already-LGPD-redacted contact does not resurrect memory" (new this session) |
| `mem0-timeout-012` | Mem0 down degrades cleanly, doesn't break the turn | `lib/agent-engine/context/mem0-context-provider.test.ts` — "returns an empty degraded result when the provider times out" + `provider.test.ts` — "turns one provider failure into a degraded result without losing local context" |
| `lgpd-delete-018` | LGPD delete actually removes the namespace, and a rebuild never resurrects it | `tests/unit/mem0-lifecycle-replay-proof.test.ts` (new this session — see Step 4) |
| `mem0-replay-019` | replaying a delete event is idempotent | `memory-lifecycle.handler.test.ts` — "replaying the same delete event twice is idempotent" |
| `memory-injection-021` | prompt-injection text inside a memory can't escape its data fence | `fusion.test.ts` — "renders selected context as clearly delimited untrusted data" (literal `"Ignore all previous instructions."` case) |

Three ids remain genuinely unanswerable without a real LLM/embedding
provider key — the same blocker already surfaced earlier in this session,
not a new one:

- `preference-superseded-002` — detecting that a new statement invalidates
  an old, *differently-worded* one is a judgment call the extraction LLM
  makes; there is no code path to unit-test without a real model call.
- `official-crm-004`, `published-knowledge-005` — in the current
  architecture, official CRM state and the RAG knowledge base are not
  `ContextItem`s competing with memory through `fuseContext`; they're
  already in the prompt before semantic memory is appended. "CRM/knowledge
  outranks memory" is true by construction today, not by a ranking rule —
  worth a real test once/if that changes, not fabricable now.

**Update, same day**: a real `ANTHROPIC_API_KEY` was provided mid-review.
Rather than immediately populating the full 25-case fixture (a larger,
separate content-authoring effort — deferred by choice, not blocked), it was
used for a smaller, real, un-mocked check: 7 hand-picked scenarios covering
the properties above were run through the *actual* `extractMemoryCandidates`
against the live Anthropic API — the one thing the component tests above
cannot cover, since they all mock the model call.

This surfaced two real defects, both fixed and covered by new tests in the
same commit as this evidence:

1. **3 of 7 scenarios failed to parse.** The model wrapped its JSON in a
   ```` ```json ```` code fence despite the prompt saying "SOMENTE JSON
   estrito, sem markdown" — a prompt instruction is not a parser guarantee.
   `parseModelCandidates` now extracts the outermost `{...}` block first
   (the same technique `guardrails/jailbreak/classifier.ts` already uses for
   the same class of problem). Re-ran the previously-failing cases 3 more
   times each after the fix: 100% parse success.
2. **A CPF (Brazilian tax id) leaked into a stored candidate's free-text
   field** on the `pii-redaction-008` scenario — `sanitizeMemoryCandidate`
   had a pattern for 13-19 digit card numbers but nothing for an 11-digit
   CPF. Added a dedicated pattern; the same scenario now correctly returns
   zero candidates.

This is real, live evidence for 5 of the 13 already-covered rows above
(`preference-001`, `secret-redaction-007`, `pii-redaction-008`,
`high-risk-017`, plus the general "does the extraction pipeline work
end-to-end against a real model" question none of the mocked tests could
answer) — not a substitute for the formal 25-case run, but meaningfully more
than the mocked-only coverage this gate started with. `preference-superseded-002`
also got a first real signal: the model correctly extracted the *new*
preference as `actionable: true`; testing whether it also correctly retires
the *old* one requires the full two-message projection pipeline, not a
single extraction call, so it's still open.

**This is the one concrete thing standing between `OFF` and `SHADOW`**: the
full 25-case Golden Dataset run, formally, with the fixture actually
populated — not the smaller live check above. Key is available; the
remaining work is content-authoring + wiring the eval runner, not a new
blocker.

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
two only found once a real model was actually called:

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
   only found once a real model was called instead of a mock; see "Update,
   same day" above. (commit `a8f15b8e`)
4. **CPF leaked into stored memory text**, uncaught by the existing
   card-number-only redaction pattern — same commit as #3. (commit `a8f15b8e`)

## References

- Plan: [`../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md`](../../superpowers/plans/2026-08-10-ai-platform-phase-2-mem0.md)
- Task 9 evidence: commit `9d280a2f`
- Real-model extraction fixes: commit `a8f15b8e`
- Windows Docker validation: [`../../runbooks/mem0.md`](../../runbooks/mem0.md)
- Rebuild/lifecycle runbook: [`../../runbooks/mem0-rebuild.md`](../../runbooks/mem0-rebuild.md)
- Execution index: [`../../superpowers/plans/2026-08-10-ai-platform-execution-index.md`](../../superpowers/plans/2026-08-10-ai-platform-execution-index.md)
