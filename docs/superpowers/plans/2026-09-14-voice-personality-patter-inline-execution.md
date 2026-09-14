# Voice Personality + Patter Inline Execution Plan

> **Execution mode:** inline in this chat/session, no subagents. Do **not** merge to `main`. Keep work on `feat/voice-personality-patter-inline`. PR #37 is a WIP review surface only; it is not a CI harness and is not authorized for merge.

**Goal:** Preserve Lumenva agent personality and per-turn emotional delivery in telephone calls while keeping Patter media-only, replaceable and independent from paid STT/TTS APIs.

**Architecture:** The canonical `lib/agent-engine` Product Agent definition owns agent identity and conversation personality. Voice transport sends caller transcript to the CRM; the Agent Kernel returns business-safe text plus the exact conversation style from the versioned definition; a deterministic Lumenva resolver combines that style with local sentiment to produce provider-neutral `VoiceDeliveryStyle`. Patter handles media lifecycle. Speaches hosts faster-whisper and Kokoro/Piper locally. Patter, Speaches and TTS providers never own personality, policy, memory or business reasoning.

**Current stack:** TypeScript, Next.js, Vitest, Agent OS/Agent Kernel, Patter 0.7.1, Silero VAD, Speaches, faster-whisper, Kokoro, optional Piper fallback, Telnyx carrier.

**Authoritative implementation paths:**
- `apps/crm/lib/agent-engine/**`
- `apps/crm/lib/voice/runtime/**`
- `apps/crm/app/api/internal/voice/**`
- `workers/voice-worker/**`
- `ops/voice-local/**`

**Non-authoritative/deprecated path:** `apps/crm/lib/ai/runtime/agent.ts` is explicitly deprecated and MUST NOT receive this feature.

## Global constraints

- Patter is media infrastructure only; it never selects business policy, memory, tools or source-of-truth state.
- `blocked` Agent OS results never produce TTS.
- Conversation personality lives on the versioned `AgentDefinition`.
- Per-turn emotion is deterministic and provider-neutral; no second LLM call is added for delivery classification.
- Sentiment uses the existing provider-free `classifySentiment()` path.
- No hosted STT/TTS API is required by the production worker path.
- Per-call acoustic delivery must be isolated by `callId`; no global mutable emotion/voice state.
- Tenant-domain logs and metrics include `organization_id`.
- No merge or auto-merge on PR #37.
- No completion claim without fresh execution evidence.

## Verification doctrine

GitHub Actions is intentionally disabled at repository level by `.claude/rules/testing-verification.md`. Adding/editing workflow files does not create a valid gate. The temporary task-specific workflow created earlier was removed.

Primary verification surfaces are:
1. focused tests executed against branch source;
2. canonical local checkout commands when a full checkout is available;
3. Vercel Preview only at the end of the task, after its current team/access problem is resolved;
4. real Speaches + PSTN acceptance for media/runtime behavior.

Canonical local commands:

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm lint:tenant-filter
pnpm test:unit
cd apps/crm && bash scripts/verify-voice-core.sh
cd ../../workers/voice-worker && npm run check
```

Any command not actually executed remains **unmeasured**.

## Completion gates

Eight gates, 12.5% each:
1. isolated branch/WIP PR and correct verification surface;
2. Patter/Agent OS ownership boundary;
3. canonical versioned Product Agent conversation style;
4. deterministic `VoiceDeliveryStyle` resolver;
5. authorized text + delivery metadata from canonical voice turn;
6. API → brain client → worker delivery transport + tenant-scoped observability;
7. full repository local verification + final Vercel Preview;
8. real local-model/PSTN acceptance including concurrency and barge-in.

## Task status

### Task 0 — Isolation and baseline
- [x] Work isolated on `feat/voice-personality-patter-inline`.
- [x] PR #37 exists as WIP review surface.
- [x] Confirm repository Actions are intentionally disabled.
- [x] Remove the inert task-specific Actions workflow.
- [ ] Full local-checkout baseline remains unmeasured in this assistant environment.

### Task 1 — Ownership boundary
- [x] Contract keeps Patter media-only and delegates each transcript to `brain.runTurn()`.
- [x] Worker does not import Agent Kernel business internals or Customer Memory repositories.
- [x] Deprecated `lib/ai/runtime/agent.ts` remains untouched by the feature.

### Task 2 — Canonical Product Agent personality
- [x] `AgentDefinition` carries optional `conversationStyle`.
- [x] `atendimento`, `sales`, and `retention` definitions carry their versioned styles.
- [x] Agent Kernel returns the exact style from the resolved execution definition.
- [x] Voice runtime uses `resolveAgentConversationStyle(execution.definition)`; no parallel personality map is source of truth.

### Task 3 — Deterministic delivery style
- [x] Provider-neutral `VoiceDeliveryStyle` implemented.
- [x] Negative/warm → empathetic + slow; negative/professional → calm + slow + serious.
- [x] Positive/neutral behavior remains bounded by the agent personality.
- [x] No network/model call is used for delivery classification.

### Task 4 — Authorized output and humanization
- [x] Delivery is attached only after Agent OS completion + voice authorization.
- [x] Humanizer is conservative and does not rewrite facts/numbers/dates/prices.
- [x] If humanization removes the entire response, the turn fails closed with `voice_agent_output_not_speakable`.

### Task 5 — API/worker transport and tenancy
- [x] `/api/internal/voice/turn` returns `delivery` unchanged.
- [x] `brain-client.mjs` remains transparent; regression test added.
- [x] Inbound call context returns `organization_id`.
- [x] Outbound CRM → worker control request carries `organization_id`.
- [x] Pending outbound reservation keeps tenant identity.
- [x] Per-turn delivery log includes `organization_id`.

### Task 6 — Free/local speech + call-scoped acoustic delivery
- [x] Deepgram/ElevenLabs removed from production worker path.
- [x] Silero VAD is local.
- [x] faster-whisper STT uses local Speaches.
- [x] Kokoro TTS uses local Speaches; optional Piper fallback is local.
- [x] `VoiceDeliveryStyle` is transported per call through Patter `beforeSynthesize(callId)` without shared mutable state.
- [x] Slow/normal/fast delivery maps to local synthesis speed while preserving call isolation.
- [x] Fallback never switches voice after primary audio has already begun.

### Task 7 — Canonical verification
- [x] `verify-voice-core.sh` includes personality, delivery, route transport and worker regression checks.
- [x] Focused worker/sandbox tests have been executed during this task; exact results are recorded in `docs/evidence/2026-09-14-voice-local-sandbox-verification.md`.
- [ ] Full `pnpm typecheck`, lint gates, full unit suite and full `verify-voice-core.sh` require a complete runnable checkout and remain unmeasured here.
- [ ] Final Vercel Preview is blocked by the current Vercel team/access configuration and must be retried only after local gates are green.

### Task 8 — Real runtime acceptance
- [ ] Start a real Speaches runtime with approved faster-whisper/Kokoro/Piper model assets.
- [ ] Controlled PSTN call.
- [ ] Two overlapping calls with different delivery styles.
- [ ] Barge-in/interruption.
- [ ] Local speech runtime failure/fallback.
- [ ] Transfer/handoff where enabled.
- [ ] Measure endpointing-to-first-audio p50/p95.

These are environmental acceptance gates; do not replace them with mocks and do not call the system 100% production-proven until they run.

## Finish procedure

1. Inspect the full diff against `main`.
2. Execute the canonical local gates in a full checkout.
3. Fix feature-caused failures and rerun.
4. Resolve Vercel Preview access and run one final Preview after all local work is complete.
5. Run real Speaches/PSTN acceptance.
6. Do **not** merge PR #37 automatically.
7. Final report must list commands actually executed, pass/fail counts, unmeasured gates, and the exact reason for every remaining gap.
