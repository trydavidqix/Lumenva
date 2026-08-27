# Lumenva Voice Worker

Persistent media worker for the Lumenva Voice Engine. It runs Patter as an implementation detail behind CRM-owned control-plane contracts.

## Ownership boundary

- Patter: Telnyx media/WebSocket, STT, TTS, VAD/barge-in, carrier transfer primitives.
- CRM: tenant identity, Caller ID, Customer Memory, Agent OS, model selection/budget, policies, approvals, tools, handoff state, history and observability.
- The worker has no database credentials and no CRM tool credentials.
- Patter disk persistence, dashboard ingest and anonymous telemetry are disabled.

## Deployment topology

Patter 0.7.1 binds one `phoneNumber` to a `Patter` instance and does not expose a per-call `from` override. Run one worker instance per technical Telnyx number. All instances run the same image/code; the CRM remains multi-tenant and maps each E.164 number to its owner through `voice_phone_numbers`.

```text
Telnyx +351 A -> voice-worker A --\
Telnyx +351 B -> voice-worker B ----> CRM internal voice control plane -> Agent OS
Telnyx +55  C -> voice-worker C --/
```

This is an operational shard, not a tenant-specific code fork.

## Required environment

- `VOICE_LIVE_ENABLED=false` by default; set `true` only after Agent OS autonomy promotion and E2E approval.
- `TELNYX_PHONE_NUMBER`
- `TELNYX_API_KEY`
- `TELNYX_CONNECTION_ID`
- `TELNYX_PUBLIC_KEY`
- `VOICE_WEBHOOK_HOST` (bare public hostname expected by Patter)
- `VOICE_CONTROL_PLANE_URL` (CRM base URL)
- `INTERNAL_SECRET` (same internal service secret as CRM)
- `DEEPGRAM_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- optional `VOICE_STT_LANGUAGE` (default `pt`)
- optional `PORT` (default `8080`)
- optional `VOICE_CONTROL_PORT` (default `8081`)

## Safety defaults

`VOICE_LIVE_ENABLED` must be explicitly enabled. The CRM turn endpoint also checks canonical Product Agent autonomy and currently blocks `off`, `draft` and `shadow` agents before model work. A worker cannot activate an agent by itself.

## Health/control

- media/webhook server: `PORT`
- internal outbound control: `VOICE_CONTROL_PORT`
- `GET /healthz` on the control port
- `POST /v1/calls` requires `x-internal-secret`

Do not expose the control port publicly without network-level restrictions in addition to the shared secret.
