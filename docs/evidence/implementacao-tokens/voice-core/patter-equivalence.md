# Patter adoption equivalence — Lumenva Voice Engine

Date: 2026-08-27
Branch: `implementacao-tokens-voice-core`

## Decision

Patter is an internal, replaceable media implementation behind the Lumenva-owned `VoiceEngine` boundary. It is not the CRM brain, tenant authority, memory store, model router, tool gateway, policy engine, or business source of truth.

## KEEP — CRM-owned and preserved

- `lib/voice/contracts.ts`: call/domain contracts and explicit audio format.
- `lib/voice/repository.ts`: tenant-scoped call/event persistence and idempotency.
- `lib/voice/config.ts`: tenant voice policy, hours, locale, recording/transcription controls.
- `voice_phone_numbers`: technical E.164 -> organization mapping before Caller ID.
- `lib/voice/identity/**`: tenant-scoped Caller ID; unknown/ambiguous callers fail closed.
- Customer Memory hydration after tenant/contact resolution.
- `lib/voice/telnyx/webhook.ts`: Ed25519 validation, replay protection, normalized events.
- canonical Agent Kernel/Product Agents and `runModelCall` model seam.
- CRM human-handoff/case lifecycle and governance.
- CRM observability and `voice_calls` / `voice_call_events` as persisted source of truth.

## ADAPT — Patter-backed behind our interface

- streaming media pipeline;
- STT/TTS orchestration;
- VAD / barge-in transport behavior;
- carrier media lifecycle;
- recording transport;
- provider latency/cost metrics;
- outbound dialing transport.

All Patter references are constrained to the voice implementation/worker boundary. Agent OS and tenant UI consume Lumenva contracts instead.

## OPTIONAL — LiveKit

LiveKit is no longer on the normal AI <-> caller path. Existing LiveKit code remains available behind the optional browser-human takeover adapter. A normal AI PSTN call does not require LiveKit credentials.

## Provider data ownership

Patter persistence is explicitly disabled (`persist: false`), its dashboard is disabled, and anonymous SDK telemetry is disabled in the worker. The worker forwards normalized numeric lifecycle/metrics to the CRM control plane. Raw Patter webhook/call payloads and a second transcript history are not persisted by default.

## Outbound correlation

Patter `CallResult.callId` is only available when `call(..., wait: true)` resolves at terminal state, which is too late for the first live turn. Lumenva therefore creates `voice_call_id` before dialing. The worker reserves that id by destination until the real Patter/Telnyx `onCallStart` arrives, then binds the real provider call id. A second pending outbound call to the same destination on the same worker is rejected instead of being correlated heuristically.

## Multiempresa deployment

Patter 0.7.1 configures one default `phoneNumber` per instance and does not expose a per-call `from` in `LocalCallOptions`. Deployment therefore uses one identical voice-worker instance per technical Telnyx number. The shared CRM control plane remains multi-tenant; no tenant gets a fork of application code.

## Governance

Product Agents remain at their canonical autonomy levels. Voice delivery derives permission from Agent OS; `off`, `shadow`, and `draft` outputs never become TTS. The voice path does not promote agents or bypass tool/policy gates.

## Conclusion

The Patter-backed implementation replaces generic media plumbing while preserving the CRM-specific assets. No CRM identity, memory, routing, model, tool, policy, or business state is delegated to Patter. The media engine can be replaced without changing Agent OS or tenant data contracts.
