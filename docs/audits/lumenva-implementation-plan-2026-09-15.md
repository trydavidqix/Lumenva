# Lumenva — 20-stage implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `sr-subagent-driven-development` (recommended) or `sr-executing-plans` to implement each stage task-by-task. Every stage also requires `sr-test-driven-development` and `sr-verification-before-completion`; debugging requires `sr-systematic-debugging`. Never work on `main`.

**Goal:** complete the Lumenva consolidation incrementally from the verified `origin/main@fec2d253`, preserving compatible branding and proving every security, tenancy, runtime, and product contract.

**Architecture:** GitHub is the versioned source of truth. The CRM app remains the canonical operational surface; Postgres/Supabase is authoritative for tenant data and durable state. Engineering/control-plane agents remain separate from customer-facing product agents, with evidence-driven promotion for learning and autonomy.

**Tech Stack:** pnpm workspace, Next.js/React/TypeScript, Supabase/Postgres/RLS, Vitest, Playwright, Docker Compose/Caddy, GitHub Actions, Codex Cloud.

**Spec:** `docs/audits/lumenva-branch-audit-2026-09-15.md` plus project conventions in `AGENTS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, and `docs/doctrine/`.

## Global constraints

- Use isolated worktrees and branches; never merge, push, rebase, or integrate into `main`.
- Required chain for every stage: `sr-writing-plans -> sr-executing-plans` or `sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion`.
- Use `sr-systematic-debugging` for failures and `sr-requesting-code-review`/ `sr-receiving-code-review` for review cycles.
- Server Components by default; `Readonly` props; Tailwind without CSS-in-JS.
- APIs use `/api/v1`, snake_case, `ok()/fail()`; external input uses Zod; auth uses `getUser()`; body `organization_id` is never trusted.
- Use UUID v4, ISO-8601 UTC, `_cents + currency`, RLS and cross-tenant tests, audit relevant mutations, idempotent side effects, and no HTTP from Postgres triggers.
- Branding changes are additive and backwards-compatible until an owner decision authorizes removal.
- When local networking cannot install dependencies, document and run the exact Codex Cloud command; continue with static validation.

## Dependency graph

```
1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10
                                      |             |
                                      v             v
                              11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20
```

Stages 11–13 may be developed in parallel only after stages 5–8 contracts are accepted; stages 14–17 consume those foundations; stage 20 is the final release gate.

## Stage checklist

| Stage | Classification | Deliverable | Dependencies | Acceptance criterion |
|---:|:---:|---|---|---|
| 1 | F | Main/deploy CI gate targets canonical CRM workspace | none | workflow YAML/static checks; Codex Cloud CI gates execute |
| 2 | M | Persist branch audit and this 20-stage plan | 1 | both docs tracked, reproducible inventory, no ephemeral source |
| 3 | F | Reproducible dependency/install and CI command contract | 1, 2 | frozen install and workspace-filter contract proven in Codex Cloud |
| 4 | M | Compatible Lumenva identity/rename matrix | 2, 3 | old identifiers remain aliases; new identifiers resolve; grep contract passes |
| 5 | F | Environment/runtime configuration contract | 3, 4 | env example sync, required-secret boundaries, runtime public env test |
| 6 | F | Database baseline and migration manifest reconciliation | 3, 5 | install/update idempotence and migration manifest checks pass |
| 7 | F | Auth, organization context, RLS and audit boundary | 5, 6 | authenticated cross-tenant reads/writes fail closed in integration tests |
| 8 | F | Canonical API v1 envelopes and input schemas | 5, 7 | route contract tests prove snake_case, ok/fail, Zod, user and tenant rules |
| 9 | P | CRM contacts, leads, pipeline and customer-360 surface | 7, 8 | tenant-scoped CRUD, dedup, merge, timeline and export contracts pass |
| 10 | P | Billing, entitlements and Stripe webhook/checkout boundary | 7, 8, 9 | signed webhook/idempotency/entitlement tests pass; no client trust |
| 11 | P | Agent birth, catalog and product-agent separation | 5, 7, 8 | published agent version, role boundary and provider-free contracts pass |
| 12 | F | Session runtime, dispatch, handoff and tool-loop locks | 6, 7, 11 | durable session/supersession/idempotency tests pass |
| 13 | F | Memory, RAG, knowledge and promotion gates | 6, 7, 11, 12 | tenant memory isolation, evidence provenance and promotion tests pass |
| 14 | P | WhatsApp/channel gateway and consent boundaries | 7, 8, 12, 13 | webhook auth, consent, channel lint and idempotent delivery pass |
| 15 | P | Studio, portal, editorial/content and asset provenance | 7, 8, 13, 14 | portal token/RLS, review approval and asset provenance tests pass |
| 16 | P | Voice runtime, SIP/media worker and spoken-output policy | 5, 7, 12, 14 | provider-free QA plus worker/context/turn tests pass; external call proof owner-gated |
| 17 | F | Jobs, automation, cron, event wake and durable execution | 6, 7, 12, 14, 15 | retries/idempotency/no-progress watchdog and route auth tests pass |
| 18 | P | Web UI, navigation, responsive behavior and accessibility | 8, 9, 11, 15 | typecheck/lint, journey tests and accessibility audit pass |
| 19 | F | Security, observability, evals and operational runbooks | 3–18 | security diff scan, telemetry/redaction/evals and runbook checks pass |
| 20 | F | Release, deployment, production proof and branch handoff | 1–19 | full Codex Cloud gates, traceable SHA, deploy verification, no main integration |

## Stage execution contracts

Each stage below is an executable contract. The exact files are refined only after reading the relevant current code; no stage may silently expand its scope.

### Stage 1: Main/deploy CI [F]

**Files / surfaces:** `.github/workflows/ci.yml`; `docker-compose*.yml`; `docs/runbooks/deploy.md`

**Dependencies:** none

**Acceptance:** `pnpm --filter lumenva-crm typecheck`, `pnpm --filter lumenva-crm lint`, `pnpm --filter lumenva-crm test:unit`, `pnpm --filter lumenva-crm test:db`; static YAML/diff checks; production deploy remains owner-gated.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 2: Persist audit and plan [M]

**Files / surfaces:** `docs/audits/lumenva-branch-audit-2026-09-15.md`; `docs/audits/lumenva-implementation-plan-2026-09-15.md`

**Dependencies:** 1

**Acceptance:** Both files are tracked in Git, include base SHA, complete remote snapshot, 20 stages, classifications, dependencies, acceptance criteria, and mandatory sr-* chain.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 3: Workspace reproducibility [F]

**Files / surfaces:** `.github/workflows/ci.yml`; `pnpm-workspace.yaml`; `pnpm-lock.yaml`; Codex Cloud job configuration

**Dependencies:** 1, 2

**Acceptance:** Frozen install plus all filtered CI commands execute from a clean checkout; no unscoped root script remains.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 4: Identity compatibility [M]

**Files / surfaces:** `AGENTS.md`; `CLAUDE.md`; `README*.md`; compose/env/docs references

**Dependencies:** 2, 3

**Acceptance:** Compatibility matrix and tests cover old DeskcommCRM identifiers, Lumenva identifiers, image names, URLs, and env aliases; no breaking removal.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 5: Runtime configuration [F]

**Files / surfaces:** `apps/crm/.env.example`; `apps/crm/lib/env.ts`; `apps/crm/lib/*config*`; deployment manifests

**Dependencies:** 3, 4

**Acceptance:** Required values fail closed, public values are runtime-safe, secrets never enter client bundles, and env-example synchronization passes.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 6: Database foundations [F]

**Files / surfaces:** `supabase/baseline.sql`; `supabase/migrations/*`; migration scripts/manifests

**Dependencies:** 3, 5

**Acceptance:** Baseline install and update are idempotent; migration ordering and declarations match; no trigger performs HTTP.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 7: Tenant security [F]

**Files / surfaces:** `apps/crm/lib/auth/*`; `apps/crm/lib/*tenant*`; `supabase/migrations/*rls*`; security tests

**Dependencies:** 5, 6

**Acceptance:** Two organizations cannot read/write each other’s rows; organization context comes from authenticated server state; relevant mutations are audited.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 8: API contract [F]

**Files / surfaces:** `apps/crm/app/api/v1/**`; `apps/crm/lib/http/**`; Zod schemas and route tests

**Dependencies:** 5, 7

**Acceptance:** External input is parsed with Zod; responses use `ok()/fail()`; route names and payload fields remain snake_case and auth uses `getUser()`.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 9: CRM core [P]

**Files / surfaces:** `apps/crm/lib/contacts/**`; `apps/crm/lib/leads/**`; corresponding API/UI/tests

**Dependencies:** 7, 8

**Acceptance:** Tenant-scoped contacts/leads, signed cursors, dedup/merge atomicity, timeline and export behavior pass targeted tests.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 10: Billing [P]

**Files / surfaces:** `apps/crm/app/api/v1/billing/**`; Stripe adapters/webhooks; entitlements/tests

**Dependencies:** 7, 8, 9

**Acceptance:** Signature verification, idempotency, active-plan authorization, cents/currency values and audit boundaries pass.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 11: Agent birth/catalog [P]

**Files / surfaces:** `apps/crm/lib/agent-engine/agent/**`; catalog/factory/published-version tests

**Dependencies:** 5, 7, 8

**Acceptance:** Customer agents and engineering agents remain separate; provider/model credentials are not client-controlled; published versions are deterministic.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 12: Session runtime [F]

**Files / surfaces:** `apps/crm/lib/agent-engine/session/**`; dispatch/handoff/tool-loop tests; session migrations

**Dependencies:** 6, 7, 11

**Acceptance:** Session ownership, supersession, handoff, tool-loop locks and event idempotency are durable and tenant-scoped.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 13: Memory and knowledge [F]

**Files / surfaces:** `apps/crm/lib/memory/**`; Hermes/RAG/knowledge registries; promotion tests/migrations

**Dependencies:** 6, 7, 11, 12

**Acceptance:** Memory is tenant-isolated, provenance is retained, Graphiti/Mem0 are non-authoritative adapters, and promotion is evaluation-gated.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 14: Channels [P]

**Files / surfaces:** `apps/crm/app/api/v1/webhooks/**`; WAHA/WhatsApp adapters; consent and channel tests

**Dependencies:** 7, 8, 12, 13

**Acceptance:** Webhook authentication, consent registry, idempotent inbound/outbound delivery, and provider-leak lint pass.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 15: Studio/content [P]

**Files / surfaces:** `apps/crm/lib/studio/**`; portal/editorial/content/asset routes and tests

**Dependencies:** 7, 8, 13, 14

**Acceptance:** Portal tokens and review actions are RLS-protected; asset license/provenance and editorial side effects are audited/idempotent.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 16: Voice [P]

**Files / surfaces:** `apps/crm/lib/voice/**`; `apps/crm/workers/voice-worker/**`; SIP/QA scripts and tests

**Dependencies:** 5, 7, 12, 14

**Acceptance:** Context/turn/event contracts and spoken-output hard policy pass; real telephony remains separately owner/account-gated.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 17: Automation/jobs [F]

**Files / surfaces:** `apps/crm/lib/agent-engine/wave4/**`; cron routes; job/event migrations and tests

**Dependencies:** 6, 7, 12, 14, 15

**Acceptance:** Retries are bounded/idempotent; watchdogs detect no progress; cron routes require internal auth; no duplicate side effects.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 18: UI/accessibility [P]

**Files / surfaces:** `apps/crm/app/**`; components/navigation; journey/a11y tests

**Dependencies:** 8, 9, 11, 15

**Acceptance:** Responsive journeys, keyboard/focus/semantic accessibility, server-component boundaries and lint/typecheck pass.

**Mandatory skill chain:** sr-writing-plans -> sr-subagent-driven-development -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 19: Security/operations [F]

**Files / surfaces:** `.github/workflows/**`; `docs/runbooks/**`; observability/redaction/eval scripts

**Dependencies:** 3–18

**Acceptance:** Security scan and diff review find no unresolved high-risk issue; telemetry is redacted; runbooks reproduce deploy/rollback checks.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.

### Stage 20: Release handoff [F]

**Files / surfaces:** release checklist; deployment/runbooks; branch metadata

**Dependencies:** 1–19

**Acceptance:** Full gates run in Codex Cloud, deploy proof maps to a known SHA, worktree status is understood, and owner receives integration options without auto-merging main.

**Mandatory skill chain:** sr-writing-plans -> sr-executing-plans -> sr-test-driven-development -> sr-verification-before-completion

**Execution note:** create or reuse an isolated worktree, make the smallest testable change, run static checks locally, then run the listed full command in Codex Cloud when local network/dependencies prevent it. Commit only the stage files.


## Owner decision queue

These are the only decisions intentionally not guessed by the executor: production/provider accounts (Twilio, WhatsApp, Stripe, AI), public pricing and legal copy, deleting or archiving remote branches, changing the canonical deployment topology, and integrating any completed branch into `main`. Work that does not depend on these decisions continues; each dependent acceptance remains marked owner-gated.

## Current execution state

- Stage 1: implemented in `1a5a54fb` on an isolated branch; no main integration.
- Stage 2: this audit and plan are being persisted now on `docs/lumenva-audit-2026-09-15`.
- Stages 3–20: pending execution from this versioned plan.
