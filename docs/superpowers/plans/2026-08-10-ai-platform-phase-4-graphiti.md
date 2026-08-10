# AI Platform Phase 4 — Graphiti + FalkorDB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Graphiti as an optional, tenant-namespaced temporal/relationship projection backed by FalkorDB, with replay/rebuild, shadow retrieval and graceful degradation.

**Architecture:** Graphiti receives sanitized official CRM episodes asynchronously. Each organization maps to a deterministic Graphiti `group_id`. Graphiti/FalkorDB are derived state only. Reads begin in shadow. Official CRM/knowledge authority always outranks graph inference for protected domains.

**Tech Stack:** TypeScript adapter, Graphiti REST service (`zepai/graphiti:0.22.1` as the initially validated upstream image; re-verify before implementation), FalkorDB (`falkordb/falkordb-server:v4.20.1-alpine` as the initially validated image; re-verify compatibility before implementation), Docker Compose, existing event_log/ledger, Vitest.

## Global Constraints

- Phase 3 gate must be `GO`.
- Graphiti starts `OFF`, then `SHADOW`.
- No graph result can authorize HIGH-risk action.
- `group_id` is generated inside trusted adapter from `organization_id`; never caller supplied.
- No public Graphiti/FalkorDB port in production.
- Do not ingest secrets/raw credentials.
- Prefer curated/sanitized official event text over arbitrary DB dumps.

---

### Task 1: Define GraphContextPort and graph result contract

**Files:**
- Create: `lib/agent-engine/graph/port.ts`
- Create: `lib/agent-engine/graph/port.test.ts`
- Create: `lib/agent-engine/graph/types.ts`

**Interfaces:**

```ts
export interface GraphEpisode {
  organizationId: string;
  sourceId: string;
  sourceVersion: string;
  name: string;
  body: string;
  sourceType: "message" | "text" | "json";
  sourceDescription: string;
  referenceTime: string;
}

export interface GraphFact {
  id: string;
  text: string;
  sourceId: string;
  validFrom: string | null;
  validUntil: string | null;
  confidence: number;
  authorityDomain: AuthorityDomain;
  risk: MemoryRisk;
}

export interface GraphContextPort {
  addEpisode(episode: GraphEpisode, idempotencyKey: string): Promise<void>;
  search(input: { organizationId: string; query: string; limit: number }): Promise<GraphFact[]>;
  deleteOrganization(organizationId: string): Promise<void>;
  health(): Promise<{ ok: boolean; latencyMs: number }>;
}
```

- [ ] **Step 1: Write strict contract tests**
- [ ] **Step 2: Implement `NullGraphContextPort`**
- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/graph/port.test.ts
pnpm typecheck
git add lib/agent-engine/graph
git commit -m "feat(graph): add temporal graph port"
```

---

### Task 2: Add deterministic tenant namespace helper

**Files:**
- Create: `lib/agent-engine/graph/namespace.ts`
- Create: `lib/agent-engine/graph/namespace.test.ts`

**Interfaces:**

```ts
export function graphGroupId(organizationId: string): string {
  return `org:${organizationId}`;
}
```

- [ ] **Step 1: Write tests**

Reject malformed UUIDs before namespace generation. Verify org A/B never produce same value. No human name/email/phone in namespace.

- [ ] **Step 2: Implement helper**
- [ ] **Step 3: Commit**

```bash
git add lib/agent-engine/graph/namespace.ts lib/agent-engine/graph/namespace.test.ts
git commit -m "feat(graph): isolate graph namespaces per tenant"
```

---

### Task 3: Add Graphiti/FalkorDB optional compose profile

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `lib/env.ts`
- Create: `docs/runbooks/graphiti.md`

**Interfaces:**

Environment:

```text
GRAPHITI_BASE_URL
GRAPHITI_API_KEY
GRAPHITI_TIMEOUT_MS
GRAPHITI_LLM_PROVIDER
GRAPHITI_LLM_MODEL
GRAPHITI_EMBEDDER_PROVIDER
GRAPHITI_EMBEDDER_MODEL
```

- [ ] **Step 1: Add compose profile `ai-graph`**

Services:

- `falkordb` pinned compatible tag, persistent volume, internal network, healthcheck;
- `graphiti` pinned stable tag, internal network, depends on FalkorDB, healthcheck;
- do not expose browser/dashboard via Caddy.

- [ ] **Step 2: Configure conservative ingestion concurrency**

Start with low Graphiti concurrency because each episode can cause multiple LLM calls. Make it an env knob; default low for self-host safety.

- [ ] **Step 3: Reuse approved AI provider strategy without exposing tenant BYOK blindly**

For the first graph service, use a platform-owned provider credential delivered via Infisical/runtime env. Do not export arbitrary tenant API keys to the Python service. If per-tenant BYOK becomes a requirement later, create a scoped credential broker instead of sharing the database encryption key.

- [ ] **Step 4: Validate compose**

```bash
docker compose -f docker-compose.prod.yml config
docker compose config
```

- [ ] **Step 5: Document startup, health, persistence, backup, wipe and rebuild**
- [ ] **Step 6: Commit**

```bash
git add docker-compose.prod.yml docker-compose.yml .env.example lib/env.ts docs/runbooks/graphiti.md
git commit -m "ops(graph): add optional Graphiti and FalkorDB profile"
```

---

### Task 4: Implement Graphiti REST adapter

**Files:**
- Create: `lib/agent-engine/graph/graphiti-client.ts`
- Create: `lib/agent-engine/graph/graphiti-client.test.ts`

**Interfaces:**
- Implements `GraphContextPort`.

- [ ] **Step 1: Inspect pinned Graphiti OpenAPI before coding**

Start container locally and save no generated API artifact in repo unless needed. Confirm actual add-episode/search/group-management endpoints for the pinned image.

- [ ] **Step 2: Write HTTP contract tests with mocked fetch**

Prove:

- every add/search carries trusted `group_id`;
- timeout aborts;
- auth key does not leak;
- response schema is validated;
- unsupported/invalid result becomes degraded empty context, not high-authority data;
- no cross-group search request can be constructed through public adapter input.

- [ ] **Step 3: Implement adapter with `AbortController`**

No unbounded retry on synchronous search. Write retries remain event/ledger responsibility.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/graph/graphiti-client.test.ts
pnpm typecheck
pnpm lint
git add lib/agent-engine/graph/graphiti-client.ts lib/agent-engine/graph/graphiti-client.test.ts
git commit -m "feat(graph): add Graphiti REST adapter"
```

---

### Task 5: Add graph episode sanitizer and authority mapper

**Files:**
- Create: `lib/agent-engine/graph/episode-sanitize.ts`
- Create: `lib/agent-engine/graph/episode-sanitize.test.ts`
- Create: `lib/agent-engine/graph/fact-map.ts`
- Create: `lib/agent-engine/graph/fact-map.test.ts`

**Interfaces:**
- `sanitizeGraphEpisode()` removes/blocks secrets before egress.
- `mapGraphFact()` assigns conservative authority/risk.

- [ ] **Step 1: Write tests**

Graph-inferred consent/payment/contract facts must map `risk:high` and never `actionable`. Customer preference/relationship may map lower risk but still derived authority.

- [ ] **Step 2: Implement deterministic mapping**

Graphiti confidence/relevance score never overrides protected authority domain.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/graph/episode-sanitize.test.ts lib/agent-engine/graph/fact-map.test.ts
pnpm typecheck
git add lib/agent-engine/graph/episode-sanitize.ts lib/agent-engine/graph/episode-sanitize.test.ts lib/agent-engine/graph/fact-map.ts lib/agent-engine/graph/fact-map.test.ts
git commit -m "feat(graph): sanitize episodes and constrain graph authority"
```

---

### Task 6: Project selected official events into Graphiti

**Files:**
- Create: `workers/graph-projection.handler.ts`
- Create: `workers/graph-projection.handler.test.ts`
- Modify: `lib/event-log/register-handlers.ts`

**Interfaces:**
- Consumer key: `graph_projection_v1`.

Initial event allowlist:

- inbound/outbound message event needed for relationship history;
- `lead.stage_changed` when event contract exists and is official;
- selected contact/company/product relationship updates already represented by stable events.

- [ ] **Step 1: Write handler tests**

Feature off skipped; shadow writes allowed; trusted source fetch; sanitizer before external call; ledger idempotency; retry on Graphiti outage; no raw error payload; old source version cannot overwrite newer ledger state.

- [ ] **Step 2: Implement one event type first (`message.received`)**

Run tests green before adding next event type. Each additional event gets a specific test.

- [ ] **Step 3: Use Graphiti episode provenance**

Episode name includes stable source id, not phone/name; reference time comes from official event/message timestamp.

- [ ] **Step 4: Register handler and verify**

```bash
pnpm vitest run workers/graph-projection.handler.test.ts
pnpm test:unit
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add workers/graph-projection.handler.ts workers/graph-projection.handler.test.ts lib/event-log/register-handlers.ts
git commit -m "feat(graph): project official CRM events into Graphiti"
```

---

### Task 7: Add Graphiti context provider in shadow mode

**Files:**
- Create: `lib/agent-engine/context/graphiti-context-provider.ts`
- Create: `lib/agent-engine/context/graphiti-context-provider.test.ts`
- Modify: context provider registry from Phase 2.

**Interfaces:**
- Implements `ContextProvider`.

- [ ] **Step 1: Write tests**

- off => no HTTP;
- shadow => retrieval/metrics only;
- canary/on => facts eligible for fusion;
- timeout => empty degraded result;
- high-risk fact marked non-actionable;
- query scoped to exact group.

- [ ] **Step 2: Implement provider**

Cap result count and text length. Do not pass full transcript as search query; use current user intent/query and minimal context.

- [ ] **Step 3: Integrate with existing parallel context retrieval**

Do not serialize Mem0 then Graphiti; run optional providers concurrently.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/context/graphiti-context-provider.test.ts lib/agent-engine/context/fusion.test.ts
pnpm typecheck
git add lib/agent-engine/context/graphiti-context-provider.ts lib/agent-engine/context/graphiti-context-provider.test.ts <registry-file>
git commit -m "feat(graph): retrieve Graphiti context behind rollout mode"
```

---

### Task 8: Add Graphiti lifecycle, tenant purge and rebuild

**Files:**
- Create: `workers/graph-lifecycle.handler.ts`
- Create: `workers/graph-lifecycle.handler.test.ts`
- Create: `scripts/rebuild-graphiti.ts`
- Create: `tests/unit/rebuild-graphiti.test.ts`
- Modify: `lib/event-log/register-handlers.ts`
- Create: `docs/runbooks/graphiti-rebuild.md`

**Interfaces:**
- Tenant-scoped purge/rebuild by default.

- [ ] **Step 1: Write purge/rebuild tests**

Prove org A purge never touches B; replay stable; duplicate replay no duplicates; delayed pre-delete event cannot resurrect stale graph without a valid new source version.

- [ ] **Step 2: Implement lifecycle handler**

Use official LGPD/org deletion events only.

- [ ] **Step 3: Implement rebuild script**

Sequence: kill/read off -> purge tenant group -> reset/rebuild ledger -> replay selected official sources -> compare counts -> leave mode shadow until explicit promotion.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run workers/graph-lifecycle.handler.test.ts tests/unit/rebuild-graphiti.test.ts
pnpm test:unit
pnpm test:db
git add workers/graph-lifecycle.handler.ts workers/graph-lifecycle.handler.test.ts scripts/rebuild-graphiti.ts tests/unit/rebuild-graphiti.test.ts lib/event-log/register-handlers.ts docs/runbooks/graphiti-rebuild.md
git commit -m "feat(graph): add Graphiti lifecycle and rebuild"
```

---

### Task 9: Add temporal graph Golden Dataset cases

**Files:**
- Extend: `tests/fixtures/ai-platform/golden-cases.json`
- Create: `tests/unit/graph-context-golden.test.ts`

- [ ] **Step 1: Add synthetic temporal cases**

- stakeholder A influenced deal before stakeholder B;
- preference changed over time;
- old product relationship expired;
- graph contradicts CRM official stage;
- same names across two orgs remain isolated;
- graph contains prompt-like text but cannot alter policy.

- [ ] **Step 2: Verify**

```bash
pnpm vitest run tests/unit/graph-context-golden.test.ts
pnpm ai:eval:local
```

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/ai-platform/golden-cases.json tests/unit/graph-context-golden.test.ts
git commit -m "test(graph): add temporal graph evaluation cases"
```

---

### Task 10: Phase 4 release gate

**Files:**
- Create: `docs/evidence/ai-platform/phase-4-graphiti-gate.md`

- [ ] **Step 1: Validate compose and pinned image compatibility**
- [ ] **Step 2: Build Graphiti indices/constraints on empty synthetic graph**
- [ ] **Step 3: Project/search/purge/rebuild one synthetic tenant**
- [ ] **Step 4: Prove cross-tenant isolation with two group IDs**
- [ ] **Step 5: Simulate Graphiti/FalkorDB outage and confirm agent core works**
- [ ] **Step 6: Run full gate**

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

- [ ] **Step 7: Default decision**

End Phase 4 at `SHADOW` unless canary gates are explicitly met and approved. Do not set global `ON` as part of implementation.

- [ ] **Step 8: Commit evidence**

```bash
git add docs/evidence/ai-platform/phase-4-graphiti-gate.md
git commit -m "docs(ai-platform): record Graphiti release gate"
```
