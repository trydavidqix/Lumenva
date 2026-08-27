# Lumenva Voice Engine — Task status

Plan: `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md`
Branch: `implementacao-tokens-voice-core`
Date: 2026-08-27

| Task | State | Evidence / note |
|---|---|---|
| 1. Baseline + KEEP/ADAPT/REPLACE/OPTIONAL | DONE | Baseline/equivalence docs; CRM identity/persistence/security retained. |
| 2. Proprietary `VoiceEngine` boundary | DONE | `lib/voice/engine/**`; provider-neutral contracts gated. |
| 3. Replaceable Patter adapter | DONE | `lib/voice/patter/adapter.ts`, factory; no Agent OS/LLM/tool authority delegated. |
| 4. Patter-backed media pipeline | DONE | media config/adapters, STT/TTS/VAD/barge-in policy; Patter persistence/telemetry disabled. |
| 5. Voice Agent Bridge -> canonical Agent OS | DONE / ACTIVATION GATED | Canonical Agent Kernel + supervisor routing + delivery policy. Current Product Agents remain `shadow`, so external speech is correctly blocked. |
| 6. Telnyx -> Lumenva Voice Engine | DONE / LIVE PROOF PENDING | Telnyx signature/replay/normalization, tenant-first technical-number resolution, persistent worker path. Real carrier credentials required for PSTN proof. |
| 7. Two-phase human transfer | DONE / LIVE PROOF PENDING | Human bridge must confirm before AI interrupt/business handoff. Carrier transfer requires live proof. |
| 8. LiveKit optional | DONE | Normal AI path has no LiveKit dependency; browser-human adapter is optional. |
| 9. Recording/metrics/observability | DONE / LIVE VALUES PENDING | CRM owns lifecycle + normalized cost/latency. Recording fails safe when disclosure/consent is required. Real cost/latency values require a live call. |
| 10. `Agente de Ligação` panel | DONE (operational baseline) | Tenant-scoped panel is surfaced with Agent OS; no Patter concept exposed to tenant. |
| 11. Equivalence + safe duplication removal | DONE | `patter-equivalence.md`; generic media delegated, CRM-specific contracts retained. No destructive removal without replacement proof. |
| 12. E2E/evidence | DONE PROVIDER-FREE / PSTN PENDING | Deterministic E2E simulator + safety evals + worker outbound-correlation tests are gated. Real PSTN inbound/outbound remains external proof. |

## Additional outbound hardening completed

The worker transport accepts only internal authenticated outbound requests. Lumenva creates a CRM `voice_call_id` before dial, reserves correlation until the real provider `callId` arrives, and rejects ambiguous same-destination pending calls.

A CRM-owned `createGovernedVoiceOutboundService` accepts only organization/contact/agent/goal. It resolves the phone and worker server-side, creates the call row, asks Agent OS for customer-safe opening copy, applies delivery governance, and only then invokes the dial transport. A blocked/shadow opening never dials.

## Activation gates that must not be bypassed

- Product Agent autonomy promotion through normal Agent OS governance.
- Telnyx account/number/connection/public key.
- persistent worker deployment and webhook hostname.
- STT/TTS provider credentials or replacement adapters.
- real PSTN inbound/outbound + transfer + latency/cost proof.
- recording consent/disclosure policy where applicable.

`VOICE_LIVE_ENABLED` remains an explicit operational switch; it is not a substitute for Agent OS authorization.
