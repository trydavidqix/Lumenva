# Implementação Tokens — Inline Autonomous Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. This plan is explicitly for **inline execution without subagents**. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete `implementacao-tokens` master plan on branch `implementacao-tokens`, converging the current CRM runtime with selected Agent OS modules, then adding structured Customer Memory, free-first model routing, autonomous multimodal WhatsApp, voice, Telnyx/LiveKit telephony, caller recognition, commercial tools, ETA, human transfer, media generation, SaaS hardening, control-plane UI, evals/security and continuous optimization — without merging to `main`.

**Architecture:** `main`/current CRM remains the operational foundation and source of truth. Agent OS is integrated as governance/orchestration around the existing runtime instead of replacing the WhatsApp/multimodal path. All new capability enters through tenant-scoped ports, deterministic policy, the canonical Tool Gateway and the canonical LLM seam (`lib/agent-engine/edge/llm/run-model-call.ts`).

**Tech Stack:** Next.js 16.3, React 19, TypeScript 6, Node >=22, pnpm 9, Supabase/Postgres/RLS, AI SDK 7, WAHA/Meta channel abstraction, pg, Zod 4, Vitest 4, Playwright, Sentry, LangGraph where already justified, Telnyx + LiveKit for managed telephony.

**Spec:** `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`

## Global Constraints

- Work only on branch `implementacao-tokens`.
- Do not merge, rebase or push this implementation into `main` without a new explicit user authorization.
- Do not bulk-merge Agent OS branches. Reuse files/contracts selectively after comparing them against current CRM code.
- Preserve the proven WhatsApp multimodal runtime and its storage/derivation/send path.
- Preserve multi-tenant isolation: every tenant-aware record is organization-scoped and RLS-protected; service-role queries manually filter `organization_id`.
- Preserve deterministic security, approval, escalation, idempotency and observability boundaries.
- Postgres/CRM remains authoritative business state. Memory is derived context and never authorizes business facts by itself.
- No model may invent price, availability, ETA, order status or other authoritative business data.
- The canonical LLM seam is `lib/agent-engine/edge/llm/run-model-call.ts`; do not introduce a competing provider runtime.
- Prefer free/lowest-cost compatible models, but capability, policy, privacy and availability constraints outrank cost.
- Never rely on a free provider without configured fallback.
- Keep media-generation paths outside the critical customer-support path.
- Every phase closes only with fresh executable evidence on the exact branch state.
- Every schema/RLS change must include tenant-isolation tests, including Org A allowed / Org B denied cases.
- Every externally visible side effect must be behind Tool Gateway + deterministic policy + idempotency.
- Continue inline from task to task without asking for routine approval. Stop only for a real external blocker that cannot be solved in code (for example missing required credential, provider account verification, billing/number purchase, or a repeatedly failing verification whose correct resolution cannot be inferred safely).
- Commit small, reviewable increments on `implementacao-tokens`; keep documentation/evidence current.

---

# Execution Doctrine

1. Start every task by verifying `git branch --show-current` is `implementacao-tokens` and the working tree contains only expected changes.
2. Use TDD for new contracts: failing focused test -> minimal implementation -> focused green -> regression gate.
3. Before porting a file from an Agent OS branch, compare it with current `main`/`implementacao-tokens` equivalents and port only the missing invariant.
4. After each task, update the implementation-status document and commit the task.
5. After each phase, run the phase gate plus `pnpm typecheck` and relevant regression suites. Run `pnpm build` for phase closure.
6. Never mark a phase complete based on historical Agent OS evidence alone; historical evidence is input, not proof for the converged branch.

# Status/Evidence Files

Create and maintain throughout execution:

- `docs/implementation/implementacao-tokens-status.md` — live phase/task status, blockers, SHAs and next step.
- `docs/evidence/implementacao-tokens/phase-01.md` through `phase-15.md` — fresh branch-local executable evidence.
- `docs/architecture/implementacao-tokens.md` — canonical converged architecture and invariants.

---

## Phase 1 — CRM + Agent OS convergence

### Task 1: Freeze the convergence baseline and branch map

**Files:**
- Create: `docs/implementation/implementacao-tokens-status.md`
- Create: `docs/architecture/implementacao-tokens.md`
- Create: `docs/evidence/implementacao-tokens/phase-01.md`

**Consumes:** current `implementacao-tokens`; `main`; Agent OS branches `agent-os-phase-3-product-agents`, `agent-os-phase-4-shadow-evals`, `agent-os-phase-5-assisted-autonomy`, `agent-os-phase-6-learning-flywheel`, `agent-os-phase-7-durable-benchmark`.

**Produces:** exact module-source matrix and convergence rules used by every later task.

- [ ] Record exact SHAs for `implementacao-tokens`, `main` and relevant Agent OS branches.
- [ ] Record per-module source-of-truth decision: current CRM runtime wins for channel/multimodal/memory/LLM seam/escalation; Agent OS branches are candidates for kernel/product-agent/policy/eval contracts.
- [ ] Record known migration-number collisions, especially the divergent `0123` migrations.
- [ ] Run baseline gates: `pnpm typecheck`, `pnpm test:unit`, `pnpm lint:channels`, `pnpm lint:tenant-filter`.
- [ ] Store command outputs/results in `phase-01.md`.
- [ ] Commit: `docs(tokens): freeze convergence baseline`.

### Task 2: Port canonical Agent OS contracts without runtime replacement

**Files:**
- Create/port selectively: `lib/agent-engine/contracts/agent-os.ts`
- Create focused tests under `lib/agent-engine/contracts/` or `tests/unit/`
- Do not replace: `lib/agent-engine/agent/inbound-turn.ts`

**Produces:** canonical run states, autonomy levels, loop budgets, progress/repetition guards, tool-risk types and `ExecutionPort` contracts.

- [ ] Write focused tests proving terminal-state transitions, token/cost/runtime ceilings, repeated-tool/no-progress termination and R4 non-autonomy.
- [ ] Verify RED on the converged branch for missing contracts.
- [ ] Port/adapt the minimum contracts from Agent OS branches to current repo conventions.
- [ ] Run focused tests GREEN.
- [ ] Run `pnpm typecheck` and agent-engine regression tests.
- [ ] Document which Agent OS source SHA each contract came from.
- [ ] Commit: `feat(agent-os): add converged runtime contracts`.

### Task 3: Port Agent Kernel as governance around current runtime

**Files:**
- Create/port selectively: `lib/agent-engine/kernel/contracts.ts`, `ports.ts`, `resolution.ts`, `context-loader.ts`, `composition.ts`, `runtime-adapter.ts`, `agent-kernel.ts`
- Modify adapter seams only where required; do not fork `inbound-turn.ts`.
- Test: Agent Kernel contract/integration tests.

**Produces:** one canonical Kernel that resolves tenant/agent/version, applies loop/policy gates, delegates provider work through existing `runModelCall`, and never creates a second customer-send path.

- [ ] Port Kernel tests from the Phase 2/3 Agent OS line and adapt imports to current CRM.
- [ ] Add a convergence test proving the Kernel can wrap/delegate the existing runtime ports without provider SDK imports.
- [ ] Add fail-closed tests for tenant mismatch, disabled agent, unknown version and malformed model output.
- [ ] Implement the smallest adapters necessary.
- [ ] Verify `send_message` still routes through the existing channel path only.
- [ ] Run focused Kernel suite, `pnpm typecheck`, and WhatsApp-related unit regressions.
- [ ] Commit: `feat(agent-os): converge canonical kernel with crm runtime`.

### Task 4: Port Product Agents as governed definitions

**Files:**
- Create/port selectively: `lib/agent-engine/product-agents/{contracts,definitions,resolver,supervisor,atendimento,sales,retention,escalation,crm-operator,governance-judge,verification,golden-cases,index}.ts`
- Test: corresponding `tests/unit/agent-product-*.test.ts`.

**Produces:** seven versioned roles operating through Kernel contracts, initially SHADOW/DRAFT-safe.

- [ ] Port the Phase 3 product-agent golden cases and role validators.
- [ ] Prove every role is provider-agnostic and cannot bypass Tool Gateway.
- [ ] Bind `escalation` to the current CRM human-handoff/case model instead of introducing a parallel state machine.
- [ ] Bind `crm_operator` to proposal/tool contracts, never direct DB writes.
- [ ] Run all product-agent focused suites plus Kernel regression.
- [ ] Commit: `feat(agent-os): add governed product agent roles`.

### Task 5: Converge Policy, Approval, Autonomy and Tool Gateway

**Files:**
- Create/port selectively: `lib/agent-engine/policies/{engine,approval,autonomy,runtime-controls}.ts`
- Create/port selectively: `lib/agent-engine/tools/{registry,gateway}.ts`
- Modify: `lib/agent-engine/edge/crm/mcp-tools.ts` only to route through canonical gateway where missing.
- Test: policy, approval, autonomy, tool-gateway, idempotency tests.

**Produces:** deterministic `allow | deny | require_approval`, kill switches, risk model R0-R4, stable idempotency identities, no MCP bypass.

- [ ] Add RED tests for R4 denial, R3 approval, runtime kill switch, duplicate side-effect suppression and cross-tenant tool invocation.
- [ ] Port/adapt the Phase 5 implementation into current CRM patterns.
- [ ] Ensure existing guardrails remain active; remove no existing safety layer unless an equivalent canonical control is proven by tests.
- [ ] Run focused policy/tool tests and `pnpm lint:tenant-filter`.
- [ ] Commit: `feat(agent-os): converge policy autonomy and tool gateway`.

### Task 6: Port Shadow/Evals foundation

**Files:**
- Create/port selectively: `lib/agent-engine/evals/**`
- Test: `tests/unit/agent-evals-*.test.ts`

**Produces:** shadow runner, deterministic assertions, adversarial datasets, quality-judge boundary, historical read-only replay interface.

- [ ] Port Phase 4 eval contracts/datasets/runner/assertions/metrics/divergence with current CRM types.
- [ ] Keep historical production-evidence gates explicitly separate from synthetic/local gates.
- [ ] Prove SHADOW executes zero customer-visible or CRM-authoritative side effects.
- [ ] Run focused eval tests.
- [ ] Commit: `feat(agent-os): add converged shadow eval harness`.

### Task 7: Phase 1 regression closure

- [ ] Run `pnpm gov:verify`.
- [ ] Run relevant multimodal/channel unit suites and `pnpm lint:channels`.
- [ ] Run escalation/handoff invariants.
- [ ] Run `pnpm build`.
- [ ] If schema was touched, run `pnpm test:db` and `pnpm test:invariants`.
- [ ] Record exact SHA and results in `docs/evidence/implementacao-tokens/phase-01.md`.
- [ ] Mark Phase 1 complete only if the existing WhatsApp/multimodal/handoff paths remain green.
- [ ] Commit: `docs(tokens): close phase 1 convergence evidence`.

---

## Phase 2 — Customer Memory Layer

### Task 8: Define Customer Memory contracts and authority model

**Files:**
- Create: `lib/agent-engine/customer-memory/types.ts`
- Create: `lib/agent-engine/customer-memory/authority.ts`
- Test: `lib/agent-engine/customer-memory/*.test.ts`

**Produces:** structured quick-memory schema: identity refs, phones, addresses, preferences, habitual order, recent-order refs, relationship summary, channel facts, important events, confidence/source/validity metadata.

- [ ] Write Zod schema and authority tests first.
- [ ] Explicitly separate mutable fields (address, phone, operational preferences) from authoritative CRM/order data.
- [ ] Make conflicting/unconfirmed fields non-actionable until confirmed.
- [ ] Reuse semantic-memory source/confidence/risk semantics from current `lib/agent-engine/memory/**`.
- [ ] Commit: `feat(memory): define structured customer memory contracts`.

### Task 9: Persist tenant-scoped quick memory safely

**Files:**
- Create a new uniquely timestamped Supabase migration; do not reuse collided Agent OS migration numbers.
- Modify: `supabase/migrations/MANIFEST.md`
- Create repository: `lib/agent-engine/customer-memory/repository.ts`
- Test: DB/RLS + repository tests.

**Produces:** organization-scoped memory projection tables/columns and audit trail with RLS.

- [ ] Add Org A/Org B RLS tests before implementation.
- [ ] Add unique/dedup constraints suitable for customer identity and memory projection.
- [ ] Add audit metadata for automatic writes and supersession.
- [ ] Use service-role queries only with explicit organization filter.
- [ ] Run `pnpm test:db`, `pnpm test:invariants`, `pnpm lint:tenant-filter`.
- [ ] Commit: `feat(memory): persist tenant scoped customer memory`.

### Task 10: Build compact prompt projection and on-demand history tools

**Files:**
- Create: `lib/agent-engine/customer-memory/render.ts`
- Create: `lib/agent-engine/customer-memory/history-tools.ts`
- Modify carefully: context fusion/loader and `inbound-turn.ts` integration points.

**Produces:** quick memory always available in bounded form; expensive raw history fetched only through governed tools.

- [ ] Write token-budget tests proving the quick-memory block remains bounded.
- [ ] Add tool for detailed history/order/memory lookup under R0 read policy.
- [ ] Ensure tool results are pruned by existing tool-result budget logic.
- [ ] Measure token count before/after on representative fixtures.
- [ ] Commit: `feat(memory): add compact customer context and lazy history`.

### Task 11: Update memory after interactions with conflict handling

- [ ] Wire post-turn projection to existing extraction/sanitization infrastructure.
- [ ] Add tests for changed address, contradictory preference, duplicate contact and low-confidence extraction.
- [ ] Never update authoritative order/payment/consent state from semantic memory.
- [ ] Record automated change audit entries.
- [ ] Run memory + agent-turn regressions.
- [ ] Commit: `feat(memory): update customer memory with conflict controls`.

### Task 12: Phase 2 closure

- [ ] Run focused memory tests, `pnpm gov:verify`, `pnpm test:db`, `pnpm build`.
- [ ] Record before/after prompt-token measurements and tenant-isolation evidence in `phase-02.md`.
- [ ] Commit evidence/status.

---

## Phase 3 — Free-first Model Router

### Task 13: Define capability/cost/availability router contracts

**Files:**
- Create: `lib/agent-engine/edge/llm/router/{types,scoring,fallback,circuit-breaker}.ts`
- Extend existing model/provider configuration storage through a new migration only if current schema cannot express required metadata.

**Produces:** required capabilities, privacy policy, quality tier, free/paid cost class, context ceiling, latency, health, rate-limit state and explicit fallback chain.

- [ ] Write deterministic routing tests for simple text, complex reasoning, vision, unavailable free provider, rate limit and all-free-down cases.
- [ ] Ensure cost never overrides missing capability or policy constraints.
- [ ] Commit: `feat(router): define free first routing contracts`.

### Task 14: Integrate router into canonical `runModelCall` seam

**Files:**
- Modify: `lib/agent-engine/edge/llm/run-model-call.ts`
- Modify: provider registry only as required for approved new provider adapters.

**Produces:** every model call can select a route from tenant policy and purpose, with explicit observable fallback.

- [ ] Keep direct `input.model`/published-agent override semantics backward compatible.
- [ ] Add explicit provider-failure/fallback events; never silently switch provider.
- [ ] Persist selected route, fallback attempts, tokens, cost and latency.
- [ ] Add circuit breaker and rate-limit awareness.
- [ ] Run no-network fake-registry tests plus existing LLM seam tests.
- [ ] Commit: `feat(router): wire free first routing into llm seam`.

### Task 15: Add provider adapters only behind the canonical registry

- [ ] Add OpenRouter/free-router and other approved provider adapters behind `ProviderRegistry`, with egress allowlists and tenant credentials/config.
- [ ] Do not hard-code unstable free model IDs in runtime source; keep catalog/config data-driven.
- [ ] Add health/capability certification tests.
- [ ] Commit: `feat(router): add certified provider adapters`.

### Task 16: Phase 3 closure

- [ ] Run router fallback/circuit-breaker tests, `pnpm gov:verify`, `pnpm build`.
- [ ] Simulate primary-free outage and prove fallback succeeds without duplicate side effects.
- [ ] Record model-selection/cost evidence in `phase-03.md`.

---

## Phase 4 — Autonomous WhatsApp 24/7

### Task 17: Connect inbound WhatsApp to identity -> memory -> Kernel

- [ ] Add integration tests for text, image, audio, video, PDF and sticker turns.
- [ ] Resolve organization from trusted channel/session mapping.
- [ ] Resolve contact/customer by normalized phone within the organization.
- [ ] Load compact Customer Memory before model work.
- [ ] Route decision through Kernel/policy/tools and existing multimodal derivation.
- [ ] Preserve current WAHA/Meta send semantics.
- [ ] Commit: `feat(whatsapp): route multimodal turns through customer memory and kernel`.

### Task 18: Add 24/7 resilience and continuity

- [ ] Test free-provider outage, tool failure, malformed media, long video and low-confidence understanding.
- [ ] Escalate/ask confirmation instead of inventing business facts.
- [ ] Preserve conversation continuity after worker retries/restarts.
- [ ] Record per-turn cost/token/provider/fallback.
- [ ] Commit: `feat(whatsapp): harden autonomous runtime resilience`.

### Task 19: Phase 4 closure

- [ ] Run focused multimodal unit tests and available Playwright journeys.
- [ ] Run `pnpm gov:verify` and `pnpm build`.
- [ ] Record no-regression evidence in `phase-04.md`.

---

## Phase 5 — Voice AI before PSTN

### Task 20: Introduce voice ports

**Files:**
- Create: `lib/voice/contracts.ts`, `lib/voice/stt/**`, `lib/voice/tts/**`, `lib/voice/session/**`.

**Produces:** provider-agnostic STT/TTS/session contracts sharing Kernel + Customer Memory.

- [ ] Define streaming transcription, partial/final transcript, confidence, interruption/barge-in and synthesis contracts.
- [ ] Implement self-hosted adapters first where quality is acceptable; keep managed adapters replaceable.
- [ ] Add deterministic tests with audio fixtures and fake providers.
- [ ] Commit: `feat(voice): add provider agnostic voice pipeline`.

### Task 21: Build local realtime voice loop

- [ ] Wire STT -> Kernel -> routed LLM -> TTS.
- [ ] Add silence detection, cancellation/barge-in, number/name/address confirmation and low-confidence repetition.
- [ ] Share Customer Memory with WhatsApp.
- [ ] Track end-to-end voice latency.
- [ ] Commit: `feat(voice): add local realtime agent loop`.

### Task 22: Phase 5 closure

- [ ] Run voice unit/integration fixtures, `pnpm gov:verify`, `pnpm build`.
- [ ] Record latency and confidence behavior in `phase-05.md`.

---

## Phase 6 — Managed telephony with Telnyx + LiveKit

### Task 23: Add organization-scoped telephony configuration

- [ ] Create tenant-scoped telephony schema/config with RLS for Telnyx technical number, LiveKit routing and operating mode (`always`, `no_answer`, `after_hours`, `overflow`).
- [ ] Keep secrets in existing credential/secret patterns; never persist plaintext in logs.
- [ ] Add Org A/Org B DB tests.
- [ ] Commit: `feat(telephony): add tenant scoped managed telephony config`.

### Task 24: Integrate Telnyx SIP/PSTN webhooks safely

- [ ] Verify webhook signatures and map destination/source to trusted tenant configuration.
- [ ] Add idempotency for duplicate call events.
- [ ] Translate call lifecycle into internal voice-session events.
- [ ] Add fail-closed tests for forged/cross-tenant events.
- [ ] Commit: `feat(telephony): integrate telnyx call ingress`.

### Task 25: Integrate LiveKit realtime session bridge

- [ ] Connect Telnyx/SIP session -> LiveKit -> Voice Agent -> Kernel.
- [ ] Persist session/checkpoint state so reconnect/retry is bounded.
- [ ] Record call latency/duration/provider costs.
- [ ] Commit: `feat(telephony): bridge livekit voice sessions to agent os`.

### Task 26: Phase 6 closure

- [ ] Run all local/fake telephony tests and external sandbox tests if credentials/accounts exist.
- [ ] If provider account/number/verification is absent, mark only the external-live proof blocked; do not fabricate completion.
- [ ] Record exact external blocker or passing evidence in `phase-06.md`.

---

## Phase 7 — Caller recognition

### Task 27: Normalize caller identity and bind Customer Memory

- [ ] Reuse canonical phone normalization/contact rules; never identify across tenants by phone alone.
- [ ] Known caller -> load contact + compact memory.
- [ ] Unknown caller -> create/associate contact only under deterministic rules and minimal data collection.
- [ ] Add duplicate-name/same-phone/cross-org tests.
- [ ] Commit: `feat(identity): add tenant safe caller recognition`.

### Task 28: Phase 7 closure

- [ ] Run caller-recognition tests, RLS/invariants if schema touched, `pnpm gov:verify`, `pnpm build`.
- [ ] Record evidence in `phase-07.md`.

---

## Phase 8 — Commercial tools

### Task 29: Build business capability contracts and registry

- [ ] Define typed tools for catalog/menu, price, availability/stock, order lookup/create/update/cancel, calendar/schedule, ticket, lead, confirmation, deadline and company rules.
- [ ] Classify each tool R0-R4 and side-effect/idempotency/approval requirements.
- [ ] Expose only minimal tool subsets per task.
- [ ] Commit: `feat(tools): add governed commercial capability catalog`.

### Task 30: Bind real CRM/business adapters

- [ ] Implement/read existing CRM adapters instead of embedding business truth in prompts.
- [ ] Add fail-closed behavior for missing authoritative data.
- [ ] Add approval thresholds per organization where required.
- [ ] Add idempotency tests for create/update/cancel actions.
- [ ] Commit: `feat(tools): connect commercial tools to authoritative crm data`.

### Task 31: Phase 8 closure

- [ ] Run Tool Gateway, policy, business-adapter and tenant-isolation tests.
- [ ] `pnpm gov:verify`; `pnpm build`.
- [ ] Record evidence in `phase-08.md`.

---

## Phase 9 — Orders and deterministic ETA

### Task 32: Implement order orchestration and ETA engine

- [ ] Define deterministic ETA inputs: availability, current queue, preparation estimate, delivery/pickup, region/distance where applicable.
- [ ] Implement ETA as tool/service output, never LLM estimation.
- [ ] Add tests for unavailable items, queue changes, missing distance and stale price.
- [ ] Commit: `feat(orders): add authoritative order and eta flow`.

### Task 33: Cross-channel confirmation

- [ ] After voice order completion, send governed WhatsApp confirmation through existing channel abstraction when policy allows.
- [ ] Update Customer Memory with new order reference, not invented order content.
- [ ] Prove retries do not duplicate order or confirmation.
- [ ] Commit: `feat(orders): add idempotent cross channel confirmation`.

### Task 34: Phase 9 closure

- [ ] Run order/ETA/idempotency tests, `pnpm gov:verify`, `pnpm build`.
- [ ] Record evidence in `phase-09.md`.

---

## Phase 10 — Human escalation and voice transfer

### Task 35: Unify escalation package across channels

- [ ] Reuse existing human-handoff/case lifecycle as canonical CRM state.
- [ ] Add channel-neutral escalation package: reason, summary, customer memory refs, attempted tools and outstanding action.
- [ ] Ensure WhatsApp transfer preserves history and current CRM control semantics.
- [ ] Commit: `feat(escalation): unify human escalation context`.

### Task 36: Add voice transfer through LiveKit/Telnyx

- [ ] Implement governed voice transfer/bridge to configured human destination.
- [ ] Pass a concise context summary to the human side where supported.
- [ ] Add failure fallback: if transfer fails, preserve case and provide safe customer messaging.
- [ ] Commit: `feat(escalation): add managed voice transfer to human`.

### Task 37: Phase 10 closure

- [ ] Run escalation lifecycle/invariant tests and sandbox telephony transfer test if external configuration exists.
- [ ] Record evidence in `phase-10.md`.

---

## Phase 11 — Image and video generation

### Task 38: Add isolated media-generation routes/tools

- [ ] Define media-generation capability types, budget class and policy.
- [ ] Route image/video jobs separately from support-response critical path.
- [ ] Add provider adapters behind approved ports; persist cost/latency/status.
- [ ] Require explicit authorization for customer-visible/generated commercial media as policy dictates.
- [ ] Commit: `feat(media): add isolated governed generation pipeline`.

### Task 39: Phase 11 closure

- [ ] Test timeouts, expensive-provider budget, failed generation and no-impact-on-support path.
- [ ] Record evidence in `phase-11.md`.

---

## Phase 12 — Multiempresa SaaS hardening

### Task 40: Tenant-isolation audit of all new surfaces

- [ ] Enumerate every new table, API route, webhook, tool, memory lookup, telephony route and metric.
- [ ] Add Org A/Org B tests wherever isolation is not already proven.
- [ ] Run `pnpm lint:tenant-filter`, `pnpm test:db`, `pnpm test:invariants`.
- [ ] Fix any service-role query lacking explicit organization filter.
- [ ] Commit: `security(tokens): harden all new multi tenant surfaces`.

### Task 41: Per-organization policy/cost/channel controls

- [ ] Ensure WhatsApp, phone, agent version, tool policy, routing budget and observability can be configured per org without deploy.
- [ ] Add rollback/kill-switch tests.
- [ ] Commit: `feat(tokens): complete per organization control plane`.

### Task 42: Phase 12 closure

- [ ] Run full DB/invariant/governance/build gate.
- [ ] Record isolation matrix in `phase-12.md`.

---

## Phase 13 — Agent control panel

### Task 43: Build operational read models/API

- [ ] Expose tenant-scoped metrics for calls, WhatsApps, transcripts, summaries, orders, transfers, recurring customers, memory, costs, tokens, provider/model use, failures, latency, resolution and escalation rate.
- [ ] Use aggregated/read-model queries rather than expensive raw scans.
- [ ] Add API auth/RBAC tests.
- [ ] Commit: `feat(panel): add agent operations read models`.

### Task 44: Build control UI

- [ ] Add views for memory, usage/cost, model/provider routing, channel state, failures and transfers.
- [ ] Add settings for order autonomy, cancellation approval, monetary thresholds and phone operating mode.
- [ ] Apply server-side authorization even when controls are hidden in UI.
- [ ] Add component/Playwright tests for critical controls.
- [ ] Commit: `feat(panel): add agent operations and policy controls`.

### Task 45: Phase 13 closure

- [ ] Run UI/component/E2E tests, `pnpm gov:verify`, `pnpm build`.
- [ ] Record evidence in `phase-13.md`.

---

## Phase 14 — Evals and security

### Task 46: Expand golden/adversarial suite for the complete product

- [ ] Add mandatory master-plan cases: nonexistent product, angry customer, incomplete address, ambiguous order, bad audio, long video, invalid media, prompt injection, free-provider offline, rate limit, unavailable tool, same-name customers, address change, stale price and unauthorized action.
- [ ] Add voice/caller/telephony-specific failure cases.
- [ ] Keep hard deterministic gates independent from quality judge.
- [ ] Commit: `test(tokens): add full product safety and quality eval suite`.

### Task 47: Run shadow/replay gates

- [ ] Run synthetic/golden/shadow suites.
- [ ] Run historical replay only on legitimately available history; never fabricate production evidence.
- [ ] Record per-agent hard safety, routing, escalation, factual accuracy and structured-output metrics.
- [ ] Commit: `test(tokens): record full shadow and replay evidence`.

### Task 48: Security closure

- [ ] Run prompt-injection, tool-authority, webhook-signature, egress, tenant-isolation, approval, R4 and idempotency tests.
- [ ] Run `pnpm gov:verify`, `pnpm test:db`, `pnpm test:invariants`, `pnpm build`.
- [ ] Record evidence in `phase-14.md`.

---

## Phase 15 — Observability and continuous optimization

### Task 49: Complete cross-channel observability

- [ ] Ensure each interaction has correlation/trace identity across WhatsApp/voice/model/tool/order/escalation.
- [ ] Record time-to-first-response, voice latency, call duration, AI-resolution %, human-transfer %, cost/interaction, tokens/interaction, cost/org, provider/model, provider failures, fallback rate, satisfaction if available, conversion, human rework, memory accuracy and ETA accuracy.
- [ ] Avoid prompt/PII content in default telemetry.
- [ ] Commit: `feat(obs): complete cross channel cost quality telemetry`.

### Task 50: Add safe router optimization loop

- [ ] Aggregate quality/cost/latency by task/provider/model.
- [ ] Produce recommendations only; do not auto-promote unsafe routes.
- [ ] Require certification/policy gate before route promotion.
- [ ] Add rollback/circuit-breaker feedback.
- [ ] Commit: `feat(router): add governed continuous route optimization`.

### Task 51: Phase 15 closure

- [ ] Run observability/router optimization tests and `pnpm gov:verify` + `pnpm build`.
- [ ] Record evidence in `phase-15.md`.

---

# Final End-to-End Gate — branch complete, no main merge

### Task 52: Execute production-like full-flow test matrix

A branch is not complete until the following flow is proven in a production-like test environment:

- [ ] Returning customer sends WhatsApp text -> organization/customer identified -> compact memory loaded -> router selects model -> authoritative tool used -> response sent -> memory updated -> telemetry recorded.
- [ ] Returning customer sends image/audio/video/PDF/sticker -> media understood through preserved multimodal path -> same governance/memory/router flow succeeds.
- [ ] Returning customer calls -> Caller ID normalized -> tenant/customer identified -> memory loaded -> LiveKit voice agent interacts -> tool action succeeds -> optional WhatsApp confirmation is idempotent.
- [ ] Customer requests human -> WhatsApp control or voice call transfers without losing history/context.
- [ ] Primary free provider is unavailable -> explicit fallback event -> alternate route succeeds.
- [ ] Org A cannot read/write Org B memory, calls, tools, orders, metrics or configs.
- [ ] Unauthorized sensitive action is denied/approval-gated.
- [ ] ETA/price/availability come only from authoritative tools.
- [ ] Cost, tokens, provider, fallback, latency and outcome are visible per organization.

### Task 53: Run final repository gates

- [ ] `pnpm harness:check`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm lint:channels`
- [ ] `pnpm lint:tenant-filter`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:db`
- [ ] `pnpm test:invariants`
- [ ] relevant `pnpm test:e2e` / journey suites
- [ ] `pnpm build`
- [ ] Re-run any phase-specific external sandbox tests whose credentials are available.

### Task 54: Final documentation and branch handoff

- [ ] Update `docs/implementation/implementacao-tokens-status.md` to COMPLETE only for gates actually proven.
- [ ] Update `docs/architecture/implementacao-tokens.md` to the final architecture.
- [ ] Add `docs/evidence/implementacao-tokens/final-e2e.md` with exact SHA, commands and outcomes.
- [ ] Audit committed files for secrets/PII/test artifacts.
- [ ] Verify `git status` clean.
- [ ] Verify branch is still `implementacao-tokens`.
- [ ] Do **not** merge to `main`.
- [ ] Do **not** open/merge a production PR unless separately requested.
- [ ] Commit: `docs(tokens): finalize implementation evidence without main merge`.

---

# Autonomous Execution Rules

During implementation, the inline executor is pre-authorized to:

- edit/create/delete code and test files on `implementacao-tokens` as required by this plan;
- create branch-local migrations and update the migration manifest;
- run local tests, typecheck, lint, build and test databases;
- make branch-local commits after task gates pass;
- repair regressions discovered by tests;
- refactor when required to preserve a single canonical runtime or remove an implementation conflict introduced by convergence;
- update documentation/evidence continuously;
- continue immediately to the next task when the current task is green.

The inline executor is **not** pre-authorized to:

- merge/rebase the implementation into `main`;
- deploy destructive or unverified production database changes;
- purchase phone numbers, plans or paid resources;
- fabricate provider credentials, OTP verification, billing approval or production evidence;
- weaken RLS, security policy, approval rules or evidence requirements merely to make a test pass.

When an external provider step is impossible without a human/account action, finish all code/fake/sandbox-independent work first, document the exact blocker, continue any later tasks that do not depend on it, and stop only when no further unblocked tasks remain.

# Definition of Done

The branch is DONE only when Tasks 1-54 are either:

1. completed with fresh evidence on `implementacao-tokens`, or
2. explicitly marked externally blocked with all independent engineering complete and the exact human/provider action recorded.

A historical PASS from an Agent OS branch is never sufficient by itself. No merge to `main` is part of this Definition of Done.