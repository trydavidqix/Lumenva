# AI Platform Phase 1 — LangSmith Observability & Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add redacted, best-effort LangSmith tracing and repeatable AI evaluations before any new memory/graph provider can influence the agent.

**Architecture:** Instrument the existing LLM seam and agent-turn boundaries through a small observability adapter. LangSmith is optional and feature-flagged. All data is sanitized before leaving the CRM process. Sentry remains unchanged for application errors.

**Tech Stack:** TypeScript, `langsmith` JS/TS SDK, existing `runModelCall`, existing logger/Sentry, Vitest, Golden Dataset from Phase 0.

## Global Constraints

- Phase 0 gate must be `GO`.
- LangSmith must never become required for agent execution.
- Do not send secrets, raw authorization headers, cookies, API keys or unnecessary PII.
- No paid upgrade without human approval.
- `langsmith` feature starts `OFF`, then `SHADOW` only.

---

### Task 1: Add LangSmith SDK and environment contract

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `lib/env.ts`
- Modify: `.env.example`
- Create: `lib/agent-engine/obs/external-tracing-config.ts`
- Create: `lib/agent-engine/obs/external-tracing-config.test.ts`

**Interfaces:**
- Produces `resolveExternalTracingConfig()` returning disabled config unless feature/env are valid.

- [ ] **Step 1: Add failing config tests**

Cases:

- missing API key => disabled;
- kill switch => disabled;
- feature `off` => disabled;
- feature `shadow|canary|on` plus API key => enabled;
- invalid endpoint => disabled/fail-safe, never boot failure unless explicitly chosen by current env doctrine.

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm vitest run lib/agent-engine/obs/external-tracing-config.test.ts
```

- [ ] **Step 3: Add dependency**

```bash
pnpm add langsmith
```

- [ ] **Step 4: Add env schema**

Add optional:

```text
LANGSMITH_API_KEY
LANGSMITH_ENDPOINT
LANGSMITH_PROJECT
LANGSMITH_WORKSPACE_ID
```

Do not set `LANGSMITH_TRACING=true` globally as the only gate; our feature resolver must remain authoritative.

- [ ] **Step 5: Implement config resolver**

Read feature mode through Phase 0 feature resolver and return opaque config; never log the key.

- [ ] **Step 6: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/obs/external-tracing-config.test.ts
pnpm typecheck
pnpm lint
git add package.json pnpm-lock.yaml lib/env.ts .env.example lib/agent-engine/obs/external-tracing-config.ts lib/agent-engine/obs/external-tracing-config.test.ts
git commit -m "feat(ai-observability): add optional LangSmith configuration"
```

---

### Task 2: Build redaction boundary before external telemetry

**Files:**
- Create: `lib/agent-engine/obs/external-redaction.ts`
- Create: `lib/agent-engine/obs/external-redaction.test.ts`

**Interfaces:**
- Produces:

```ts
sanitizeExternalTraceValue(value: unknown): unknown;
opaqueTenantId(organizationId: string): string;
```

- [ ] **Step 1: Write tests for recursive redaction**

Must cover:

- `Authorization`/bearer;
- `cookie`/`set-cookie`;
- keys containing `api_key`, `apikey`, `token`, `secret`, `password`;
- JWT-like values;
- e-mail masking;
- phone masking;
- nested arrays/objects;
- circular/unserializable input handled without throwing;
- ordinary product text remains readable.

- [ ] **Step 2: Run tests and see failure**

```bash
pnpm vitest run lib/agent-engine/obs/external-redaction.test.ts
```

- [ ] **Step 3: Implement deterministic sanitizer**

Never call an LLM to decide whether a secret is sensitive. Use deterministic key/value patterns and size caps.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/obs/external-redaction.test.ts
pnpm typecheck
git add lib/agent-engine/obs/external-redaction.ts lib/agent-engine/obs/external-redaction.test.ts
git commit -m "feat(ai-observability): sanitize external traces"
```

---

### Task 3: Add an observability port and LangSmith adapter

**Files:**
- Create: `lib/agent-engine/obs/ai-tracing.ts`
- Create: `lib/agent-engine/obs/ai-tracing.test.ts`
- Create: `lib/agent-engine/obs/langsmith-adapter.ts`
- Create: `lib/agent-engine/obs/langsmith-adapter.test.ts`

**Interfaces:**

```ts
export interface AiTraceSpan {
  end(input: { output?: unknown; error?: unknown; metrics?: Record<string, number> }): Promise<void>;
}

export interface AiTracer {
  startSpan(input: {
    name: string;
    runId: string;
    organizationId: string;
    metadata?: Record<string, unknown>;
    input?: unknown;
  }): Promise<AiTraceSpan>;
}
```

Provide `NoopAiTracer` and `LangSmithAiTracer`.

- [ ] **Step 1: Write behavior tests**

Prove `Noop` never throws, LangSmith adapter sanitizes before client call, adapter client failure is swallowed into structured warning, and no API key is present in logger fields.

- [ ] **Step 2: Implement port/adapters**

Use LangSmith SDK in background/batched mode where SDK supports it. External failure is best-effort.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run lib/agent-engine/obs/ai-tracing.test.ts lib/agent-engine/obs/langsmith-adapter.test.ts
pnpm typecheck
git add lib/agent-engine/obs/ai-tracing.ts lib/agent-engine/obs/ai-tracing.test.ts lib/agent-engine/obs/langsmith-adapter.ts lib/agent-engine/obs/langsmith-adapter.test.ts
git commit -m "feat(ai-observability): add tracing port and LangSmith adapter"
```

---

### Task 4: Instrument the single LLM seam

**Files:**
- Modify: `lib/agent-engine/edge/llm/run-model-call.ts`
- Modify/create test beside the existing LLM seam test files.

**Interfaces:**
- `RunModelCallDeps` gains optional `tracer?: AiTracer`.

- [ ] **Step 1: Add regression test**

Inject fake tracer. Assert one span per model call with metadata:

- purpose;
- opaque organization id;
- jobId/run correlation when present;
- provider/model only after resolution;
- latency/tokens/cost in metrics;
- sanitized prompt/messages only when tracing mode explicitly permits content; default metadata-first behavior must not export full raw prompt.

- [ ] **Step 2: Run test and verify failure**

- [ ] **Step 3: Implement minimal instrumentation**

Span start must not happen before secrets/config are safely resolved if that would serialize credentials. Never include `config.apiKey`.

- [ ] **Step 4: Simulate tracer failure**

Fake tracer throws on start/end; `runModelCall` must still reach model fake and return result.

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck
pnpm test:unit
git add lib/agent-engine/edge/llm/run-model-call.ts <tests>
git commit -m "feat(ai-observability): trace LLM seam without affecting execution"
```

---

### Task 5: Instrument agent-turn and retrieval milestones

**Files:**
- Modify: `lib/agent-engine/agent/inbound-turn.ts`
- Modify: `lib/agent-engine/agent/search-knowledge.ts`
- Create/modify focused tests for trace metadata only.

**Interfaces:**
- Parent run metadata correlates child LLM/retrieval spans by `runId`/`jobId`.

- [ ] **Step 1: Add tests for parent lifecycle**

Start one agent-turn span; retrieval tool can emit child metadata; error path closes span with redacted error code, not full PII-bearing error string.

- [ ] **Step 2: Implement instrumentation with smallest possible edit to `inbound-turn.ts`**

Do not refactor agent behavior. Do not change prompts/tool definitions.

- [ ] **Step 3: Verify behavior-preservation tests**

Run existing agent-engine tests plus new tracing tests.

- [ ] **Step 4: Commit**

```bash
git add lib/agent-engine/agent/inbound-turn.ts lib/agent-engine/agent/search-knowledge.ts <tests>
git commit -m "feat(ai-observability): trace agent turns and retrieval"
```

---

### Task 6: Add LangSmith-compatible offline evaluation runner

**Files:**
- Create: `scripts/ai-platform-eval-langsmith.ts`
- Create: `tests/unit/ai-platform-eval-langsmith.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `pnpm ai:eval:langsmith`.

- [ ] **Step 1: Write unit tests with fake LangSmith client**

Prove dataset examples are synthetic, IDs stable, evaluator output keys stable, and no network call happens in unit tests.

- [ ] **Step 2: Implement runner**

Use `golden-cases.json`. Deterministic evaluators first:

- tenant isolation marker;
- required/forbidden content;
- authority domain correctness;
- risk correctness;
- secret redaction;
- fallback behavior.

LLM-as-judge evaluators are optional and must not run unless explicit env flag/API configuration exists.

- [ ] **Step 3: Add package script**

```json
"ai:eval:langsmith": "tsx scripts/ai-platform-eval-langsmith.ts"
```

- [ ] **Step 4: Run local fake tests**

```bash
pnpm vitest run tests/unit/ai-platform-eval-langsmith.test.ts
pnpm ai:eval:local
```

- [ ] **Step 5: If a free LangSmith account/key is already available, run one controlled synthetic experiment**

If account creation/card/payment is required, stop and mark human action; do not pay.

- [ ] **Step 6: Commit**

```bash
git add scripts/ai-platform-eval-langsmith.ts tests/unit/ai-platform-eval-langsmith.test.ts package.json pnpm-lock.yaml
git commit -m "test(ai-observability): add LangSmith evaluation runner"
```

---

### Task 7: Capture Phase 1 baseline and outage proof

**Files:**
- Create: `docs/evidence/ai-platform/phase-1-gate.md`

- [ ] **Step 1: Run with LangSmith feature OFF**

Prove outputs/tests match Phase 0.

- [ ] **Step 2: Run with fake/controlled LangSmith SHADOW**

Capture sanitized trace shapes; inspect for secret/PII leakage.

- [ ] **Step 3: Simulate timeout/401/429**

Agent tests must remain green; external tracing warnings only.

- [ ] **Step 4: Run full gate**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db
pnpm ai:eval:local
pnpm build
git diff --check
```

- [ ] **Step 5: Record GO/NO-GO and commit**

```bash
git add docs/evidence/ai-platform/phase-1-gate.md
git commit -m "docs(ai-platform): record phase 1 observability gate"
```
