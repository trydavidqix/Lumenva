# Voice Personality + Patter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preservar a personalidade, o sentimento e os guardrails da Lumenva em chamadas telefónicas, mantendo Patter apenas como camada substituível de mídia/telefonia e fazendo o TTS receber um estilo de entrega controlado pelo Agent OS.

**Architecture:** O Agent OS continua sendo a única autoridade sobre identidade do agente, memória, sentimento, decisão, ferramentas, políticas e conteúdo. Patter recebe transcrição, entrega ao CRM, recebe de volta texto aprovado + metadados de estilo e apenas executa transporte/STT/TTS/barge-in. A expressividade é normalizada num contrato Lumenva (`VoiceDeliveryStyle`) para que ElevenLabs, Inworld, OpenAI, Gemini, Piper/Kokoro ou qualquer outro provider possam ser trocados sem mover personalidade para dentro do provider.

**Tech Stack:** Next.js/TypeScript, Agent OS/Agent Kernel, Vitest, Patter TypeScript SDK, Deepgram STT, ElevenLabs TTS, PostgreSQL/Supabase, existing Lumenva VoiceEngine contracts.

**Spec:** `docs/specs/19-spec-tenant-voice-customization.md`

**Supporting specs/evidence:**
- `docs/specs/18-spec-humanizer-gate.md`
- `docs/evidence/implementacao-tokens/voice-core/patter-equivalence.md`
- `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md`
- `docs/business-rules/00-business-rules-catalog.md`

## Global Constraints

- Patter MUST remain an internal, replaceable media implementation; it MUST NOT become the CRM brain, memory store, model router, tool gateway, policy engine, Agent OS or source of truth.
- Agent OS MUST remain the only authority that chooses the Product Agent and decides whether an output may be spoken.
- A `blocked` result MUST never become audio.
- Personality/brand style MUST be provider-independent and stored/versioned with Lumenva agent configuration, not in Patter.
- Acoustic voice configuration (`voiceId`, provider, speed, pitch, clone consent) MUST remain separate from conversational personality/style.
- Emotion/style adaptation MUST never alter facts, prices, promises, permissions, tool results or safety decisions; it controls delivery only.
- Provider-specific capabilities MUST degrade gracefully: unsupported style fields are ignored, never treated as call-fatal.
- No new LLM call is allowed solely to choose delivery style in V1; use deterministic inputs already available locally.
- Do not log raw caller text, generated reply text or free-form PII in delivery telemetry. Log only normalized labels/numbers/provider IDs already allowed by observability policy.
- Keep the existing CRM-owned `VoiceEngine` seam; Patter-specific code remains under `apps/crm/lib/voice/patter/**` and `workers/voice-worker/**`.
- TDD: every task starts with a failing test and ends with targeted tests passing before the task commit.

---

## File Map

### Create
- `apps/crm/lib/voice/runtime/delivery-style.ts` — canonical provider-neutral delivery style contract + deterministic resolver.
- `apps/crm/lib/voice/runtime/delivery-style.test.ts` — sentiment/persona precedence and graceful defaults.
- `apps/crm/lib/voice/patter/elevenlabs-style.ts` — maps Lumenva delivery style to supported ElevenLabs/Patter settings.
- `apps/crm/lib/voice/patter/elevenlabs-style.test.ts` — provider mapping tests.
- `apps/crm/tests/unit/voice-personality-patter-contract.test.ts` — architectural regression test proving Agent OS remains authority and Patter remains media-only.

### Modify
- `apps/crm/lib/voice/runtime/agent-os-adapter.ts` — return approved text plus normalized delivery metadata.
- `apps/crm/lib/voice/runtime/agent-os-adapter.test.ts` — prove personality/style metadata never bypasses delivery authorization.
- `apps/crm/lib/voice/runtime/turn-service.ts` — resolve deterministic sentiment/delivery style after approved Agent OS output.
- `apps/crm/app/api/internal/voice/turn/route.ts` — expose `delivery` in the internal response without changing request identity rules.
- `apps/crm/app/api/internal/voice/turn/route.test.ts` — API contract tests.
- `workers/voice-worker/brain-client.mjs` — carry `delivery` transparently from CRM response.
- `workers/voice-worker/main.mjs` — apply delivery through a provider adapter while keeping Patter as media shell.
- `apps/crm/lib/voice/engine/contracts.ts` — reuse/clarify acoustic profile vs conversational delivery semantics without coupling provider details.
- `apps/crm/scripts/verify-voice-core.sh` — include new focused tests in canonical voice verification.
- `docs/specs/19-spec-tenant-voice-customization.md` — amend terminology so conversational personality does not collide conceptually with the existing acoustic `VoiceProfile` type.

### Explicitly do not change in this plan
- CRM identity resolution.
- `voice_calls`/`voice_call_events` ownership.
- Contact Memory storage.
- Agent Kernel authority.
- Product Agent autonomy levels.
- Telnyx/PSTN routing architecture.
- Patter persistence (`persist: false`).
- Patter dashboard/anonymous telemetry policy.

---

### Task 1: Lock the architectural boundary in tests

**Files:**
- Create: `apps/crm/tests/unit/voice-personality-patter-contract.test.ts`
- Modify: `apps/crm/scripts/verify-voice-core.sh`

**Interfaces:**
- Consumes: current `createVoiceTurnService`, `createVoiceAgentOsAdapter`, Patter worker source and VoiceEngine seams.
- Produces: regression gates proving Patter is media-only and all speakable content comes from Agent OS.

- [ ] **Step 1: Write the failing architecture-contract test**

Create assertions that read the relevant source files and require all of the following:

```ts
expect(worker).toContain('brain.runTurn');
expect(worker).toContain('systemPrompt: "You are the Lumenva media shell. Business reasoning is provided externally."');
expect(agentOsAdapter).toContain('deps.kernel.run');
expect(agentOsAdapter).toContain('authorizeDelivery');
expect(turnRoute).toContain('createVoiceTurnService');
expect(patterAdapter).not.toContain('system_prompt');
```

Also assert that worker/Patter code does not import Agent Kernel, customer-memory repositories or CRM policy engines directly.

- [ ] **Step 2: Run the new test and confirm the initial expected failure only for the new delivery-style contract assertion**

Run:

```bash
pnpm --dir apps/crm exec vitest run tests/unit/voice-personality-patter-contract.test.ts
```

Expected: existing architecture assertions pass; the assertion requiring a provider-neutral `VoiceDeliveryStyle` fails because it does not exist yet.

- [ ] **Step 3: Add the test to canonical voice verification**

Append the new file to `apps/crm/scripts/verify-voice-core.sh` beside the existing runtime/Patter contract tests.

- [ ] **Step 4: Run canonical voice-core verification and record the pre-implementation baseline**

Run:

```bash
cd apps/crm && ./scripts/verify-voice-core.sh
```

Expected: only the intentionally new delivery-style requirement is red; no unrelated regression is accepted.

- [ ] **Step 5: Commit**

```bash
git add apps/crm/tests/unit/voice-personality-patter-contract.test.ts apps/crm/scripts/verify-voice-core.sh
git commit -m "test: lock voice personality ownership boundary"
```

---

### Task 2: Add the provider-neutral delivery-style contract

**Files:**
- Create: `apps/crm/lib/voice/runtime/delivery-style.ts`
- Create: `apps/crm/lib/voice/runtime/delivery-style.test.ts`
- Modify: `apps/crm/lib/voice/engine/contracts.ts`

**Interfaces:**
- Consumes: `SentimentLabel`/`SentimentVerdict` from `apps/crm/lib/agent-engine/agent/sentiment.ts` and optional agent conversational-style metadata.
- Produces:

```ts
export type VoiceAffect = "neutral" | "calm" | "warm" | "empathetic" | "upbeat" | "firm";
export type VoicePace = "slow" | "normal" | "fast";

export interface VoiceDeliveryStyle {
  affect: VoiceAffect;
  pace: VoicePace;
  energy: number; // 0..1
  tone: "neutral" | "warm" | "serious" | "bright";
}

export interface ResolveVoiceDeliveryStyleInput {
  sentiment: SentimentVerdict;
  register?: "professional" | "warm" | "casual" | "custom";
}

export function resolveVoiceDeliveryStyle(input: ResolveVoiceDeliveryStyleInput): VoiceDeliveryStyle;
```

- [ ] **Step 1: Write failing unit tests for deterministic mapping**

Cover at minimum:

```ts
negative + warm         => empathetic / slow / warm
negative + professional => calm / slow / serious
positive + warm         => warm / normal / warm
positive + casual       => upbeat / normal / bright
neutral + any           => neutral-or-warm according to register
```

Add a precedence test proving persona/register bounds the emotion: a professional agent receiving positive sentiment must never produce `upbeat` with maximum energy.

- [ ] **Step 2: Run the targeted test and verify failure**

```bash
pnpm --dir apps/crm exec vitest run lib/voice/runtime/delivery-style.test.ts
```

Expected: FAIL because `delivery-style.ts` does not exist.

- [ ] **Step 3: Implement the smallest deterministic resolver**

Rules for V1:

```ts
negative -> calm/empathetic, pace slow, energy <= 0.45
neutral  -> neutral/warm, pace normal, energy 0.45..0.60
positive -> warm/upbeat only when register allows it, energy <= 0.75
professional -> clamps affect to neutral/calm/warm and energy <= 0.55
```

No model/API call, no free-form generated emotion labels.

- [ ] **Step 4: Keep acoustic `VoiceProfile` distinct**

Do not merge `VoiceDeliveryStyle` into the existing `VoiceProfile` type. `VoiceProfile` remains the selected voice/provider/acoustic profile; `VoiceDeliveryStyle` is per-turn delivery intent.

- [ ] **Step 5: Run tests**

```bash
pnpm --dir apps/crm exec vitest run lib/voice/runtime/delivery-style.test.ts lib/voice/engine/contracts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/crm/lib/voice/runtime/delivery-style.ts apps/crm/lib/voice/runtime/delivery-style.test.ts apps/crm/lib/voice/engine/contracts.ts
git commit -m "feat: add provider neutral voice delivery style"
```

---

### Task 3: Attach sentiment and personality to each approved voice turn

**Files:**
- Modify: `apps/crm/lib/voice/runtime/agent-os-adapter.ts`
- Modify: `apps/crm/lib/voice/runtime/agent-os-adapter.test.ts`
- Modify: `apps/crm/lib/voice/runtime/turn-service.ts`
- Test/Create if needed: `apps/crm/lib/voice/runtime/turn-service.test.ts`

**Interfaces:**
- Consumes: final caller transcript, Agent OS reply, local `classifySentiment()`, agent register/personality lookup.
- Produces:

```ts
type VoiceAgentTurnResult =
  | {
      kind: "reply";
      text: string;
      delivery: VoiceDeliveryStyle;
      agentId: string;
      runId: string;
      traceId: string;
    }
  | { kind: "blocked"; ... };
```

- [ ] **Step 1: Write failing tests**

Test all of these:

1. Negative caller text creates calm/empathetic delivery metadata.
2. Positive caller text creates warm/upbeat delivery only when the agent register allows it.
3. `blocked` has no `delivery` and no speakable text.
4. `authorizeDelivery()` still executes before any reply becomes speakable.
5. Agent Kernel output text is unchanged by delivery-style resolution.

- [ ] **Step 2: Run tests and verify failure**

```bash
pnpm --dir apps/crm exec vitest run lib/voice/runtime/agent-os-adapter.test.ts lib/voice/runtime/turn-service.test.ts
```

Expected: FAIL because reply currently lacks `delivery`.

- [ ] **Step 3: Compute sentiment locally from the caller transcript**

Call existing:

```ts
const sentiment = classifySentiment(input.transcript);
```

Do not add a second LLM call.

- [ ] **Step 4: Resolve the conversational register**

Use the published agent/version configuration when available. Until the Spec 19 persistence task is complete, default to `professional`; never infer a tenant personality from the TTS voice name.

- [ ] **Step 5: Produce `delivery` only after Agent OS returns an authorized speakable reply**

The order must remain:

```text
resolve agent -> kernel.run -> completed? -> authorizeDelivery -> extract speakable text -> resolve delivery style -> reply
```

- [ ] **Step 6: Run tests**

```bash
pnpm --dir apps/crm exec vitest run lib/voice/runtime/agent-os-adapter.test.ts lib/voice/runtime/turn-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/crm/lib/voice/runtime/agent-os-adapter.ts apps/crm/lib/voice/runtime/agent-os-adapter.test.ts apps/crm/lib/voice/runtime/turn-service.ts apps/crm/lib/voice/runtime/turn-service.test.ts
git commit -m "feat: derive voice delivery from agent context"
```

---

### Task 4: Expose delivery metadata through the internal voice API

**Files:**
- Modify: `apps/crm/app/api/internal/voice/turn/route.ts`
- Modify: `apps/crm/app/api/internal/voice/turn/route.test.ts`
- Modify: `workers/voice-worker/brain-client.mjs`

**Interfaces:**
- Consumes: `VoiceAgentTurnResult` from `createVoiceTurnService()`.
- Produces JSON reply shape:

```json
{
  "kind": "reply",
  "text": "Claro, vou verificar.",
  "delivery": {
    "affect": "empathetic",
    "pace": "slow",
    "energy": 0.35,
    "tone": "warm"
  }
}
```

- [ ] **Step 1: Add failing API tests**

Require `delivery` on successful reply and require it to be absent on `blocked`.

Also keep existing identity validation unchanged: `voice_call_id` + `technical_phone_e164` must still bind the call to the authorized tenant/worker.

- [ ] **Step 2: Run API tests**

```bash
pnpm --dir apps/crm exec vitest run app/api/internal/voice/turn/route.test.ts
```

Expected: FAIL on missing `delivery`.

- [ ] **Step 3: Pass the service result through without provider-specific translation**

`route.ts` must know only the canonical `VoiceDeliveryStyle`, never ElevenLabs/Patter settings.

- [ ] **Step 4: Keep `brain-client.mjs` transparent**

No style decision in the client; it transports the response exactly as returned by CRM.

- [ ] **Step 5: Run tests**

```bash
pnpm --dir apps/crm exec vitest run app/api/internal/voice/turn/route.test.ts lib/voice/sip/brain-client.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/crm/app/api/internal/voice/turn/route.ts apps/crm/app/api/internal/voice/turn/route.test.ts workers/voice-worker/brain-client.mjs
git commit -m "feat: expose voice delivery metadata to media worker"
```

---

### Task 5: Translate Lumenva delivery style to Patter/ElevenLabs

**Files:**
- Create: `apps/crm/lib/voice/patter/elevenlabs-style.ts`
- Create: `apps/crm/lib/voice/patter/elevenlabs-style.test.ts`
- Modify: `workers/voice-worker/main.mjs`
- Modify: `apps/crm/lib/voice/patter/adapter.ts` only if the current seam needs a typed style hook; do not leak ElevenLabs types outside `lib/voice/patter/**`.

**Interfaces:**
- Consumes: `VoiceDeliveryStyle`.
- Produces provider settings compatible with the Patter ElevenLabs adapter, e.g. a normalized structure containing only fields the provider supports:

```ts
interface ElevenLabsDeliverySettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export function toElevenLabsDeliverySettings(style: VoiceDeliveryStyle): ElevenLabsDeliverySettings;
```

- [ ] **Step 1: Write failing mapping tests**

Required examples:

```ts
empathetic -> lower style intensity, stable delivery
calm      -> high stability, low style intensity
warm      -> medium stability, moderate style
upbeat    -> higher style, bounded below provider max
firm      -> high stability, low embellishment
```

Never map an internal value outside provider-supported bounds.

- [ ] **Step 2: Run test and verify failure**

```bash
pnpm --dir apps/crm exec vitest run lib/voice/patter/elevenlabs-style.test.ts
```

Expected: FAIL because mapper does not exist.

- [ ] **Step 3: Implement the pure mapper**

The mapper has no network call and no tenant lookup.

- [ ] **Step 4: Apply settings in the worker without moving reasoning into Patter**

The worker keeps:

```ts
systemPrompt: "You are the Lumenva media shell. Business reasoning is provided externally."
```

On each approved reply, it uses `result.text` as content and `result.delivery` only as delivery intent. If the current Patter TTS object cannot mutate settings per utterance safely, add a tiny worker-local adapter/cached TTS variant rather than moving personality logic into Patter.

- [ ] **Step 5: Graceful fallback test**

When `delivery` is absent, malformed or unsupported by the provider, the worker must speak the approved text using its configured default voice instead of failing the call.

- [ ] **Step 6: Run tests**

```bash
pnpm --dir apps/crm exec vitest run lib/voice/patter/elevenlabs-style.test.ts lib/voice/patter/adapter.test.ts tests/unit/voice-personality-patter-contract.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/crm/lib/voice/patter/elevenlabs-style.ts apps/crm/lib/voice/patter/elevenlabs-style.test.ts workers/voice-worker/main.mjs apps/crm/lib/voice/patter/adapter.ts
git commit -m "feat: map Lumenva delivery style to Patter TTS"
```

---

### Task 6: Implement tenant/agent conversational personality without colliding with acoustic VoiceProfile

**Files:**
- Modify: `docs/specs/19-spec-tenant-voice-customization.md`
- Modify: the next Supabase migration file created for this feature.
- Modify: agent version schema/runtime files that currently load `ai_agent_versions.system_prompt`.
- Modify: `apps/crm/app/app/ai/agents/[id]/_components/AgentForm.tsx`
- Add focused unit/API tests beside the changed runtime/schema files.

**Interfaces:**
- Consumes: published `ai_agent_versions` configuration.
- Produces a versioned conversational-style object with this logical shape:

```ts
interface AgentSpeechStyle {
  register: "professional" | "warm" | "casual" | "custom";
  toneInstructions: string | null;
  examplePhrases: string[];
}
```

- [ ] **Step 1: Amend Spec 19 terminology before implementation**

The repo already has an acoustic `VoiceProfile` type (`voiceId`, provider, tone/style/speed/pitch). To prevent ambiguous ownership, rename the proposed conversational concept in the spec to `AgentSpeechStyle`/`agent_speech_style` (or the repository naming equivalent chosen consistently), while preserving the existing behavior described by the spec.

- [ ] **Step 2: Write failing schema/runtime tests**

Prove:

1. Existing agents default to `professional`.
2. Up to 5 example phrases are accepted.
3. Tone instructions enforce the existing length ceiling.
4. Published versions remain immutable.
5. Guardrails ignore this field and still run after model generation.

- [ ] **Step 3: Add versioned persistence in `ai_agent_versions`**

Use JSONB with a safe default equivalent to:

```json
{
  "register": "professional",
  "tone_instructions": null,
  "example_phrases": []
}
```

Do not create a separate personality service or duplicate business rules.

- [ ] **Step 4: Compose style into the Agent system prompt**

Add a clearly delimited style section while leaving deterministic `BEFORE_SEND_GATES` authoritative. The style block influences wording only.

- [ ] **Step 5: Add UI in the existing agent editor**

Expose register, short tone instructions and up to five example phrases in the Conversador area. Do not expose guardrail toggles here.

- [ ] **Step 6: Feed the published register into `resolveVoiceDeliveryStyle()`**

Voice runtime reads the resolved agent style; it never derives personality from ElevenLabs voice ID or Patter configuration.

- [ ] **Step 7: Run targeted schema/runtime/UI tests and the unit suite for affected packages**

Minimum:

```bash
pnpm --dir apps/crm test:unit
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add docs/specs/19-spec-tenant-voice-customization.md apps/crm supabase/migrations
git commit -m "feat: version agent speech style independently of TTS voice"
```

---

### Task 7: Integrate humanization/voice formatting without changing facts

**Files:**
- Modify: `apps/crm/lib/agent-engine/guardrails/before-send.ts`
- Create/Modify tests following `docs/specs/18-spec-humanizer-gate.md`.
- Add voice-only formatting tests for short spoken replies and number/date/value normalization if not already implemented.

**Interfaces:**
- Consumes: approved candidate response before voice delivery.
- Produces: speakable text; `VoiceDeliveryStyle` remains metadata and is resolved independently.

- [ ] **Step 1: Write failing humanizer/voice-format tests from Spec 18**

Prove that the humanizer removes defined bot-like patterns but does not change facts, and that voice formatting enforces the existing VOZ rules.

- [ ] **Step 2: Run targeted guardrail tests and verify failure**

Use existing before-send test conventions in `apps/crm/tests/unit`/guardrail tests.

- [ ] **Step 3: Implement deterministic transformations only**

No extra LLM call. The transformation may rewrite phrasing but may not add facts, prices, discounts, promises or tool results.

- [ ] **Step 4: Preserve ordering**

Content/policy guards remain authoritative. Delivery style is computed from context and never used as permission to bypass a gate.

- [ ] **Step 5: Run the full affected test set**

```bash
pnpm --dir apps/crm test:unit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/crm/lib/agent-engine apps/crm/tests
git commit -m "feat: humanize and format approved voice replies"
```

---

### Task 8: Add privacy-safe observability for emotional delivery

**Files:**
- Modify: existing voice event/telemetry normalization under `apps/crm/lib/voice/**` and `workers/voice-worker/**`.
- Modify/add tests beside current telemetry tests.

**Interfaces:**
- Consumes: normalized delivery style and existing provider latency/cost metrics.
- Produces metadata such as:

```json
{
  "sentiment_label": "negative",
  "delivery_affect": "empathetic",
  "delivery_pace": "slow",
  "delivery_energy": 0.35,
  "tts_provider": "elevenlabs"
}
```

- [ ] **Step 1: Write failing telemetry tests**

Require labels/numbers only. Explicitly reject transcript/reply bodies from telemetry detail.

- [ ] **Step 2: Add normalized delivery metadata to existing voice events/traces**

Do not create a second transcript store and do not enable Patter persistence.

- [ ] **Step 3: Run telemetry tests**

```bash
pnpm --dir apps/crm exec vitest run lib/voice/patter/telemetry.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/crm/lib/voice workers/voice-worker
git commit -m "feat: trace voice delivery style without storing call text"
```

---

### Task 9: End-to-end regression gates and real PSTN acceptance

**Files:**
- Modify: `apps/crm/scripts/verify-voice-core.sh`
- Create: `docs/evidence/voice-personality-patter-acceptance-2026-09-14.md` after execution.
- Reuse existing voice runbooks rather than creating a competing runbook.

**Interfaces:**
- Consumes: complete implementation from Tasks 1-8.
- Produces: reproducible proof that provider changes do not erase personality and that Patter remains replaceable.

- [ ] **Step 1: Run unit/contract verification**

```bash
pnpm --dir apps/crm test:unit
cd apps/crm && ./scripts/verify-voice-core.sh
```

Expected: PASS with zero unrelated failures.

- [ ] **Step 2: Run the fixed conversational acceptance matrix**

Use at least these scenarios on a real call or controlled PSTN test environment:

1. Neutral request.
2. Positive/thankful caller.
3. Angry/frustrated caller.
4. Serious/high-stakes request that must remain professional.
5. Caller interruption/barge-in.
6. Human transfer.
7. Provider default/fallback path with unsupported style field.

- [ ] **Step 3: Acceptance criteria per scenario**

For every scenario verify:

```text
same Agent OS identity
same memory/policy authority
approved text only
correct normalized delivery label
no personality change caused by Patter
no call failure when provider ignores a style field
```

- [ ] **Step 4: Provider-swap regression**

Run the same deterministic delivery tests with at least one alternate/fake TTS adapter. The semantic `VoiceDeliveryStyle` must remain identical; only provider translation may differ.

- [ ] **Step 5: Record evidence**

Document test date, commit SHA, provider versions, scenarios, latency observations, failures and final status. Do not put API keys, phone secrets or raw PII in the evidence file.

- [ ] **Step 6: Final commit**

```bash
git add apps/crm/scripts/verify-voice-core.sh docs/evidence/voice-personality-patter-acceptance-2026-09-14.md
git commit -m "test: verify personality preserving voice pipeline"
```

---

## Final Acceptance Gate

Implementation is complete only when all of the following are true:

- Patter is still replaceable behind Lumenva-owned interfaces.
- Agent OS remains the only source of agent identity, business reasoning and delivery permission.
- Caller sentiment can change delivery without changing facts or permissions.
- Agent personality/register bounds the emotional adaptation.
- `blocked` outputs never reach TTS.
- `VoiceDeliveryStyle` contains no provider-specific fields.
- ElevenLabs translation is isolated to the Patter/provider adapter boundary.
- Unsupported provider style capabilities degrade to defaults without ending the call.
- Conversational agent style and acoustic `VoiceProfile` remain separate concepts.
- Humanizer/voice-format rules cannot bypass deterministic business guardrails.
- Voice telemetry contains normalized delivery metadata but not raw conversational content.
- `pnpm --dir apps/crm test:unit` passes.
- `apps/crm/scripts/verify-voice-core.sh` passes.
- A real/controlled PSTN acceptance run proves neutral, positive, negative, interruption and transfer scenarios.

## Implementation Order Summary

```text
1. Architecture regression gate
2. VoiceDeliveryStyle contract
3. Sentiment + personality -> delivery
4. Internal API carries delivery
5. Patter/ElevenLabs executes delivery
6. Versioned agent speech style
7. Humanizer + voice format
8. Privacy-safe telemetry
9. Real PSTN acceptance
```

The invariant is intentionally simple:

```text
Lumenva decides WHO the agent is, WHAT it may say and HOW it should sound.
Patter only carries the call and executes the selected voice provider.
```
