# Voice local/free sandbox verification — 2026-09-14

Branch: `feat/voice-personality-patter-inline`

This evidence records only checks actually executed in the assistant sandbox using source copied from the branch through the GitHub connector. It does **not** claim a full-monorepo CI pass or a live PSTN pass.

## Executed results

### Local STT/TTS adapters — 11/11 passed

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

## Total sandbox checks

- **28 passed**
- **0 failed**

## Static branch verification

Fetched directly from the branch:

- `workers/voice-worker/main.mjs` uses `Patter`, `SileroVAD`, `SpeachesFasterWhisperSTT`, `SpeachesLocalTTS`, and `brain.runTurn()`;
- production worker source contains no Deepgram or ElevenLabs adapter references;
- worker keeps `persist: false` and `telemetry: false`;
- `workers/voice-worker/package.json` pins `getpatter` `0.7.1` and `onnxruntime-node` `~1.18.0`;
- Docker base is `node:22-bookworm-slim`;
- `kernel-runtime.ts` applies Product Agent conversation style in the canonical Agent OS runtime;
- legacy `lib/ai/runtime/agent.ts` remains marked `@deprecated` and does not contain the new voice style types.

## GitHub Actions attempt

A branch-only workflow was added at `.github/workflows/voice-local-inline-ci.yml` with:

1. monorepo install;
2. voice-worker install/check;
3. CRM typecheck;
4. CRM unit tests;
5. `scripts/verify-voice-core.sh`.

At evidence time the repository returned no normal GitHub Actions run for the new branch workflow; only the existing dynamic Copilot review run was visible. Therefore **full repository CI remains unproved**.

## Remaining gates before 100%

1. Full repository `pnpm install --frozen-lockfile`.
2. Full CRM typecheck.
3. Full unit suite.
4. `apps/crm/scripts/verify-voice-core.sh` including Next build and other voice runtimes.
5. Real Speaches runtime with downloaded faster-whisper/Kokoro/Piper models.
6. Controlled PSTN call.
7. Two concurrent PSTN calls to verify media/call isolation.
8. Barge-in, latency, local-runtime failure, fallback, and transfer validation.
9. Call-scoped emotional prosody mapping remains a separate implementation/gate; no unsafe shared mutable TTS state was introduced.

No merge to `main` was performed.
