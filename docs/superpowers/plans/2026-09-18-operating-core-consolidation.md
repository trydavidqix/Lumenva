# Operating Core Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate jobs, events, runtime execution, claims, retries and durable state around the existing production path without importing the incomplete parallel `packages/operating-core` prototype.

**Architecture:** `job_queue` is the durable execution queue. `event_log` is the append-only domain-event bus. `apps/crm/lib/agent-engine/queue` owns claim, lease, retry, completion and reaping. `apps/crm/lib/event-log` owns generic event consumer dispatch. Agent session locks, approvals and receipts remain supporting runtime state in PostgreSQL, not alternate schedulers. Provider-free branch prototypes remain historical/superseded.

**Tech Stack:** TypeScript, Next.js, PostgreSQL/Supabase, Vitest, pnpm.

**Spec:** `docs/specs/07-spec-events-workers.md`, `docs/specs/10-spec-ai-agents-runtime.md`, `CLAUDE.md`.

## Global Constraints

- Preserve applied migrations; use forward-fix only.
- Keep tenant identity server-derived and every durable claim tenant-scoped.
- Do not introduce a second generic queue, scheduler, event bus or runtime.
- Keep product-specific tables such as `followup_enrollments` and `publication_jobs` as domain projections, not generic queue replacements.
- Use tests first for behavior changes; run focused, typecheck, lint and database gates before domain handoff.
- Preserve unrelated pre-existing change in `docs/Current-State.md`.

---

### Task 1: Prove current Operating Core boundaries

**Files:**
- Create: `apps/crm/tests/invariants/operating-core-authority.test.ts`
- Inspect: `apps/crm/lib/agent-engine/queue/queue.ts`, `apps/crm/lib/event-log/dispatcher.ts`, `apps/crm/lib/event-log/drain.ts`

**Interfaces:**
- Consumes: existing queue/event-log modules and repository paths.
- Produces: executable invariant that identifies canonical ownership without changing runtime behavior.

- [ ] **Step 1: Write failing invariant test**
- [ ] **Step 2: Run focused test and confirm expected failure**
- [ ] **Step 3: Implement the smallest invariant assertions**
- [ ] **Step 4: Run focused test and confirm pass**

### Task 2: Remove dead parallel runtime switches

**Files:**
- Modify: exact route/worker consumers only after Task 1 identifies a dead switch.
- Test: focused regression tests for affected consumer.

**Interfaces:**
- Consumes: canonical `event_log` drain and agent-engine drain.
- Produces: one explicit ownership path per event class; no behavior change for supported deployments.

- [ ] **Step 1: Write failing regression test for the selected dead path**
- [ ] **Step 2: Run focused test and confirm failure**
- [ ] **Step 3: Remove or redirect only the dead parallel path**
- [ ] **Step 4: Run focused regression and existing consumer tests**

### Task 3: Canonicalize documentation and roadmap

**Files:**
- Modify: `ARCHITECTURE.md`, `docs/architecture/CURRENT_ARCHITECTURE.md`, `docs/architecture/TARGET_ARCHITECTURE.md`, `ROADMAP.md`, `TASKS.md`
- Create: `docs/architecture/OPERATING-CORE.md`

**Interfaces:**
- Consumes: verified code paths and test results from Tasks 1–2.
- Produces: one source-of-truth map for jobs, events, runtime, state and adapters; duplicate Operating Core tasks marked superseded/merged.

- [ ] **Step 1: Record exact current authority and branch classification**
- [ ] **Step 2: Remove duplicate roadmap entries and point to canonical domain**
- [ ] **Step 3: Validate all referenced paths exist**

### Task 4: Validate Operating Core domain

**Files:**
- No new production files.

- [ ] **Step 1: Run focused Operating Core tests**
- [ ] **Step 2: Run `pnpm typecheck`**
- [ ] **Step 3: Run `pnpm lint`**
- [ ] **Step 4: Run `pnpm test:unit`**
- [ ] **Step 5: Run `pnpm test:db` when database services are available**
- [ ] **Step 6: Inspect diff and Git state; commit domain changes only**
