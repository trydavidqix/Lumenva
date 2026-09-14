# Lumenva Local Speech Runtime

This directory versions the **free/local AI-audio** runtime used by the Patter voice worker.

## Ownership

```text
Patter
  ├─ Silero VAD (local ONNX)
  ├─ faster-whisper via Speaches (local STT)
  └─ Kokoro / optional Piper via Speaches (local TTS)
       ↓
Lumenva Agent OS
  ├─ tenant identity
  ├─ CRM / memory / Contact 360
  ├─ policies / approvals
  ├─ tools / MCP
  ├─ personality / sentiment
  └─ approved reply
```

Speaches is **not** a business runtime. It receives audio/text and returns transcript/audio only.

## Cost boundary

There is no paid STT/TTS API in this stack. CPU/RAM/storage are consumed on the host you already operate. The PSTN/carrier itself can still have telephony charges.

## Start

```bash
cd ops/voice-local
docker compose up -d
```

The default compose binds Speaches to `127.0.0.1:8000`; do not expose it directly to the public internet.

If the Patter worker runs in another container or another trusted host, put both services on an internal network and set `VOICE_LOCAL_SPEECH_URL` to that private endpoint. Do not publish Speaches merely to make container networking easier.

## Models

The model IDs are deployment configuration, not hardcoded business rules.

Required:

```bash
export VOICE_LOCAL_STT_MODEL='<approved faster-whisper model id>'
export VOICE_LOCAL_TTS_PRIMARY_MODEL='speaches-ai/Kokoro-82M-v1.0-ONNX'
export VOICE_LOCAL_TTS_PRIMARY_VOICE='<approved voice id>'
```

Then:

```bash
bash ./bootstrap-models.sh
```

`bootstrap-models.sh` waits for Speaches and asks its model API to ensure the configured models exist locally.

### Portuguese note

Do **not** silently choose a Brazilian-Portuguese Kokoro voice for a Portuguese tenant. The voice ID is mandatory in the worker configuration so deployment can select a reviewed voice deliberately.

Piper fallback is optional:

```bash
export VOICE_LOCAL_TTS_FALLBACK_MODEL='<approved piper model id>'
export VOICE_LOCAL_TTS_FALLBACK_VOICE='<approved piper voice id>'
```

Both fallback variables must be configured together. Model/voice licensing must be reviewed before commercial deployment; the application does not bundle a Piper voice model.

## Worker configuration

The worker consumes:

```text
VOICE_LOCAL_SPEECH_URL
VOICE_LOCAL_STT_MODEL
VOICE_LOCAL_STT_LANGUAGE
VOICE_LOCAL_STT_TIMEOUT_MS
VOICE_LOCAL_STT_MAX_UTTERANCE_SECONDS
VOICE_LOCAL_TTS_PRIMARY_MODEL
VOICE_LOCAL_TTS_PRIMARY_VOICE
VOICE_LOCAL_TTS_PRIMARY_SPEED
VOICE_LOCAL_TTS_FALLBACK_MODEL        (optional)
VOICE_LOCAL_TTS_FALLBACK_VOICE        (optional)
VOICE_LOCAL_TTS_FALLBACK_SPEED        (optional)
VOICE_VAD_MIN_SILENCE_SECONDS
```

There are intentionally no Deepgram or ElevenLabs credentials in this path.

## Production gates

Before rollout:

1. Run worker unit/syntax checks.
2. Run CRM Voice Core verification.
3. Test two concurrent calls and prove no audio/transcript state crosses call IDs.
4. Test barge-in with Silero.
5. Kill the primary TTS before first audio and confirm fallback.
6. Kill Speaches and confirm controlled failure/handoff instead of fabricated speech.
7. Measure p50/p95 STT, Agent OS and TTS latency.
8. Keep `VOICE_LIVE_ENABLED=false` until the live acceptance evidence is complete.
