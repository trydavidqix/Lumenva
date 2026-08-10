# AI Platform Phase 5 — External Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional external validation layer that closes measured AI safety/quality gaps without replacing the CRM’s deterministic guardrails.

**Architecture:** Native `runBeforeSend` and existing deterministic policy remain authoritative. A generic `ExternalGuardrailPort` can validate selected inputs/outputs. The first provider is a self-hosted Guardrails AI server, feature-flagged and kill-switchable. External validator outage degrades to native gates except where an explicitly configured non-native validator is classified critical.

**Tech Stack:** TypeScript adapter, Guardrails AI standalone REST server (`guardrails-ai` v0.10.x line initially validated; pin/re-verify before implementation), Docker profile, existing guardrails, Vitest, Golden Dataset.

## Global Constraints

- Do not begin until a Phase 1–4 evaluation identifies a concrete gap worth solving.
- Do not migrate STOP, LGPD, WhatsApp-window, anti-ban, promise/handoff/disclosure authority out of native code.
- External guardrail receives sanitized/minimized data.
- Feature starts `OFF`, then `SHADOW`.
- No remote paid inference/model download without explicit approval.

---

### Task 1: Produce a guardrail gap report before installing anything

**Files:**
- Create: `docs/evidence/ai-platform/guardrails-gap-analysis.md`

- [ ] **Step 1: Run Golden Dataset against native gates**

```bash
pnpm ai:eval:local
pnpm test:unit
```

- [ ] **Step 2: Classify failures**

For each real failure record:

- case id;
- native gate that should have caught it, if any;
- why deterministic fix is/not preferable;
- candidate external validator;
- false-positive risk;
- criticality.

- [ ] **Step 3: Decision**

If all target gaps are better solved deterministically, document `NO EXTERNAL VALIDATOR NEEDED` and keep provider `OFF`. The architecture task can still add the port, but do not deploy a redundant Python service.

- [ ] **Step 4: Commit**

```bash
git add docs/evidence/ai-platform/guardrails-gap-analysis.md
git commit -m "docs(guardrails): record external validation gap analysis"
```

---

### Task 2: Add external guardrail port

**Files:**
- Create: `lib/agent-engine/guardrails/external/port.ts`
- Create: `lib/agent-engine/guardrails/external/port.test.ts`

**Interfaces:**

```ts
export interface ExternalGuardrailRequest {
  organizationId: string;
  direction: "input" | "output";
  text: string;
  policy: string;
}

export interface ExternalGuardrailResult {
  passed: boolean;
  code: string;
  severity: "advisory" | "blocking";
  sanitizedText?: string;
  latencyMs: number;
}

export interface ExternalGuardrailPort {
  validate(input: ExternalGuardrailRequest): Promise<ExternalGuardrailResult>;
}
```

Provide `NoopExternalGuardrailPort`.

- [ ] **Step 1: Write tests**
- [ ] **Step 2: Implement strict types/noop adapter**
- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/guardrails/external/port.test.ts
pnpm typecheck
git add lib/agent-engine/guardrails/external
git commit -m "feat(guardrails): add external validation port"
```

---

### Task 3: Add external-guardrail data minimization

**Files:**
- Create: `lib/agent-engine/guardrails/external/sanitize.ts`
- Create: `lib/agent-engine/guardrails/external/sanitize.test.ts`

- [ ] **Step 1: Write tests**

Never send bearer/cookie/API key/password. For output-content validation, strip metadata not needed by validator. Tenant id becomes opaque service metadata, not part of validated text.

- [ ] **Step 2: Implement sanitizer using the shared deterministic patterns where possible**

Do not create divergent secret rules; extract/reuse common primitives if Phase 1/2 already introduced them.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/guardrails/external/sanitize.test.ts
pnpm typecheck
git add lib/agent-engine/guardrails/external/sanitize.ts lib/agent-engine/guardrails/external/sanitize.test.ts
git commit -m "feat(guardrails): minimize data sent to external validators"
```

---

### Task 4: Add Guardrails AI REST adapter

**Files:**
- Create: `lib/agent-engine/guardrails/external/guardrails-ai-client.ts`
- Create: `lib/agent-engine/guardrails/external/guardrails-ai-client.test.ts`
- Modify: `lib/env.ts`
- Modify: `.env.example`

**Interfaces:**

Environment:

```text
GUARDRAILS_AI_BASE_URL
GUARDRAILS_AI_API_KEY
GUARDRAILS_AI_TIMEOUT_MS
```

- [ ] **Step 1: Write mocked HTTP tests**

Prove timeout, auth header secrecy, strict response parsing, blocking/advisory mapping, server 500 degradation, and feature off no network.

- [ ] **Step 2: Implement client**

Call only explicitly configured guard names. Never let model/user choose arbitrary server guard names.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/guardrails/external/guardrails-ai-client.test.ts
pnpm typecheck
pnpm lint
git add lib/agent-engine/guardrails/external/guardrails-ai-client.ts lib/agent-engine/guardrails/external/guardrails-ai-client.test.ts lib/env.ts .env.example
git commit -m "feat(guardrails): add optional Guardrails AI client"
```

---

### Task 5: Add optional self-hosted Guardrails service only if gap report justifies it

**Files:**
- Create: `services/guardrails/config.py`
- Create: `services/guardrails/requirements.txt`
- Create: `services/guardrails/Dockerfile`
- Modify: `docker-compose.prod.yml`
- Modify: `docker-compose.yml`
- Create: `docs/runbooks/external-guardrails.md`

- [ ] **Step 1: Pin `guardrails-ai` and exact validators selected by the gap report**

No “install every validator”. Each validator must map to a failing test case.

- [ ] **Step 2: Define named guards in config**

Examples of acceptable names:

- `output-secret-check`;
- `output-schema-check`;
- `input-prompt-injection-check` only if the selected validator was measured and accepted.

Do not duplicate STOP/LGPD policy.

- [ ] **Step 3: Add compose profile `ai-guardrails`**

Internal network only, healthcheck, no Caddy exposure.

- [ ] **Step 4: Validate**

```bash
docker compose -f docker-compose.prod.yml config
docker compose config
```

- [ ] **Step 5: Commit**

```bash
git add services/guardrails docker-compose.prod.yml docker-compose.yml docs/runbooks/external-guardrails.md
git commit -m "ops(guardrails): add optional self-hosted validation service"
```

If gap report says no external service is needed, skip this Task 5 with evidence referencing the gap report; do not fabricate a use case.

---

### Task 6: Integrate external validation around, never instead of, native guardrails

**Files:**
- Modify: `lib/agent-engine/guardrails/before-send.ts`
- Create/modify focused tests for before-send integration.

**Interfaces:**

Order:

```text
candidate response
 -> optional external validation
 -> native deterministic before-send gates
 -> channel adapter
```

For critical native rules the native result always wins.

- [ ] **Step 1: Write integration tests**

Cases:

- feature off => exact native behavior;
- shadow => external result recorded but cannot block/modify;
- canary/on advisory => native continues with metadata;
- configured external blocking rule can block only its declared category;
- external timeout => native guardrails run;
- native STOP block cannot be overridden by external pass;
- native promise/LGPD block cannot be overridden.

- [ ] **Step 2: Implement smallest integration seam**

Do not move existing native checks into the external adapter.

- [ ] **Step 3: Verify and commit**

```bash
pnpm test:unit
pnpm typecheck
pnpm lint
git add lib/agent-engine/guardrails/before-send.ts <tests>
git commit -m "feat(guardrails): layer optional validators before native gates"
```

---

### Task 7: Add false-positive and outage evaluation

**Files:**
- Extend: `tests/fixtures/ai-platform/golden-cases.json`
- Create: `tests/unit/external-guardrails-golden.test.ts`

- [ ] **Step 1: Add positive and negative examples per selected validator**

Every blocking validator needs at least 10 pass and 10 fail synthetic examples so obvious false positives are visible.

- [ ] **Step 2: Add outage cases**

401/429/500/timeout must not bypass native gates or crash the turn.

- [ ] **Step 3: Verify**

```bash
pnpm vitest run tests/unit/external-guardrails-golden.test.ts
pnpm ai:eval:local
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/ai-platform/golden-cases.json tests/unit/external-guardrails-golden.test.ts
git commit -m "test(guardrails): evaluate optional validator precision and outages"
```

---

### Task 8: Phase 5 release gate

**Files:**
- Create: `docs/evidence/ai-platform/phase-5-guardrails-gate.md`

- [ ] **Step 1: Show exact gap being improved**
- [ ] **Step 2: Compare native-only vs external-shadow metrics**
- [ ] **Step 3: Prove native rules remain authoritative**
- [ ] **Step 4: Prove external service outage does not stop normal native protection**
- [ ] **Step 5: Run full gate**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db
pnpm ai:eval:local
pnpm build
git diff --check
```

- [ ] **Step 6: Decision**

If false-positive/latency cost is not justified by measurable safety gain, keep external provider `OFF` and record `GO WITHOUT EXTERNAL ACTIVATION`. That is an acceptable successful outcome.

- [ ] **Step 7: Commit evidence**

```bash
git add docs/evidence/ai-platform/phase-5-guardrails-gate.md
git commit -m "docs(ai-platform): record external guardrails gate"
```
