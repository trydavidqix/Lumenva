# Phase 5 (External Guardrails) — Gap Analysis

Date: 2026-08-15
Branch: `ai-platform-foundation`
Task: `.superpowers/sdd/2026-08-10-ai-platform-phase-5-guardrails/task-1-brief.md`

## Decision

**NO EXTERNAL VALIDATOR NEEDED.** Provider stays `OFF`. Task 5 (deploying a
self-hosted Guardrails AI service) is skipped with this document as
evidence, per the plan's own instruction ("If gap report says no external
service is needed, skip this Task 5 with evidence referencing the gap
report; do not fabricate a use case"). Task 2 (the `ExternalGuardrailPort`
type/noop adapter) may still proceed if a later task wants the seam to
exist — this decision only blocks standing up an actual external validator
behind it.

This matches the plan's own Global Constraint ("Do not begin until a Phase
1–4 evaluation identifies a concrete gap worth solving") and the QA/release
gate doctrine (`docs/superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`
§8: "Fase 5 — GO somente se existir gap mensurável no Golden Dataset").

## Step 1 — Golden Dataset run against native gates

Run 2026-08-15, this branch, this Windows machine, worktree
`C:\Users\david\Desktop\Projetos\CRM-ai-platform-foundation`:

```
pnpm ai:eval:local
{"total":36,"duplicate_ids":0,"p0_failures":0,"status":"pass"}

pnpm test:unit
 Test Files  332 passed (332)
      Tests  3457 passed (3457)
   Start at  20:00:14
   Duration  889.07s (transform 9.03s, setup 110.41s, import 185.81s, tests 44.67s, environment 449.34s)
```

Both green, 0 failures, matching the Phase 4 gate's file count (332) with 7
more tests (3457 vs 3450) — consistent, no regression. `ai:eval:local` only
validates the golden fixture's schema/uniqueness (it never calls a model —
see `scripts/ai-platform-eval.ts`); the real proof that the fixture's
claims are true is the golden-dataset test suites wired into `test:unit`
(`tests/unit/knowledge-publication-golden.test.ts`,
`tests/unit/graph-context-golden.test.ts`,
`tests/unit/ai-platform-eval-langsmith.test.ts`,
`tests/unit/ai-platform-eval.test.ts`), which is why this report reads
those files directly rather than treating `ai:eval:local`'s pass alone as
sufficient signal. `ai:eval:live` (the real-Anthropic-API run) was **not**
run for this task — it costs money and calls a live third-party API on
every invocation, which the plan's own Global Constraint ("No remote paid
inference/model download without explicit approval") and this repo's
testing doctrine do not authorize by default; its most recent formal run is
already recorded in `docs/evidence/ai-platform/phase-2-mem0-gate.md` and is
treated as prior evidence below, not re-run here.

## Step 2 — Classify failures

**Zero real failures were found in this task's own run of Step 1.** There
is nothing to classify against the brief's per-case table (case id / native
gate / deterministic-fix rationale / candidate external validator /
false-positive risk / criticality) because no case failed.

Rather than stop at "tests are green" as the whole argument, this report
inspected what the exact class of thing an external validator would be
bought for — prompt injection, secret/PII leakage, output schema
enforcement — actually looks like in this codebase today, case by case,
citing the real test that proves each one:

| Risk category (the thing an external validator like Guardrails AI's `input-prompt-injection-check` / `output-secret-check` would target) | Native mechanism | Where it's proven |
|---|---|---|
| Prompt injection via lead message (direct jailbreak) | `lib/agent-engine/guardrails/jailbreak/classifier.ts` — an LLM-based advisory classifier (F4-04) purpose-built for this, correlated with out-of-table promise attempts to escalate to `agent_inbox_items` | golden case `memory-injection-021` (prior live run, `phase-2-mem0-gate.md`: PASS); classifier unit tests |
| Prompt injection via retrieved/stored content (indirect — knowledge doc, memory, graph fact) | Structural: retrieved text is handed to the model as a tool-result payload, never concatenated into a system/developer prompt; `promptSafeContextItems`/`fuseContext` gate what can ever influence a reply | `tests/unit/knowledge-publication-golden.test.ts` ("prompt injection inside document remains data, not instruction" — case `knowledge-injection-022`, PASS); `tests/unit/graph-context-golden.test.ts` ("graph contains prompt-like text but cannot alter policy" — case `graph-injection-inert-036`, PASS, asserts `promptBlock === ""` and does not contain the injected instruction) |
| Secret leakage into stored memory / retrieved knowledge | `lib/agent-engine/memory/sanitize.ts` (API keys, bearer/JWT, session/cookie, password, CVV, card number, CPF — reject-not-redact) and `lib/ai/rag/publication/sanitize.ts` (pre-ingestion gate, `scanPublishableKnowledge`) | golden cases `secret-redaction-007`, `pii-redaction-008` (prior live run: PASS); `tests/unit/knowledge-publication-golden.test.ts` ("secret-containing document is blocked pre-ingestion" — case `knowledge-secret-blocked-030`, PASS); `tests/unit/ai-platform-eval-langsmith.test.ts` (deterministic evaluator explicitly scores a leaked `sk-` value and a cross-tenant tag as failures) |
| Internal system vocabulary leaking to the customer (tool names, table/column names, access roles, raw errors) | `lib/agent-engine/guardrails/vazamento-interno.ts` — deterministic detector, calibrated against a 102-phrase real Brazilian-support corpus across 5 niches, with documented false-positive/negative trade-offs and a frozen calibration test | `tests/unit/vazamento-interno-detector.test.ts`; wired into `before-send.ts`'s `internalVocabularyGate` |
| Free-text commercial promise the structured `promiseGate` regex can't catch | `lib/agent-engine/guardrails/promise/semantic.ts` — cheap LLM classifier (F4-02), fail-open on parse failure (never blocks a send on its own malfunction) | wired into `before-send.ts`'s `semanticPromiseGate`; `promise/semantic.test.ts` |
| Human-handoff hallucination (promising a human without an open case) | `lib/agent-engine/guardrails/human-promise.ts` — deterministic PT-BR regex detector, conservative by design (documented trade-off: prefers false-negative over false-positive, with a fail-safe that auto-opens a case on repeat) | `tests/invariants/case-promise-detector.test.ts`; wired into `before-send.ts`'s `casePromiseGate` |
| Authority conflicts (Mem0 preference vs. PUBLISHED knowledge policy, graph fact vs. CRM official stage) | `fuseContext`'s authority-domain ranking; `PROMPT_BLOCKED_DOMAINS` hardcodes `commercial_status` as never prompt-eligible regardless of confidence | `tests/unit/knowledge-publication-golden.test.ts` ("Mem0 preference cannot override PUBLISHED policy" — case `knowledge-mem0-vs-policy-029`, PASS); `tests/unit/graph-context-golden.test.ts` ("graph contradicts CRM official stage" — case `graph-contradicts-crm-034`, PASS, even at `confidence: 0.99`) |
| Tenant isolation of retrieved context | Namespace/query scoping at three independent layers (namespace derivation, read path, write path) | `tests/unit/graph-context-golden.test.ts` ("same names across two orgs remain isolated" — case `graph-tenant-isolation-035`, PASS); `lib/agent-engine/graph/namespace.test.ts` |
| STOP/opt-out, LGPD anonymization/legal-basis, anti-ban, messaging-window, disclosure | `before-send.ts`'s `stopGate`/`lgpdGate`/`pacingGate`/`messagingWindowGate`/`disclosureGate` — irrevocable, ordered, version-locked (`BEFORE_SEND_CHAIN_VERSION`) | `tests/unit/before-send-chain-shape.test.ts`; per-gate unit tests |

No row in this table represents an open, unaddressed gap. Every category an
external semantic/ML validator would plausibly be bought to cover already
has either (a) a deterministic detector calibrated against a real corpus
with a documented, measured false-positive rate, or (b) a cheap
purpose-built LLM classifier already wired into the native pipeline
(advisory for jailbreak, blocking for semantic promise) — not a
hypothetical "we could add a classifier later."

### Findings that are real but are not before-send guardrail gaps (out of scope for this decision, noted for completeness)

Two genuine issues are on record from prior phase gates. Both were
evaluated against this task's question — "does this justify an external
*guardrail* around `before_send`?" — and neither does:

1. **`docs/evidence/ai-platform/phase-2-mem0-gate.md`**: `high-risk-017`
   showed a ~50% flake rate from the extraction model occasionally
   wrapping JSON in a markdown fence (since mitigated with tolerant
   parsing) — an **extraction-quality** reliability issue in the Mem0
   candidate pipeline, not a guardrail the customer-facing `before_send`
   chain is missing. An external validator sitting in front of
   `runBeforeSend` would not touch this; it lives upstream, in memory
   extraction.
2. **`phase-2-mem0-gate.md`/`phase-4-graphiti-gate.md`**: both
   `Mem0ContextProvider` and `GraphitiContextProvider` are fully
   implemented and tested but not yet wired into the production
   `InboundTurnDeps` construction path — a **deployment-wiring** gap, not
   a safety/guardrail gap, and already tracked as its own follow-up in
   those gate documents.

Neither belongs on the Step 2 classification table because neither is a
case where a message reached (or nearly reached) a customer that a native
`before_send` gate should have caught and didn't.

## Step 3 — Decision

All target risk categories a Guardrails-AI-style external validator would
address are already covered by native code, and every one of Step 1's runs
is green with zero real failures. Per the plan's Global Constraint and the
QA/release gate doctrine's Phase 5 condition ("GO somente se existir gap
mensurável no Golden Dataset"), there is no measured gap to justify
installing an external validation layer.

**`NO EXTERNAL VALIDATOR NEEDED`. Provider stays `OFF`.**

Consequences for the rest of this plan:

- **Task 2** (add `ExternalGuardrailPort` + `NoopExternalGuardrailPort`)
  may still proceed if a future task wants the seam to exist — the plan
  text allows this ("The architecture task can still add the port, but do
  not deploy a redundant Python service").
- **Task 3** (data minimization for external calls) has no live caller to
  minimize data for yet; if Task 2 proceeds, its sanitizer should still
  reuse `lib/agent-engine/memory/sanitize.ts`'s existing deterministic
  patterns per its own instruction, not diverge.
- **Task 4** (Guardrails AI REST adapter) — nothing to adapt to; no
  concrete external provider was selected because no gap calls for one.
  Skip unless a future gap report reopens this decision.
- **Task 5** (self-hosted Guardrails AI Docker service) — **skip**, citing
  this document, per the plan's own instruction not to deploy a redundant
  Python service.
- **Task 6** (integrate external validation around native gates) — nothing
  to integrate. Native `before_send` remains the sole authority, unchanged.
- **Task 7** (false-positive/outage evaluation for a selected validator) —
  not applicable; no validator was selected.
- **Task 8** (Phase 5 release gate) — should record `GO WITHOUT EXTERNAL
  ACTIVATION`, consistent with the plan's own text calling that "an
  acceptable successful outcome," citing this document as the gap report
  that produced it.

This decision is revisitable: if a future Golden Dataset run, live
production incident, or `ai:eval:live` finding surfaces a real case where a
message reached (or nearly reached) a customer that no native gate caught
and that cannot reasonably be closed with a deterministic rule or a cheap
purpose-built classifier (the same pattern `jailbreak/classifier.ts` and
`promise/semantic.ts` already use), that finding should reopen this
decision with its own Step 2 entry — not by amending this report's "zero
failures" claim, but by a new evaluation superseding it.

## References

- Plan: [`../../superpowers/plans/2026-08-10-ai-platform-phase-5-guardrails.md`](../../superpowers/plans/2026-08-10-ai-platform-phase-5-guardrails.md)
- Task brief: `.superpowers/sdd/2026-08-10-ai-platform-phase-5-guardrails/task-1-brief.md`
- QA/release gate doctrine: [`../../superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`](../../superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md)
- Native guardrail chain: `lib/agent-engine/guardrails/before-send.ts`
- Prior live Golden Dataset run (secret/PII/injection/consent cases):
  [`phase-2-mem0-gate.md`](phase-2-mem0-gate.md)
- Prior gates: [`phase-0-gate.md`](phase-0-gate.md), [`phase-1-gate.md`](phase-1-gate.md), [`phase-3-knowledge-gate.md`](phase-3-knowledge-gate.md), [`phase-4-graphiti-gate.md`](phase-4-graphiti-gate.md)
