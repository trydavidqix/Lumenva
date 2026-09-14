# Voice Personality + Patter Inline Execution Plan

> **Execution mode:** REQUIRED SUB-SKILL: `superpowers:executing-plans`. Execute inline in this chat/session. Do **not** use subagents. Do **not** merge to `main` when finished. Keep all commits on `feat/voice-personality-patter-inline` and use draft PR #37 only as a CI harness.

**Goal:** Preserve Lumenva agent personality and per-turn emotional delivery in telephone calls while keeping Patter media-only and replaceable.

**Architecture:** The canonical `lib/agent-engine` Product Agent remains the source of agent identity/behavior. Voice transport sends caller transcript to the CRM; the Agent Kernel returns business-safe text; a deterministic Lumenva resolver combines the Product Agent conversational style with local sentiment to produce provider-neutral `VoiceDeliveryStyle`. Patter transports audio/STT/TTS but never owns personality, policy, memory or business reasoning.

**Tech Stack:** TypeScript, Next.js, Vitest, Agent OS/Agent Kernel, Patter, Deepgram, ElevenLabs, GitHub Actions CI.

**Authoritative implementation paths:**
- `apps/crm/lib/agent-engine/**`
- `apps/crm/lib/voice/runtime/**`
- `apps/crm/app/api/internal/voice/**`
- `workers/voice-worker/**`

**Non-authoritative/deprecated path:** `apps/crm/lib/ai/runtime/agent.ts` is explicitly deprecated and MUST NOT receive this feature.

## Global Constraints

- Patter is media infrastructure only. It MUST NOT select the Product Agent, read Customer Memory directly, make policy decisions, choose business tools, or become source of truth.
- `blocked` Agent OS results MUST never produce TTS.
- Conversation personality MUST live in provider-independent Lumenva contracts.
- Acoustic voice selection (`voiceId`, TTS provider, clone consent) remains separate from conversation personality and per-turn emotion.
- V1 emotional delivery is deterministic; no second LLM call just to classify delivery style.
- Sentiment comes from the existing provider-free `classifySentiment()` path.
- Per-turn delivery metadata MUST NOT mutate shared Patter/ElevenLabs `voiceSettings`; Patter's current `ElevenLabsTTS` stores settings on a shared instance. Until a call/turn-scoped provider API exists, dynamic acoustic changes degrade safely to metadata/text-level behavior rather than risk cross-call leakage.
- Do not copy business logic into `workers/voice-worker`.
- Do not merge or enable auto-merge on PR #37.
- No completion claim without fresh CI/test evidence.

## Completion accounting

Eight gates, each worth 12.5%:
1. Isolated branch + CI harness.
2. Architectural ownership regression gate.
3. Product Agent conversational-style contract.
4. Deterministic `VoiceDeliveryStyle` resolver.
5. Canonical voice turn returns approved text + delivery metadata.
6. Internal voice API/worker transports delivery without owning it.
7. Full CI and voice-core regression verification.
8. Real PSTN call proving audible behavior, barge-in and no cross-call style leakage.

Final report MUST state: completed gates, blocked gates, exact percentage, evidence, and reason for every missing gate.

---

## Task 0 — Isolation and baseline

- [x] Create `feat/voice-personality-patter-inline` from `plan/voice-personality-patter`.
- [x] Open draft PR #37 against `main` for CI only.
- [ ] Read current CI workflow and confirm PR triggers `typecheck`, `lint`, `lint:channels`, harness checks, unit tests, shell tests and DB invariants.
- [ ] Record baseline PR CI before feature code. If baseline fails for unrelated pre-existing reasons, preserve the evidence and distinguish it from feature failures.

## Task 1 — RED: lock Patter/Agent OS ownership boundary

**Create:** `apps/crm/tests/unit/voice-personality-patter-contract.test.ts`

The test MUST prove:
- `workers/voice-worker/main.mjs` delegates each user transcript to `brain.runTurn()`.
- The worker's Patter system prompt says business reasoning is external.
- `agent-os-adapter.ts` invokes `deps.kernel.run()` and `authorizeDelivery()`.
- `turn/route.ts` invokes `createVoiceTurnService()`.
- Patter adapter/worker does not import Agent Kernel internals, Customer Memory repositories or policy engines.
- The canonical personality implementation does not touch deprecated `lib/ai/runtime/agent.ts`.

**TDD:** commit this test first; CI must fail on the not-yet-existing conversational-style/delivery contract while existing boundary assertions remain valid.

## Task 2 — GREEN: add Product Agent conversational style

**Modify:** `apps/crm/lib/agent-engine/contracts/agent-os.ts`

Add provider-neutral types:

```ts
export type AgentConversationRegister = 'professional' | 'warm' | 'casual' | 'custom';

export interface AgentConversationStyle {
  register: AgentConversationRegister;
  toneInstructions: string;
  examplePhrases?: readonly string[];
}
```

Extend `AgentDefinition` with optional `conversationStyle?: AgentConversationStyle`.

**Modify:** Product Agents used in voice:
- `product-agents/atendimento.ts` → warm, patient, calm, clear.
- `product-agents/sales.ts` → warm/confident, concise, energetic without pressure.
- `product-agents/retention.ts` → empathetic, calm, non-defensive.

**Modify:** `apps/crm/lib/voice/runtime/kernel-runtime.ts`
- Include `execution.definition.conversationStyle` in the voice system instructions.
- Style instructions may influence wording only; they never override output contract, policy or tool restrictions.

**Tests:** extend product-agent/voice-kernel tests to prove style is part of the canonical definition and the voice runtime consumes it.

## Task 3 — RED/GREEN: deterministic per-turn delivery style

**Create:**
- `apps/crm/lib/voice/runtime/delivery-style.ts`
- `apps/crm/lib/voice/runtime/delivery-style.test.ts`

Canonical contract:

```ts
export type VoiceAffect = 'neutral' | 'calm' | 'warm' | 'empathetic' | 'upbeat' | 'firm';
export type VoicePace = 'slow' | 'normal' | 'fast';

export interface VoiceDeliveryStyle {
  affect: VoiceAffect;
  pace: VoicePace;
  energy: number; // 0..1
  tone: 'neutral' | 'warm' | 'serious' | 'bright';
}
```

Resolver input is `SentimentVerdict + AgentConversationStyle | undefined`.

Mandatory behavior:
- negative + warm → empathetic/slow/warm, energy <= .45
- negative + professional → calm/slow/serious
- positive + casual → upbeat/normal/bright, energy <= .75
- positive + professional → warm or neutral, never max-energy upbeat
- neutral → stable personality default
- missing style → professional safe default

No network/model call.

## Task 4 — attach delivery only after authorized Agent OS output

**Modify:**
- `apps/crm/lib/voice/runtime/turn-service.ts`
- tests for `turn-service`

Required order:

```text
resolve Product Agent -> kernel.run -> completed? -> authorizeDelivery -> speakable text -> classify caller sentiment -> resolve delivery -> reply
```

Return shape on success:

```ts
{
  kind: 'reply',
  text,
  delivery,
  agentId,
  runId,
  traceId,
}
```

`blocked` responses have neither `text` nor `delivery`.

The delivery resolver MUST NOT rewrite `text`.

## Task 5 — API and worker transport

**Modify/test:**
- `apps/crm/app/api/internal/voice/turn/route.ts`
- `apps/crm/app/api/internal/voice/turn/route.test.ts`
- `workers/voice-worker/brain-client.mjs`
- worker tests if present

The API returns the canonical `delivery` object unchanged. Identity binding (`voice_call_id` + technical phone) is untouched.

`brain-client.mjs` remains a transparent transport.

`workers/voice-worker/main.mjs` may observe normalized delivery metadata but MUST NOT decide or overwrite it.

## Task 6 — safe Patter/ElevenLabs behavior

Current Patter `ElevenLabsTTS` stores `voiceSettings` on the provider instance and `synthesizeStream(text)` has no call/turn context. Therefore:

- Do NOT mutate shared `voiceSettings` per turn.
- Do NOT introduce global mutable `currentEmotion` state.
- Do NOT encode hidden style control bytes into customer text as a shortcut.
- Preserve delivery metadata through the Lumenva boundary for future call-scoped provider adapters.
- Keep static tenant/acoustic voice settings working exactly as before.
- If a provider later exposes call-scoped synthesis options, implement that behind a provider adapter without changing Agent OS contracts.

Add a concurrency regression test/documented contract that rejects shared mutable per-turn TTS state.

## Task 7 — canonical verification

Update `apps/crm/scripts/verify-voice-core.sh` to include the new contract and delivery-style tests.

Use PR #37 CI as the authoritative execution environment available in this session.

Required green evidence before claiming code complete:
- Typecheck
- Lint
- channel-provider leak gate
- harness checks
- unit tests
- shell tests
- DB invariants

If any check fails, inspect logs, fix feature-caused failures, rerun CI and record unrelated baseline failures separately.

## Task 8 — real PSTN acceptance (environmental gate)

Only execute if this session has access to live Telnyx/Patter/Deepgram/ElevenLabs credentials and an active test number.

Test two separate calls, including overlap, to prove no emotion leakage between calls:
1. normal conversation;
2. negative/frustrated utterance;
3. positive utterance;
4. interruption/barge-in;
5. transfer attempt where allowed;
6. simultaneous calls with different sentiments.

Acceptance evidence:
- transcript reaches Agent OS;
- correct Product Agent selected;
- delivery metadata follows personality + sentiment;
- blocked output never reaches TTS;
- no cross-call style state leakage;
- call completes without regression.

If live credentials/telephony are unavailable, mark this gate blocked rather than simulated.

## Finish procedure

1. Re-read this plan and the original plan.
2. Fetch PR diff and inspect every changed file.
3. Run/read fresh CI results.
4. Do NOT merge PR #37.
5. Keep `feat/voice-personality-patter-inline` and draft PR #37 intact.
6. Final report format:

```text
Implementation status: NN%
Completed: G1, G2, ...
Blocked/not proven: G...
Why: exact technical/environmental reason
CI: exact jobs/checks and outcomes
Branch: feat/voice-personality-patter-inline
PR: #37 draft, NOT MERGED
```
