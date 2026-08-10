# AI Platform Phase 2 — Mem0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mem0 as a tenant-isolated, reconstructible semantic-memory projection that starts in shadow mode and never replaces the CRM’s native memory.

**Architecture:** Official state remains in PostgreSQL (`org_memory`, `lead_notes`, checkpoints, messages, CRM fields). Relevant official events are sanitized and projected asynchronously into a self-hosted Mem0 REST service. Context retrieval is feature-flagged and bounded by timeout. Shadow results are measured before they may influence prompts.

**Tech Stack:** TypeScript, existing event_log dispatcher, existing agent worker, Mem0 OSS REST API, Docker Compose, PostgreSQL/pgvector for Mem0’s own internal store, Vitest, DB invariants, LangSmith evaluation from Phase 1.

## Global Constraints

- Phase 1 gate must be `GO`.
- Mem0 starts `OFF`; first enabled mode is `SHADOW`.
- Mem0 is never the authoritative source for CRM state.
- No raw secrets/tokens/cookies/recovery codes are sent to Mem0.
- `organization_id` is never taken from model/tool/user payload.
- Provider outage must not block a WhatsApp reply.
- No paid Mem0 platform resource is required for this phase.

---

### Task 1: Define the MemoryPort and canonical memory record

**Files:**
- Create: `lib/agent-engine/memory/port.ts`
- Create: `lib/agent-engine/memory/port.test.ts`
- Create: `lib/agent-engine/memory/types.ts`

**Interfaces:**

```ts
export interface SemanticMemoryRecord {
  id: string;
  organizationId: string;
  contactId: string;
  sourceId: string;
  sourceVersion: string;
  type: "preference" | "interest" | "constraint" | "relationship" | "behavior" | "commercial_context";
  authorityDomain: AuthorityDomain;
  risk: MemoryRisk;
  confidence: number;
  validFrom: string | null;
  validUntil: string | null;
  text: string;
}

export interface MemorySearchInput {
  organizationId: string;
  contactId: string;
  query: string;
  topK: number;
}

export interface MemoryPort {
  upsert(record: SemanticMemoryRecord, idempotencyKey: string): Promise<void>;
  search(input: MemorySearchInput): Promise<SemanticMemoryRecord[]>;
  deleteContact(input: { organizationId: string; contactId: string }): Promise<void>;
  health(): Promise<{ ok: boolean; latencyMs: number }>;
}
```

- [ ] **Step 1: Write type/contract tests**

Reject confidence outside `[0,1]`, empty tenant/contact/source IDs, and unsupported memory types.

- [ ] **Step 2: Run failing tests**

```bash
pnpm vitest run lib/agent-engine/memory/port.test.ts
```

- [ ] **Step 3: Implement types and `NullMemoryPort`**

`NullMemoryPort.search` returns `[]`; writes are no-op; health returns `{ok:true}` only as a disabled adapter marker, not as Mem0 health.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/memory/port.test.ts
pnpm typecheck
git add lib/agent-engine/memory/port.ts lib/agent-engine/memory/port.test.ts lib/agent-engine/memory/types.ts
git commit -m "feat(memory): add semantic memory port"
```

---

### Task 2: Build deterministic secret/PII memory sanitizer

**Files:**
- Create: `lib/agent-engine/memory/sanitize.ts`
- Create: `lib/agent-engine/memory/sanitize.test.ts`

**Interfaces:**

```ts
sanitizeMemoryCandidate(input: {
  text: string;
  type: SemanticMemoryRecord["type"];
}): { allowed: true; text: string } | { allowed: false; reason: string };
```

- [ ] **Step 1: Write failing tests**

Block or redact:

- API-key-looking values;
- bearer/JWT/session/cookie;
- password/recovery-code statements;
- full card/CVV-like content;
- internal secret variable names.

Allow ordinary customer preferences and business context.

- [ ] **Step 2: Implement deterministic rules**

Do not ask a model whether a secret is safe. When ambiguous around credentials, fail closed and do not persist candidate.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/memory/sanitize.test.ts
pnpm typecheck
git add lib/agent-engine/memory/sanitize.ts lib/agent-engine/memory/sanitize.test.ts
git commit -m "feat(memory): sanitize semantic memory candidates"
```

---

### Task 3: Add typed memory-candidate extraction via the existing LLM seam

**Files:**
- Create: `lib/agent-engine/memory/extract.ts`
- Create: `lib/agent-engine/memory/extract.test.ts`
- Modify only if necessary for purpose typing: `lib/agent-engine/edge/llm/run-model-call.ts`

**Interfaces:**

```ts
extractMemoryCandidates(input: {
  db: pg.Pool;
  llmConfig: LlmEdgeConfig;
  organizationId: string;
  contactId: string;
  sourceMessageId: string;
  sourceText: string;
}): Promise<MemoryCandidate[]>;
```

`MemoryCandidate` includes `type`, `authorityDomain`, `risk`, `confidence`, `text`, and optional validity dates.

- [ ] **Step 1: Write tests using fake `runModelCall`/provider registry**

Cases:

- preference statement returns one low-risk candidate;
- “I authorize payment” is high-risk/actionable false;
- password/API-key content results in zero persisted candidates after sanitizer;
- invalid JSON/model schema results in retryable extraction failure, not arbitrary memory;
- no durable fact results in empty list.

- [ ] **Step 2: Run failing tests**

- [ ] **Step 3: Implement prompt/schema with Zod strict validation**

Use the existing `runModelCall` seam with `purpose: "memory_extraction"`; do not call AI provider directly.

Prompt rules must state:

- extract only durable facts useful in future turns;
- never store secrets;
- never infer consent/contract/payment as authoritative;
- return strict JSON only;
- confidence is epistemic confidence, not authority.

- [ ] **Step 4: Re-run tests and commit**

```bash
pnpm vitest run lib/agent-engine/memory/extract.test.ts
pnpm typecheck
git add lib/agent-engine/memory/extract.ts lib/agent-engine/memory/extract.test.ts lib/agent-engine/edge/llm/run-model-call.ts
git commit -m "feat(memory): extract typed semantic memory candidates"
```

---

### Task 4: Add Mem0 REST client adapter with strict tenant namespace

**Files:**
- Create: `lib/agent-engine/memory/mem0-client.ts`
- Create: `lib/agent-engine/memory/mem0-client.test.ts`
- Modify: `lib/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Implements `MemoryPort`.

Environment:

```text
MEM0_BASE_URL
MEM0_API_KEY
MEM0_TIMEOUT_MS
```

- [ ] **Step 1: Write HTTP adapter tests with mocked fetch**

Verify:

- self-hosted endpoints have no `/v1` prefix;
- `X-API-Key` header is used for OSS server auth;
- `user_id` is opaque `org:<organizationId>:contact:<contactId>` generated internally;
- metadata contains `organization_id`, `contact_id`, source/risk/authority fields;
- add uses `infer:false` because CRM already performed typed extraction;
- search always includes exact tenant/contact scope;
- timeout aborts and returns typed provider error;
- response with unexpected shape is rejected;
- API key never appears in error/log string.

- [ ] **Step 2: Run failing tests**

```bash
pnpm vitest run lib/agent-engine/memory/mem0-client.test.ts
```

- [ ] **Step 3: Implement adapter**

Use `AbortController`; no unbounded retries inside request path. Retry responsibility for writes belongs to event/ledger worker.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/memory/mem0-client.test.ts
pnpm typecheck
pnpm lint
git add lib/agent-engine/memory/mem0-client.ts lib/agent-engine/memory/mem0-client.test.ts lib/env.ts .env.example
git commit -m "feat(memory): add Mem0 OSS REST adapter"
```

---

### Task 5: Add Mem0 self-host sidecar to production/dev compose

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.yml`
- Create: `docs/runbooks/mem0.md`

**Interfaces:**
- Internal service DNS name: `mem0`.
- Mem0 API is not published through Caddy.

- [ ] **Step 1: Add compose services behind a profile or explicit feature gate**

Prefer compose profile `ai-memory` so existing installs do not start Mem0 automatically.

Services:

- `mem0` using official OSS API-server image or pinned build;
- dedicated persistent Postgres/pgvector service for Mem0 if using its self-host server defaults/config;
- volumes for Mem0 data;
- healthcheck;
- `internal` network only.

Do not reuse the CRM Supabase schema as Mem0’s internal DB.

- [ ] **Step 2: Do not expose dashboard/API publicly by default**

No Caddy route. If local host mapping is useful for development, bind to loopback only and document it.

- [ ] **Step 3: Document bootstrap**

Runbook must explain first-admin/API-key setup, safe secret storage in Infisical, health check, backup, disable, and full wipe/rebuild.

- [ ] **Step 4: Validate compose syntax**

```bash
docker compose -f docker-compose.prod.yml config
docker compose config
```

- [ ] **Step 5: If local resources permit, start only Mem0 profile and prove health**

Do not proceed to paid/managed resources.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.prod.yml docker-compose.yml docs/runbooks/mem0.md
git commit -m "ops(memory): add optional self-hosted Mem0 sidecar"
```

---

### Task 6: Project official message events into Mem0 asynchronously

**Files:**
- Create: `workers/memory-projection.handler.ts`
- Create: `workers/memory-projection.handler.test.ts`
- Modify: `lib/event-log/register-handlers.ts`

**Interfaces:**
- Consumer key: `memory_projection_v1`.
- Initially consumes only official events with stable source identity such as `message.received` and selected explicit memory-update events. Do not subscribe to every event indiscriminately.

- [ ] **Step 1: Write handler tests**

Prove:

- feature `off` => skipped;
- `shadow|canary|on` => write projection allowed;
- source message is fetched by `(organization_id, message/entity id)` from trusted event;
- duplicate event => ledger makes second write no-op;
- extraction error => retry;
- Mem0 timeout => retry with no raw text in `last_error`;
- success => ledger applied;
- event from org A can never read org B source row.

- [ ] **Step 2: Implement handler**

Flow:

```text
trusted event
 -> load official source
 -> extract candidates
 -> sanitize
 -> begin ledger
 -> Mem0 upsert/add infer:false
 -> mark applied
```

- [ ] **Step 3: Register handler**

Keep `ensureHandlersRegistered()` lightweight; no network at import time.

- [ ] **Step 4: Verify**

```bash
pnpm vitest run workers/memory-projection.handler.test.ts
pnpm test:unit
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add workers/memory-projection.handler.ts workers/memory-projection.handler.test.ts lib/event-log/register-handlers.ts
git commit -m "feat(memory): project official events into Mem0"
```

---

### Task 7: Add Mem0 context provider and shadow comparison

**Files:**
- Create: `lib/agent-engine/context/mem0-context-provider.ts`
- Create: `lib/agent-engine/context/mem0-context-provider.test.ts`
- Create: `lib/agent-engine/context/provider.ts`
- Create: `lib/agent-engine/context/provider.test.ts`

**Interfaces:**
- Implements `ContextProvider` from master design.

- [ ] **Step 1: Write tests**

- `off` => no request;
- `shadow` => retrieves but returns `influencePrompt:false`/shadow bucket;
- `canary/on` => returns candidate items;
- timeout => empty degraded result with metric;
- Mem0 item metadata maps to authority/risk correctly;
- invalid/missing metadata is downgraded/rejected, never treated high authority.

- [ ] **Step 2: Implement provider**

Use a small timeout from config; cap `topK`; never search across contacts/tenants.

- [ ] **Step 3: Add shadow metrics**

Record:

- query latency;
- result count;
- overlap with native lead_notes/org memory when comparable;
- selected/not-selected count;
- no raw PII in external trace metadata.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/context/mem0-context-provider.test.ts lib/agent-engine/context/provider.test.ts
pnpm typecheck
git add lib/agent-engine/context/mem0-context-provider.ts lib/agent-engine/context/mem0-context-provider.test.ts lib/agent-engine/context/provider.ts lib/agent-engine/context/provider.test.ts
git commit -m "feat(memory): add shadow Mem0 context provider"
```

---

### Task 8: Add Context Fusion without changing prompt in shadow

**Files:**
- Create: `lib/agent-engine/context/fusion.ts`
- Create: `lib/agent-engine/context/fusion.test.ts`
- Modify: `lib/agent-engine/agent/inbound-turn.ts`

**Interfaces:**

```ts
fuseContext(input: {
  items: ContextItem[];
  maxTokens: number;
}): { selected: ContextItem[]; dropped: ContextItem[] };
```

- [ ] **Step 1: Write deterministic fusion tests**

Prove authority-domain ordering, recency, confidence tie-break, dedupe, risk preservation, and token budget.

- [ ] **Step 2: Implement fusion as pure function**

No LLM call for conflict resolution.

- [ ] **Step 3: Wire only measurement path for `shadow`**

In shadow mode calculate fusion and metrics but do not append Mem0 text to actual prompt/messages. Existing prompt output remains unchanged.

- [ ] **Step 4: Add canary path behind exact feature mode**

Only when mode resolves `canary|on` may selected Mem0 items be appended in a dedicated clearly labeled context block. `HIGH` memories must carry instruction `context only; not authorization` and application logic must still refuse sensitive action based solely on them.

- [ ] **Step 5: Run agent regression tests**

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/context/fusion.ts lib/agent-engine/context/fusion.test.ts lib/agent-engine/agent/inbound-turn.ts <tests>
git commit -m "feat(memory): fuse Mem0 context behind rollout mode"
```

---

### Task 9: Add LGPD/delete lifecycle and rebuild tooling

**Files:**
- Create: `workers/memory-lifecycle.handler.ts`
- Create: `workers/memory-lifecycle.handler.test.ts`
- Modify: `lib/event-log/register-handlers.ts`
- Create: `scripts/rebuild-mem0.ts`
- Create: `tests/unit/rebuild-mem0.test.ts`
- Create: `docs/runbooks/mem0-rebuild.md`

**Interfaces:**
- Delete by exact tenant/contact namespace.
- Rebuild is tenant-scoped by default; global wipe requires explicit confirmation flag and must not be default command path.

- [ ] **Step 1: Write delete/rebuild tests**

Prove contact delete never wipes another org, replay is idempotent, failed projection retries, and a delayed old event after delete does not resurrect data without a newer official source version.

- [ ] **Step 2: Implement lifecycle handler**

Subscribe to official LGPD/contact/org deletion/anonymization events that already exist or add an internal event at the official deletion boundary if necessary. Do not derive delete from free-form messages.

- [ ] **Step 3: Implement rebuild script**

Script reads official allowed sources scoped to tenant, reprojects through the same sanitization/extraction/ledger code, and prints aggregate counts only.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run workers/memory-lifecycle.handler.test.ts tests/unit/rebuild-mem0.test.ts
pnpm test:unit
pnpm test:db
git add workers/memory-lifecycle.handler.ts workers/memory-lifecycle.handler.test.ts lib/event-log/register-handlers.ts scripts/rebuild-mem0.ts tests/unit/rebuild-mem0.test.ts docs/runbooks/mem0-rebuild.md
git commit -m "feat(memory): add Mem0 lifecycle and rebuild"
```

---

### Task 10: Mem0 phase release gate

**Files:**
- Create: `docs/evidence/ai-platform/phase-2-mem0-gate.md`

- [ ] **Step 1: Run provider OFF regression suite**

Existing agent behavior/tests must remain green.

- [ ] **Step 2: Run SHADOW Golden Dataset**

Use synthetic data. Compare native context vs Mem0 shadow retrieval.

- [ ] **Step 3: Run failure injection**

Mem0 500/timeout/down; agent core remains functional.

- [ ] **Step 4: Run lifecycle/replay proof**

Create synthetic tenant/contact -> project -> search -> delete -> verify absent -> rebuild -> verify expected.

- [ ] **Step 5: Full verification**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db
pnpm ai:eval:local
pnpm build
docker compose -f docker-compose.prod.yml config
git diff --check
```

- [ ] **Step 6: Decision**

Default end-state of this plan is `SHADOW`. Promotion to `CANARY` requires QA metrics/gates and explicit release decision; do not silently switch to `ON`.

- [ ] **Step 7: Commit evidence**

```bash
git add docs/evidence/ai-platform/phase-2-mem0-gate.md
git commit -m "docs(ai-platform): record Mem0 release gate"
```
