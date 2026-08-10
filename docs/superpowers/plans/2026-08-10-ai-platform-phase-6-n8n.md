# AI Platform Phase 6 — n8n Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate n8n as an optional external automation target/controller while preserving the CRM’s existing `event_log`, automation engine, HMAC outbound webhooks, RBAC/MCP scopes, audit and source-of-truth boundaries.

**Architecture:** n8n never becomes the CRM queue, database or agent runtime. CRM outbound integrations reuse the current `call_webhook` path and anti-SSRF controls. n8n inbound operations use existing scoped bearer/MCP contracts, where the token resolves `organization_id` from `api_tokens`. n8n can be self-hosted separately and disabled without breaking CRM operations.

**Tech Stack:** Existing Deskcomm automation/webhook engine, MCP bearer scopes (`mcp:read`, `mcp:write`), TypeScript, n8n self-hosted OSS/fair-code image, PostgreSQL for n8n internal state, Docker Compose, Vitest/Playwright where applicable.

## Global Constraints

- Phase 5 gate must be resolved; external Guardrails may remain OFF.
- Do not give n8n `SUPABASE_SERVICE_ROLE_KEY`.
- Do not let n8n connect directly to business tables for writes.
- Do not duplicate `event_log` with a new business-critical queue.
- Do not replace existing `call_webhook` anti-SSRF/HMAC logic.
- CRM state is committed before outbound automation is attempted.
- A failed n8n workflow must not roll back already-valid CRM state.
- Do not enable paid/enterprise n8n features without explicit approval.

---

### Task 1: Freeze the integration boundary in tests

**Files:**
- Inspect: `lib/automation/actions/call-webhook.ts`
- Inspect: `lib/automation/outbound-url.ts`
- Inspect: `lib/mcp/auth.ts`
- Create: `tests/unit/n8n-integration-boundary.test.ts`

**Interfaces:**
- CRM -> n8n: existing outbound webhook action.
- n8n -> CRM: existing API/MCP bearer token whose org is resolved from the token row, never request body.

- [ ] **Step 1: Write architecture-invariant tests**

Tests/static assertions must prove:

- outbound n8n delivery passes through `assertSafeOutboundUrl`/canonical outbound action path;
- HMAC signing uses the existing action contract rather than a second signer;
- inbound MCP token derives `organizationId` from `api_tokens`;
- `mcp:write` is required for mutating MCP tools;
- no n8n-specific code imports `lib/supabase/admin` for direct business-table mutation.

- [ ] **Step 2: Run and record current behavior**

```bash
pnpm vitest run tests/unit/n8n-integration-boundary.test.ts
```

- [ ] **Step 3: Commit invariant test before adding n8n-specific code**

```bash
git add tests/unit/n8n-integration-boundary.test.ts
git commit -m "test(n8n): lock CRM integration boundaries"
```

---

### Task 2: Define a canonical n8n integration envelope without creating a second delivery engine

**Files:**
- Create: `lib/automation/n8n/envelope.ts`
- Create: `lib/automation/n8n/envelope.test.ts`

**Interfaces:**

```ts
export interface N8nIntegrationEnvelope {
  event_id: string;
  event_type: string;
  occurred_at: string;
  organization_ref: string;
  idempotency_key: string;
  data: Record<string, unknown>;
}

export function buildN8nEnvelope(input: {
  eventId: string;
  eventType: string;
  occurredAt: string;
  organizationId: string;
  idempotencyKey: string;
  data: Record<string, unknown>;
}): N8nIntegrationEnvelope;
```

`organization_ref` is an opaque deterministic reference used for correlation. It is not accepted back as authority for tenant resolution.

- [ ] **Step 1: Write failing tests**

Prove:

- stable idempotency key survives retries;
- secret-looking fields are removed/rejected before envelope creation;
- raw service-role/internal secrets never serialize;
- empty event/idempotency values are rejected;
- organization reference is opaque and does not include human PII.

- [ ] **Step 2: Implement builder using shared redaction primitives**

Do not copy secret sanitization regexes into a fourth implementation; extract/reuse shared helpers from earlier phases.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/automation/n8n/envelope.test.ts
pnpm typecheck
git add lib/automation/n8n/envelope.ts lib/automation/n8n/envelope.test.ts
git commit -m "feat(n8n): add canonical integration envelope"
```

---

### Task 3: Add an n8n-specific automation action as a thin wrapper over `call_webhook`

**Files:**
- Create: `lib/automation/actions/n8n-webhook.ts`
- Create: `lib/automation/actions/n8n-webhook.test.ts`
- Modify: canonical automation action registry/schema file located during implementation.
- Modify relevant automation UI labels only if the action is exposed in UI.

**Interfaces:**

Config:

```ts
export const n8nWebhookConfigSchema = z.strictObject({
  url: z.string().url(),
  secret: z.string().min(16),
  workflow_key: z.string().min(1).max(120),
});
```

The executor builds `N8nIntegrationEnvelope` and delegates transport, timeout, HMAC/anti-SSRF/retry semantics to the canonical outbound webhook implementation.

- [ ] **Step 1: Write tests**

Cases:

- private/localhost URL blocked by existing anti-SSRF guard according to environment rules;
- `http` rejected in production;
- envelope is signed by canonical path;
- 2xx success recorded once;
- 500/timeout returns retryable delivery result;
- duplicate event/idempotency input does not invent a new key;
- workflow secret never appears in action result/log.

- [ ] **Step 2: Implement thin wrapper**

Do not copy HTTP fetch/backoff logic from `call-webhook.ts`. If current action cannot be reused cleanly, extract a shared internal transport first with regression tests and have both actions call it.

- [ ] **Step 3: Add action registration**

Only add UI exposure if existing automation builder supports the action without large unrelated redesign. Otherwise keep it API/config-level and document UI as later product work.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run lib/automation/actions/n8n-webhook.test.ts
pnpm test:unit
pnpm typecheck
pnpm lint
git add lib/automation/actions/n8n-webhook.ts lib/automation/actions/n8n-webhook.test.ts <registry-files>
git commit -m "feat(n8n): route n8n delivery through existing webhook engine"
```

---

### Task 4: Add least-privilege n8n token provisioning runbook and scope tests

**Files:**
- Create: `docs/runbooks/n8n-token.md`
- Create: `tests/unit/n8n-mcp-scope.test.ts`
- Modify MCP tool catalog only if a concrete required operation lacks a scoped tool.

**Interfaces:**

Recommended n8n bearer scopes:

```text
mcp:read
mcp:write          # only if workflow genuinely mutates CRM
role:agent         # default for limited operations
```

Use `role:manager` only for workflows whose required tool explicitly requires it. Never use `role:admin` as a convenience default.

- [ ] **Step 1: Write scope tests**

Prove read-only token cannot call write tool; write token cannot exceed role guard; token for org A cannot act on org B even if payload carries org B ID.

- [ ] **Step 2: Document provisioning**

Document existing UI/API flow for generating `api_tokens`, one-time plaintext handling, expiration/revocation, scopes and storage in Infisical/n8n credentials. Do not paste any real token.

- [ ] **Step 3: Add only missing minimal MCP tool if pilot integration requires it**

Use existing MCP conventions: scope + role + tenant from token + audit. Do not add generic SQL/query tool.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/unit/n8n-mcp-scope.test.ts
pnpm test:unit
pnpm typecheck
git add docs/runbooks/n8n-token.md tests/unit/n8n-mcp-scope.test.ts <optional-mcp-files>
git commit -m "docs(n8n): define least-privilege CRM token contract"
```

---

### Task 5: Add optional standalone n8n self-host stack

**Files:**
- Create: `ops/n8n/docker-compose.yml`
- Create: `ops/n8n/.env.example`
- Create: `docs/runbooks/n8n.md`

**Interfaces:**
- n8n stack is operationally separate from core `docker-compose.prod.yml`.
- n8n internal PostgreSQL is not CRM PostgreSQL.

- [ ] **Step 1: Re-verify current stable n8n image before pinning**

The planning-time candidate was `n8nio/n8n:2.32.6`; Codex must check official n8n release/container metadata at implementation time and pin an exact compatible stable tag. Do not use `latest` in production compose.

- [ ] **Step 2: Create standalone compose**

Services:

- `n8n` exact pinned tag;
- dedicated `postgres` exact major/tag;
- persistent volumes;
- restart policy;
- healthcheck;
- no CRM service-role env;
- execution/data encryption key loaded from runtime env/Infisical;
- secure editor URL configuration.

Do not put this service into core CRM startup dependency chain.

- [ ] **Step 3: Network/public exposure**

The editor must not be anonymously exposed. If webhook endpoints require public access, expose through a dedicated HTTPS hostname/reverse proxy with n8n’s recommended production proxy settings. Editor authentication/access control remains protected. Do not reuse WAHA public hostname.

- [ ] **Step 4: Add `.env.example` containing names only/placeholders**

No real credential. Include DB credentials, `N8N_ENCRYPTION_KEY`, host/protocol/webhook URL and timezone as documented values.

- [ ] **Step 5: Document backup/restore/update/security audit**

Runbook includes:

```bash
n8n audit
```

or the container-equivalent official command, and explains credentials, workflows, database backup, upgrade rollback and how to completely disconnect CRM tokens.

- [ ] **Step 6: Validate compose**

```bash
docker compose -f ops/n8n/docker-compose.yml --env-file ops/n8n/.env.example config
```

If n8n refuses placeholder values at config rendering, use a temporary local env not committed.

- [ ] **Step 7: Commit**

```bash
git add ops/n8n/docker-compose.yml ops/n8n/.env.example docs/runbooks/n8n.md
git commit -m "ops(n8n): add optional standalone self-host stack"
```

---

### Task 6: Build one reference CRM -> n8n workflow contract

**Files:**
- Create: `docs/examples/n8n/crm-lead-created.json` only if export contains no credentials/internal instance IDs; otherwise create `docs/examples/n8n/crm-lead-created.md` with node-by-node reconstruction.
- Create: `tests/unit/n8n-reference-workflow.test.ts`

**Interfaces:**

Pilot:

```text
CRM lead.created
 -> automation rule
 -> n8n_webhook / call_webhook
 -> n8n Webhook trigger
 -> validate HMAC/idempotency
 -> example external side effect (mock/test target)
```

- [ ] **Step 1: Build workflow only against synthetic/mock external target**

Do not send real e-mail/message/customer data in the committed reference workflow.

- [ ] **Step 2: Verify signed payload and stable idempotency header/body**

- [ ] **Step 3: Verify retry does not duplicate mock side effect**

Use workflow logic or external API idempotency where supported. If a target lacks idempotency, add n8n-side durable deduplication for the reference workflow using a supported persistent store, not process memory.

- [ ] **Step 4: Sanitize export before commit**

No credential IDs, execution payloads, real webhook secrets or production URLs.

- [ ] **Step 5: Commit**

```bash
git add docs/examples/n8n tests/unit/n8n-reference-workflow.test.ts
git commit -m "docs(n8n): add safe reference outbound workflow"
```

---

### Task 7: Build one reference n8n -> CRM scoped action

**Files:**
- Create: `docs/examples/n8n/crm-read-write.md`
- Create: `tests/unit/n8n-inbound-contract.test.ts`

**Interfaces:**

Pilot calls `/api/mcp` or an existing scoped `/api/v1` endpoint with:

```http
Authorization: Bearer dsk_<one-time-token>
Content-Type: application/json
```

No `organization_id` is trusted from n8n payload for authorization.

- [ ] **Step 1: Select one existing safe MCP read tool and one scoped write tool**

Do not add broad generic tool.

- [ ] **Step 2: Test revoked/expired/wrong-scope token**

Each must fail closed.

- [ ] **Step 3: Test forged tenant ID**

Payload attempts to reference another org; operation must remain token-org scoped or fail.

- [ ] **Step 4: Document exact credential setup without real secret**

- [ ] **Step 5: Commit**

```bash
git add docs/examples/n8n/crm-read-write.md tests/unit/n8n-inbound-contract.test.ts
git commit -m "test(n8n): prove scoped inbound CRM operations"
```

---

### Task 8: Add n8n outage, retry and duplicate-delivery tests

**Files:**
- Extend: `tests/fixtures/ai-platform/golden-cases.json`
- Create: `tests/unit/n8n-failure-golden.test.ts`

- [ ] **Step 1: Add cases**

- n8n 500;
- timeout;
- webhook delivered twice;
- retry after worker/process restart;
- invalid HMAC;
- revoked CRM token;
- n8n attempts cross-tenant write;
- n8n unavailable while CRM state transition succeeds.

- [ ] **Step 2: Assert CRM semantics**

Business state remains correct; delivery failure is observable/retryable; no duplicate externally visible side effect in idempotent reference path.

- [ ] **Step 3: Verify**

```bash
pnpm vitest run tests/unit/n8n-failure-golden.test.ts
pnpm ai:eval:local
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/ai-platform/golden-cases.json tests/unit/n8n-failure-golden.test.ts
git commit -m "test(n8n): cover delivery failures and tenant boundaries"
```

---

### Task 9: Phase 6 release gate

**Files:**
- Create: `docs/evidence/ai-platform/phase-6-n8n-gate.md`

- [ ] **Step 1: Run n8n security audit against local synthetic instance**

Record aggregate findings only; resolve high-risk credential/webhook findings before GO.

- [ ] **Step 2: Prove CRM -> n8n path**

Synthetic event, HMAC valid, external mock called once.

- [ ] **Step 3: Prove n8n -> CRM path**

Scoped token, allowed tool succeeds; wrong scope/revoked/cross-tenant fail.

- [ ] **Step 4: Kill n8n and prove CRM core continues**

Outbound becomes retry/failure evidence; no rollback of valid CRM state.

- [ ] **Step 5: Run full CRM gate**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db
pnpm ai:eval:local
pnpm build
git diff --check
```

- [ ] **Step 6: Record GO/NO-GO**

Global feature remains `OFF` or `CANARY`; do not auto-enable n8n for all tenants.

- [ ] **Step 7: Commit evidence**

```bash
git add docs/evidence/ai-platform/phase-6-n8n-gate.md
git commit -m "docs(ai-platform): record n8n release gate"
```
