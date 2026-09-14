# Voice Local/Free + Patter — Inline Execution Plan

**Branch:** `feat/voice-personality-patter-inline`

**Goal:** substituir o caminho pago de STT/TTS do voice-worker por um caminho local e provider-neutral, mantendo Patter como media gateway e Lumenva Agent OS como autoridade de negócio/persona.

## Target architecture

```text
PSTN / carrier
    ↓
Patter 0.7.1
    ├─ SileroVAD.forPhoneCall()          (local)
    ├─ LocalFasterWhisperSTT             (Speaches local)
    └─ LocalSpeechTTS
         ├─ Kokoro                       (primary, local)
         └─ Piper                        (optional fallback, local)
    ↓ transcript
Lumenva CRM / Agent OS / Memory / Policies / Tools
    ↓ approved text + VoiceDeliveryStyle
Patter → local TTS → carrier
```

`Speaches` is an implementation detail of the local speech runtime. It MUST NOT own tenant identity, memory, Agent OS, model routing, policies, tools, conversation truth, or business state.

## Hard constraints

- No Deepgram API in the production voice path.
- No ElevenLabs API in the production voice path.
- No OpenAI/Gemini hosted speech API in the production voice path.
- Carrier/PSTN cost is outside this free/local AI constraint; carrier remains replaceable.
- `VOICE_LIVE_ENABLED` stays fail-closed.
- Patter persistence/dashboard/anonymous telemetry stay disabled.
- Silero VAD is explicit and local; do not silently depend on cloud endpointing.
- STT/TTS runtime is reachable only via a configured internal URL.
- No raw transcript/reply body in new delivery telemetry.
- `blocked` Agent OS outputs never reach TTS.
- Personality and sentiment remain Lumenva-owned.
- Unsupported local TTS style fields degrade to defaults; no call failure.
- Piper is optional fallback only. Do not bundle or assume a particular Piper voice/model license; deployment must explicitly select an approved model.
- No merge to `main`.
- Inline execution only; no subagents.
- TDD/contract-first: write the failing contract before production wiring.

## Task 1 — Lock the free/local architecture contract

### Create
- `apps/crm/tests/unit/voice-local-free-contract.test.ts`

### Prove
- worker imports Patter + Silero but not `DeepgramSTT` / `ElevenLabsTTS`;
- worker contains no `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`;
- worker uses a local speech base URL;
- Patter remains media-only and `brain.runTurn` remains the content path;
- Patter telemetry/persistence stay off.

## Task 2 — Add a local Faster-Whisper Patter adapter

### Create
- `workers/voice-worker/speaches-stt.mjs`
- `workers/voice-worker/speaches-stt.test.mjs`

### Contract
Implement the Patter pipeline STT surface used by 0.7.1:
- `clone()`
- `connect()`
- `sendAudio(Buffer)`
- `onTranscript(cb)` / `offTranscript(cb)`
- `onError(cb)` / `offError(cb)`
- `finalize()`
- `close()`
- optional `warmup()`

Input is normalized PCM16/16k mono from Patter. The adapter buffers one utterance, wraps it as WAV and POSTs to local Speaches `/v1/audio/transcriptions`. `finalize()` is driven by Patter/Silero speech-end.

Safety:
- per-call state only (`clone()` mandatory);
- bounded utterance buffer;
- local HTTP timeout;
- no API key required;
- malformed/empty responses become controlled provider errors.

## Task 3 — Add local Kokoro/Piper TTS adapters

### Create
- `workers/voice-worker/speaches-tts.mjs`
- `workers/voice-worker/speaches-tts.test.mjs`

### Contract
- `synthesize(text): Promise<Buffer>`
- `synthesizeStream(text): AsyncGenerator<Buffer>`
- `outputFormat = "pcm_16000"`
- Speaches request: `/v1/audio/speech`, `response_format=pcm`, `sample_rate=16000`.

Primary is configurable Kokoro. Fallback is configurable Piper and only activates when the primary fails before emitting audio.

## Task 4 — Wire explicit Silero VAD

### Modify
- `workers/voice-worker/package.json`
- `workers/voice-worker/Dockerfile`
- `workers/voice-worker/main.mjs`

Actions:
- import `SileroVAD` from `getpatter`;
- add `onnxruntime-node@~1.18.0` explicitly;
- switch worker image from Alpine/musl to Debian slim/glibc to avoid native ONNX runtime incompatibility;
- `const vad = await SileroVAD.forPhoneCall({...})`;
- pass `vad` to `phone.agent()`.

## Task 5 — Replace paid STT/TTS wiring

### Modify
- `workers/voice-worker/main.mjs`
- `workers/voice-worker/README.md`

Remove:
- `DeepgramSTT`
- `ElevenLabsTTS`
- Deepgram/ElevenLabs secrets.

Add env surface:
- `VOICE_LOCAL_SPEECH_URL` (default `http://127.0.0.1:8000` only for same-host development; production should set an internal service URL)
- `VOICE_LOCAL_STT_MODEL`
- `VOICE_LOCAL_STT_LANGUAGE` (default `pt`)
- `VOICE_LOCAL_TTS_PRIMARY_MODEL`
- `VOICE_LOCAL_TTS_PRIMARY_VOICE`
- `VOICE_LOCAL_TTS_PRIMARY_SPEED`
- optional `VOICE_LOCAL_TTS_FALLBACK_MODEL`
- optional `VOICE_LOCAL_TTS_FALLBACK_VOICE`
- optional `VOICE_LOCAL_TTS_FALLBACK_SPEED`

## Task 6 — Preserve delivery/personality through local TTS

Keep canonical `VoiceDeliveryStyle` in CRM. No provider-specific data moves into Agent OS.

V1 safe behavior:
- store/log normalized `delivery` per call/turn as already implemented;
- local TTS uses configured voice/speed defaults;
- do not introduce shared mutable per-call style state.

V1.1 optional if Patter hook contract can prove call isolation:
- map `pace/energy` to local TTS speed on a per-utterance basis;
- never encode provider decisions in Agent OS;
- add concurrency test with two simultaneous call IDs before enabling.

## Task 7 — Version the local speech runtime deployment

### Create
- `ops/voice-local/compose.yaml`
- `ops/voice-local/README.md`
- `ops/voice-local/bootstrap-models.sh`

Use Speaches CPU image by default and persistent Hugging Face model cache. Bind the service to loopback/internal network only. Model download/bootstrap must be explicit and idempotent.

Default STT model should be configurable; do not assume a huge model on a 2-vCPU host. Kokoro model may be preloaded. Piper fallback remains optional until an explicitly approved voice/model license is selected.

## Task 8 — Remove paid-only artifacts from this feature

Delete or retire feature-only ElevenLabs mapper files created on this branch:
- `apps/crm/lib/voice/patter/elevenlabs-style.ts`
- `apps/crm/lib/voice/patter/elevenlabs-style.test.ts`

Do not delete historical/legacy integrations elsewhere without a separate migration decision.

## Task 9 — Verification gates

Update `apps/crm/scripts/verify-voice-core.sh` to include:
- local/free architecture contract;
- local STT/TTS node tests;
- syntax checks for new worker modules.

Required executable gates when a runnable checkout/CI is available:

```bash
cd workers/voice-worker
npm install
npm run check

cd ../../apps/crm
pnpm typecheck
NODE_ENV=test pnpm vitest run \
  tests/unit/voice-local-free-contract.test.ts \
  tests/unit/voice-personality-patter-contract.test.ts \
  lib/voice/runtime/delivery-style.test.ts \
  lib/voice/runtime/voice-humanizer.test.ts \
  lib/voice/runtime/turn-service.test.ts
./scripts/verify-voice-core.sh
```

## Task 10 — Live acceptance (external gate)

Not complete until a real controlled phone test proves:
- neutral turn;
- angry/frustrated caller;
- positive caller;
- barge-in;
- two concurrent calls (no STT/TTS/personality leakage);
- primary TTS unavailable → fallback before first audio;
- Speaches unavailable → controlled failure/handoff, not fabricated speech;
- Agent OS `blocked` → no audio;
- transfer path still works;
- p50/p95 latency measured.

## Definition of done

100% requires all code gates + live PSTN acceptance. If the current environment cannot run the private repository or access live telephony/model services, implementation stops at the highest evidence-backed point and reports exact percentage/blockers. No merge to `main`.