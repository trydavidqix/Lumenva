# Voice local/free sandbox verification — 2026-09-14

Branch: `feat/voice-personality-patter-inline`

This evidence records only checks actually executed in the assistant sandbox using source copied from the branch through the GitHub connector. It does **not** claim a full-monorepo CI pass, real-model Speaches pass, or live PSTN pass.

## Executed results

### Baseline local STT/TTS adapters — 11/11 passed

Executed with Node 22 `node:test` against the branch implementations of `speaches-stt.mjs` and `speaches-tts.mjs`.

Covered:
- PCM16 mono WAV header generation;
- local faster-whisper transcription request;
- no API-key header for local STT;
- per-call STT clone/buffer isolation;
- bounded utterance buffering;
- no transcript after close;
- abort of in-flight STT after close;
- local TTS PCM16/16 kHz request;
- streamed chunk join;
- Kokoro -> Piper fallback before first audio only;
- no voice switch after primary audio was emitted;
- model/voice/empty-text validation.

### Worker safety/control helpers — 11/11 passed

Executed with Node 22 `node:test`.

Covered:
- control `/healthz` returns 503 when local speech is unavailable;
- outbound dialing is rejected before carrier call when local speech is unavailable;
- `/healthz` returns 200 when local speech is ready;
- Speaches health endpoint is keyless;
- health HTTP/network failures fail closed;
- outbound destination reservation uniqueness;
- expired reservation cleanup;
- E.164 and call-id validation;
- provider-neutral delivery logging;
- malformed delivery metadata rejection.

### Personality / delivery / turn-service focused harness — 6/6 passed

The branch source for the relevant modules was compiled with the available TypeScript compiler and exercised with a minimal Node test harness. Type-only dependencies not needed at runtime were represented by minimal interfaces, so this proves the focused runtime logic but is not a substitute for the repository's full TypeScript gate.

Covered:
- canonical Product Agent conversation styles;
- negative/positive/neutral `VoiceDeliveryStyle` rules;
- professional personality does not become hyper-upbeat;
- voice humanizer removes presentation artifacts while preserving facts/numbers/dates/prices;
- delivery authorization blocks before model work;
- negative support turn becomes empathetic/slow/warm without rewriting Agent OS text;
- supervisor-selected `atendimento`, `sales`, and `retention` routing is preserved.

### Call-scoped emotional delivery — TDD verified

A RED contract was committed first and executed in the sandbox. It failed for the intended reason: the call-scoped delivery bridge did not exist yet.

After implementation, the focused delivery-context + TTS suite passed **12/12**.

Covered:
- provider-neutral delivery envelope round-trip;
- malformed internal envelope is never exposed as speakable text;
- `slow` maps to base speed × `0.92`;
- `normal` preserves configured base speed;
- `fast` maps to base speed × `1.06`;
- final speed is bounded to `0.75..1.25`;
- two call IDs retain independent delivery styles;
- recent responses retain their own style across barge-in/cancel-style ordering races;
- unknown sentences fail safe to default TTS delivery rather than guessing;
- call state is cleared on completion;
- stale response metadata expires;
- TTS strips the internal envelope before sending text to Speaches;
- a shared `SpeachesLocalTTS` instance concurrently synthesized one slow and one fast utterance while its configured base speed remained unchanged.

A subsequent regression run combining the new delivery-context tests with the existing faster-whisper STT and local TTS tests passed **18/18, 0 failed**.

This closes the previous implementation gap where Lumenva knew `calm/empathetic/upbeat` but the local TTS could not safely receive per-call delivery. Pace is now audible per call without shared mutable provider state.

Important limitation: `affect`, `tone`, and `energy` remain provider-neutral metadata. They are not falsely mapped to acoustic controls that the current local Speaches/Kokoro/Piper interface does not expose. The currently proven acoustic modulation is call-scoped **pace/speed**.

## Earlier aggregate focused check

Before the call-scoped bridge work, the combined isolated checks reported:

- **28 passed**
- **0 failed**

The later 12/12 and 18/18 runs overlap with some of those baseline STT/TTS tests, so these numbers must not be added together as unique-test counts.

## Static branch verification

Fetched directly from the branch:

- `workers/voice-worker/main.mjs` uses `Patter`, `SileroVAD`, `SpeachesFasterWhisperSTT`, `SpeachesLocalTTS`, `brain.runTurn()`, and a Patter `beforeSynthesize` hook;
- `beforeSynthesize` keys delivery by Patter `hookContext.callId`;
- `onMessage` records delivery using the same per-call ID surface instead of mutating global TTS state;
- `workers/voice-worker/delivery-context.mjs` owns the bounded call-scoped delivery bridge;
- `SpeachesLocalTTS` decodes metadata locally, strips it from speakable text, and computes a request-local speed;
- production worker source contains no Deepgram or ElevenLabs adapter references;
- worker keeps `persist: false` and `telemetry: false`;
- `workers/voice-worker/package.json` pins `getpatter` `0.7.1` and `onnxruntime-node` `~1.18.0`;
- Docker base is `node:22-bookworm-slim`;
- `kernel-runtime.ts` applies Product Agent conversation style in the canonical Agent OS runtime;
- legacy `lib/ai/runtime/agent.ts` remains marked `@deprecated` and does not contain the new voice style types.

Upstream Patter source was checked before implementing the bridge:

- `PipelineHooks.beforeSynthesize(text, ctx)` is a per-sentence pipeline hook;
- `HookContext` contains `callId`, `caller`, and `callee`;
- Patter integration tests exercise hooks together with the external `onMessage` flow;
- the public TTS adapter contract still receives only `synthesizeStream(text)`, which is why the implementation deliberately does not depend on a non-existent per-call TTS option parameter.

## GitHub Actions attempt

A branch-only workflow exists at `.github/workflows/voice-local-inline-ci.yml` with:

1. monorepo install;
2. voice-worker install/check;
3. CRM typecheck;
4. CRM unit tests;
5. `scripts/verify-voice-core.sh`.

At evidence time the repository returned no normal GitHub Actions run for the branch workflow; only the existing dynamic Copilot review run was visible. Connector-created commits therefore have not produced a full repository CI result in this session. **Full repository CI remains unproved.**

## Remaining gates before 100% proven

1. Full repository `pnpm install --frozen-lockfile` in a real checkout.
2. Full CRM typecheck.
3. Full unit suite.
4. `apps/crm/scripts/verify-voice-core.sh`, including Next build and other voice runtimes.
5. Real Speaches runtime with downloaded faster-whisper/Kokoro/Piper models.
6. Controlled PSTN call.
7. Two concurrent PSTN calls to verify end-to-end media/call isolation.
8. Barge-in, latency, local-runtime failure, fallback, and transfer validation with real media.
9. Richer acoustic emotion beyond pace remains provider-capability-dependent; no unsupported Kokoro/Piper behavior is claimed.

No merge to `main` was performed.
