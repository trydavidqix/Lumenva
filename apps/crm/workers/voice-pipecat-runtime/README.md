# Pipecat runtime boundary

This is the executable process boundary for the optional Python Pipecat media runtime. It does not contain STT, TTS, model, CRM, or telephony logic. The external process is the only authority for media readiness.

## Contract

Set `PIPECAT_COMMAND` to an executable and optionally `PIPECAT_ARGS` to a JSON array of string arguments. A whitespace-separated argument form is accepted for simple commands; JSON is required when arguments contain spaces. The child stdout protocol is newline-delimited JSON and must emit:

```json
{"type":"ready","protocol_version":1}
```

Only that exact readiness message makes `GET /healthz` return `200`. Missing configuration, malformed protocol, child start failure, and child exit return `503` with `runtime_not_ready`; this boundary never reports a model or media path as live by assumption.

`PORT` defaults to `8090`. The health server binds loopback by default because this process currently has no authenticated control API. A reverse proxy or a future authenticated control plane must be added before exposing it beyond the host.

## Verification and blocker

Run `node --test workers/voice-pipecat-runtime/main.test.mjs` and `node workers/voice-pipecat-runtime/main.smoke.mjs`. These prove the process lifecycle and fail-closed health behavior with a shell fixture only. They do **not** prove Pipecat, Asterisk/RTP, faster-whisper, Piper/Kokoro, or a real model.

The real runtime remains `BLOCKED EXTERNAL` until a host provides a compatible Python Pipecat executable that implements the protocol above and is connected to the existing `StreamingSttPort`, `StreamingTtsPort`, and carrier transport. No live Python/model success is claimed here.
