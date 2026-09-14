# Lumenva Voice Worker

Persistent media worker for the Lumenva Voice Engine. It runs Patter as an implementation detail behind CRM-owned control-plane contracts.

## Ownership boundary

- **Patter:** Telnyx media/WebSocket, pipeline lifecycle, Silero VAD/barge-in, carrier transfer primitives.
- **Local speech runtime (Speaches):** faster-whisper STT + configured Kokoro/Piper TTS only.
- **CRM / Agent OS:** tenant identity, Caller ID, Customer Memory, model routing/budget, policies, approvals, tools, handoff state, history, personality, sentiment and business observability.
- The worker has no database credentials and no CRM tool credentials.
- Patter disk persistence, dashboard ingest and anonymous telemetry are disabled.

The production voice path does **not** require a paid STT/TTS API. Carrier/PSTN charges are a separate telephony concern.

## Runtime flow

```text
Telnyx / PSTN
    ↓
Patter
    ├─ Silero VAD (local ONNX)
    ├─ SpeachesFasterWhisperSTT → local Speaches
    └─ SpeachesLocalTTS → Kokoro / optional Piper fallback
    ↓ transcript
CRM internal voice control plane
    ↓
Lumenva Agent OS
    ↓ approved text + delivery metadata
Patter beforeSynthesize(callId)
    ↓ call-scoped delivery envelope
local TTS → phone
```

Patter never becomes the business brain. `onMessage` delegates content to `brain.runTurn()` and only an authorized Agent OS `reply` is speakable.

## Deployment topology

Patter 0.7.1 binds one `phoneNumber` to a `Patter` instance and does not expose a per-call `from` override. Run one worker instance per technical Telnyx number. All instances run the same image/code; the CRM remains multi-tenant and maps each E.164 number to its owner through `voice_phone_numbers`.

```text
Telnyx +351 A -> voice-worker A --\
Telnyx +351 B -> voice-worker B ----> CRM internal voice control plane -> Agent OS
Telnyx +55  C -> voice-worker C --/
                         |
                         +----> trusted local Speaches runtime
```

This is an operational shard, not a tenant-specific code fork.

## Required environment

Control/telephony:

- `VOICE_LIVE_ENABLED=false` by default; set `true` only after Agent OS autonomy promotion and E2E approval.
- `TELNYX_PHONE_NUMBER`
- `TELNYX_API_KEY`
- `TELNYX_CONNECTION_ID`
- `TELNYX_PUBLIC_KEY`
- `VOICE_WEBHOOK_HOST` (bare public hostname expected by Patter)
- `VOICE_CONTROL_PLANE_URL` (CRM base URL)
- `INTERNAL_SECRET` (same internal service secret as CRM)

Local speech:

- `VOICE_LOCAL_SPEECH_URL` — optional, defaults to `http://127.0.0.1:8000`; production should set the trusted internal Speaches endpoint when it is not on the same host.
- `VOICE_LOCAL_STT_MODEL` — required faster-whisper-compatible model ID installed in Speaches.
- `VOICE_LOCAL_STT_LANGUAGE` — optional; falls back to tenant locale and then `pt`.
- `VOICE_LOCAL_STT_TIMEOUT_MS` — optional, default `20000`.
- `VOICE_LOCAL_STT_MAX_UTTERANCE_SECONDS` — optional, default `30`.
- `VOICE_LOCAL_TTS_PRIMARY_MODEL` — required, normally an approved Kokoro model.
- `VOICE_LOCAL_TTS_PRIMARY_VOICE` — required; intentionally no silent locale-specific default.
- `VOICE_LOCAL_TTS_PRIMARY_SPEED` — optional, default `1`.
- `VOICE_LOCAL_TTS_FALLBACK_MODEL` — optional Piper/local fallback model.
- `VOICE_LOCAL_TTS_FALLBACK_VOICE` — optional; required when fallback model is set.
- `VOICE_LOCAL_TTS_FALLBACK_SPEED` — optional, default `1` when fallback is enabled.
- `VOICE_VAD_MIN_SILENCE_SECONDS` — optional, default `0.5`, accepted range `0.1..2`.

Delivery context:

- `VOICE_DELIVERY_CONTEXT_TTL_MS` — optional, default `120000`; bounded retention window for recent reply delivery metadata.
- `VOICE_DELIVERY_CONTEXT_RESPONSES` — optional, default `4`; maximum recent replies retained per provider `callId` to survive barge-in/cancel races without shared global style.

Other:

- `VOICE_OUTBOUND_PENDING_TTL_MS` — optional, default `60000`.
- `PORT` — optional, default `8080`.
- `VOICE_CONTROL_PORT` — optional, default `8081`.

There are intentionally no hosted STT/TTS API secrets in this worker path.

## Local speech runtime

See `ops/voice-local/` for the versioned Speaches CPU deployment and model bootstrap. The default compose binds to loopback only. Do not expose the model server publicly.

The worker asks Speaches for:

- `/v1/audio/transcriptions` — faster-whisper, one finalized utterance at a time;
- `/v1/audio/speech` — PCM16/16 kHz speech generation.

Patter owns the final carrier codec conversion.

## Call-scoped emotional delivery

Agent OS owns personality and sentiment. The worker receives provider-neutral delivery metadata such as:

```json
{
  "affect": "empathetic",
  "pace": "slow",
  "energy": 0.35,
  "tone": "warm"
}
```

The worker records that metadata against Patter's provider `callId` and the exact approved response text. Patter's pipeline-mode `beforeSynthesize(text, hookContext)` hook exposes `hookContext.callId` per sentence, so the worker can attach the matching delivery metadata immediately before TTS without mutating a shared provider object.

The internal envelope is removed inside `SpeachesLocalTTS` before the text is sent to Speaches. Control metadata is therefore never intended to be spoken or stored by the speech model.

Current acoustic mapping is deliberately conservative:

- `slow` → base TTS speed × `0.92`;
- `normal` → configured base speed;
- `fast` → base TTS speed × `1.06`;
- final speed is clamped to `0.75..1.25`.

`affect`, `tone`, and `energy` remain provider-neutral metadata and observability fields. They are **not** falsely mapped to unsupported Kokoro/Piper controls. If a future local provider exposes call-scoped pitch/style/prosody controls, its adapter can consume the same metadata without moving personality ownership out of Lumenva.

Concurrency rule: if a synthesized sentence cannot be matched to a recent approved reply for that same `callId`, the worker fails safe to the provider's default speed instead of guessing. Recent replies are retained briefly so an older sentence finishing during a barge-in/cancel race can still resolve its own style. `onCallEnd` clears the call state.

## VAD / barge-in

Silero VAD is loaded explicitly with `SileroVAD.forPhoneCall()` and `onnxruntime-node@~1.18.0` is pinned in the worker. We do not rely on Patter's optional silent fallback when ONNX is absent.

`VOICE_VAD_MIN_SILENCE_SECONDS=0.5` is the conservative starting point for natural telephone pauses. It must be tuned with real calls, not guessed from unit tests.

## TTS fallback rule

Kokoro/local primary may fall back to the configured Piper/local provider **only before the first audio byte is emitted**. If the primary fails mid-sentence after audio has already reached the caller, the worker does not switch voices and replay/mix the sentence.

Voice/model licensing remains a deployment responsibility. The application does not bundle a Piper voice model.

## Safety defaults

`VOICE_LIVE_ENABLED` must be explicitly enabled. The CRM turn endpoint also checks canonical Product Agent autonomy and blocks `off`, `draft` and `shadow` agents before model work. A worker cannot activate an agent by itself.

Recording is controlled by tenant policy loaded from the CRM control plane. If recording is enabled but the tenant policy requires a disclosure/consent flow, the worker keeps recording OFF until that flow exists; it never silently records just because the carrier can.

## Outbound correlation

The CRM must create a tenant-scoped `voice_calls` row before dialing and send its `voice_call_id` to `POST /v1/calls` together with the target E.164 and the already-governed first message.

Patter only exposes its real provider `callId` after the carrier starts/finishes the call. The worker therefore holds a short-lived pending reservation keyed by destination. On `onCallStart`, it consumes that reservation and binds the real provider call id back to the existing CRM row. A second pending call to the same destination is rejected with `outbound_destination_busy`; no heuristic matching is allowed.

## Health/control

- media/webhook server: `PORT`
- internal outbound control: `VOICE_CONTROL_PORT`
- `GET /healthz` on the control port
- `POST /v1/calls` requires `x-internal-secret`, `voice_call_id`, target E.164, and an optional pre-approved first message

Do not expose the control port publicly without network-level restrictions in addition to the shared secret.

## Verification

```bash
npm install
npm run check
```

The worker gate includes syntax checks plus call-scoped delivery, STT/TTS isolation, local health, outbound correlation and fallback tests.

The full repo gate is `apps/crm/scripts/verify-voice-core.sh` from a runnable checkout. Live rollout additionally requires a controlled PSTN test with barge-in and at least two concurrent calls.
