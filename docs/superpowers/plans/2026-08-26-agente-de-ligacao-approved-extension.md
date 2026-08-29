# Agente de Ligação — Approved Implementation Extension

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan inline, task-by-task, on branch `implementacao-tokens`. This document is an approved extension of the master plan and must be consumed by Phases 5, 6, 7, 10, 13, 14 and 15.

**Goal:** Turn the approved Agente de Ligação mockup into a real multi-tenant voice-agent product integrated with Customer Memory, Agent OS, Telnyx, LiveKit, human transfer and the existing CRM control plane.

**Architecture:** The existing CRM remains the business source of truth. Voice is another channel into the same identity, memory, policy, tool and observability layers already used by WhatsApp; no parallel CRM or parallel agent runtime is allowed. Telnyx handles PSTN/SIP, LiveKit handles real-time media/session orchestration, Agent OS handles policy/reasoning/tools, and the CRM UI exposes live operations, history and controls.

**Tech Stack:** Next.js 16.3, React 19, TypeScript 6, Supabase/Postgres/RLS, Agent OS, Customer Memory, canonical `runModelCall` seam, Telnyx, LiveKit Cloud, STT/TTS providers selected by policy, existing Lumenva design system.

**Master Plan:** `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`

## Global Constraints

- Work only on `implementacao-tokens`; do not merge to `main` without a separate explicit authorization.
- Preserve WhatsApp multimodal and existing human-handoff behavior.
- Voice must reuse the same tenant-scoped identity, Customer Memory, Agent OS, Tool Gateway, approval and observability boundaries.
- PSTN credentials, numbers and billing remain external blockers when not already configured; code must be completed with safe configuration seams before stopping for them.
- No model may invent customer, order, price, availability, payment, ETA or consent facts.
- Human transfer must carry a concise context summary and never lose the CRM conversation/customer linkage.
- Every call/session/recording/transcript/metric row must be organization-scoped and RLS protected.
- Recording/transcription behavior must be configurable per organization and comply with consent/policy requirements.
- Mobile is a first-class control surface, not a shrunk desktop replica.
- Follow the existing Lumenva visual system: warm neutral surfaces, sage accent, Phosphor icons, low visual noise, no generic AI gradients/glass dashboards.

---

## Approved Product Surface

The approved UI direction contains:

- `Agente de Ligação` as a first-class CRM area.
- Desktop tabs: Painel, Ligações, Scripts, Números, Configurações, Análises.
- KPI strip: ligações hoje, atendidas com sucesso, tempo/conversas IA, custo IA.
- Large live-call workspace with caller identity, call duration, waveform/voice activity, current AI speaker state and controls.
- Live controls: mute/silence, pause, transfer, end call.
- Agent-assist panel with next-step suggestion, customer context, recent orders and direct link to full customer profile.
- Call queue with waiting duration and safe manual start/takeover controls.
- Agent performance block and active voice scripts.
- Mobile screens for active call, agent assist, agent panel and call history.
- Online/offline/busy presence for voice agents.
- Customer context must visually distinguish authoritative CRM/order facts from inferred/derived memory.

---

## Task V1 — Voice domain contracts and tenant-safe persistence

**Files:**
- Create: `lib/voice/contracts.ts`
- Create: `lib/voice/repository.ts`
- Create: new uniquely timestamped Supabase migration for voice sessions/calls/participants/events.
- Test: `lib/voice/*.test.ts`, DB/RLS tests.

**Produces:** canonical call/session states and storage primitives used by Telnyx, LiveKit and UI.

- [ ] Define `VoiceCallState`: `queued | ringing | connecting | active | held | transferring | completed | failed | canceled`.
- [ ] Define participant roles: customer, ai_agent, human_agent, supervisor.
- [ ] Define tenant-scoped records for call, external PSTN identifiers, LiveKit room/session, timestamps, direction, agent id, contact id, conversation id and outcome.
- [ ] Write Org A allowed / Org B denied tests before migration implementation.
- [ ] Add idempotency uniqueness for provider webhook/event identifiers.
- [ ] Store only provider identifiers needed for reconciliation; secrets never enter database rows or logs.
- [ ] Run DB/RLS/typecheck gates.

## Task V2 — Voice configuration per organization

**Files:**
- Create: `lib/voice/config.ts`
- Create/extend API routes under `app/api/v1/voice/config/**`.
- Create tenant settings UI under `app/app/settings/tenant/voice/**` or the canonical settings hub chosen by current navigation registry.

**Produces:** organization policy controlling how voice operates.

- [ ] Support modes: always AI, no-answer fallback, after-hours, overflow/busy.
- [ ] Configure default voice agent, language/locale, timezone and business hours.
- [ ] Configure recording/transcription policy and consent behavior.
- [ ] Configure allowed transfer destinations and approval requirements.
- [ ] Configure max call duration, silence timeout and retry behavior.
- [ ] Enforce RBAC consistent with existing tenant settings.

## Task V3 — Local/realtime voice pipeline before PSTN

**Files:**
- Create: `lib/voice/runtime/**`.
- Add provider-neutral STT/TTS ports and tests.

**Produces:** speech -> STT -> Agent OS -> TTS loop independent of PSTN.

- [ ] Implement streaming speech recognition port.
- [ ] Implement streaming synthesis port.
- [ ] Implement barge-in/interruption and silence detection.
- [ ] Add confidence handling for names, phone numbers and addresses.
- [ ] Share Customer Memory and Agent OS context with WhatsApp.
- [ ] Route all LLM calls through canonical `runModelCall`/router; no provider-specific LLM runtime.
- [ ] Add latency measurements for STT, model first token, TTS first audio and end-to-end turn.

## Task V4 — LiveKit session integration

**Files:**
- Create: `lib/voice/livekit/**`.
- Add secure server-side token/session endpoints.

**Produces:** realtime room/session orchestration for voice agents and human participants.

- [ ] Create/join LiveKit rooms from trusted server paths only.
- [ ] Bind `organization_id`, `voice_call_id`, contact and agent identity to server-side session metadata.
- [ ] Reconnect safely after transient media failure.
- [ ] Support hold, mute, transfer preparation and human join.
- [ ] Never expose privileged LiveKit credentials client-side.

## Task V5 — Telnyx PSTN/SIP integration

**Files:**
- Create: `lib/voice/telnyx/**`.
- Create: Telnyx webhook routes under `app/api/v1/webhooks/telnyx/**`.

**Produces:** inbound/outbound real phone calls entering the LiveKit/Agent OS runtime.

- [ ] Verify Telnyx webhook signatures and reject unsigned/invalid requests fail-closed.
- [ ] Deduplicate provider events.
- [ ] Normalize E.164 caller/callee numbers.
- [ ] Map technical Telnyx number to organization before any customer lookup.
- [ ] Route inbound SIP/media to LiveKit.
- [ ] Support outbound calls initiated only through governed Tool Gateway/UI actions.
- [ ] Keep the company’s public/traditional number compatible with carrier forwarding to the technical Telnyx number.

## Task V6 — Caller recognition and Customer Memory hydration

**Files:**
- Create: `lib/voice/identity/**`.
- Integrate with `lib/agent-engine/customer-memory/**`.

**Produces:** known caller -> exact tenant/contact -> quick memory before the AI greets them.

- [ ] Resolve organization first, then caller number inside that organization.
- [ ] Never perform global phone-number lookup across tenants.
- [ ] Hydrate bounded Customer Memory before first conversational model turn when available.
- [ ] Unknown caller creates or proposes a contact according to tenant policy; do not collect unnecessary fields.
- [ ] Write tests for same phone number existing in two organizations.

## Task V7 — Governed voice tools and commercial actions

**Files:**
- Extend canonical Tool Gateway/registry rather than creating voice-only business logic.

**Produces:** voice agent can perform the same safe CRM/order operations as WhatsApp.

- [ ] Catalogue, price, availability, order lookup/create/update and ETA remain authoritative tool reads/writes.
- [ ] Voice confirmations must read back critical fields before committing high-impact actions.
- [ ] R3/R4 actions continue to require approval/human-only behavior.
- [ ] Send post-call/order confirmations over WhatsApp using existing channel seam when tenant policy allows.

## Task V8 — Human transfer and supervisor takeover

**Files:**
- Extend existing human-handoff/case model.
- Add voice-specific transfer adapter under `lib/voice/transfer/**`.

**Produces:** AI -> human transfer without losing context.

- [ ] Trigger on explicit human request, policy, low confidence, repeated misunderstanding, severe complaint or tool failure.
- [ ] Generate deterministic/structured handoff summary from known context.
- [ ] Join/bridge human participant through LiveKit/Telnyx.
- [ ] Surface caller, recent transcript, Customer Memory and current business action to human.
- [ ] AI stops speaking once human takeover is committed unless supervisor mode explicitly allows assistance.
- [ ] Preserve call/contact/conversation linkage after transfer.

## Task V9 — Desktop Agente de Ligação control plane

**Files:**
- Create: `app/app/ai/voice/**` or canonical route chosen by current navigation registry.
- Create focused UI components under `components/voice/**`.
- Modify navigation registry only through its canonical source.

**Produces:** approved desktop mockup as functional product UI.

- [ ] Header/title `Agente de Ligação` with tabs Painel, Ligações, Scripts, Números, Configurações, Análises.
- [ ] KPI row: calls today, successfully handled, AI conversation time and AI cost.
- [ ] Live call workspace: caller, duration, waveform/activity, speaking/listening/processing state.
- [ ] Controls: mute, hold/pause, transfer, end call, all permission-gated.
- [ ] Agent-assist panel: suggested next step, customer/order context, full-profile navigation.
- [ ] Queue: waiting callers, wait time, assignment/start controls.
- [ ] Agent performance and active scripts sections.
- [ ] Empty/loading/error/offline states for every panel.
- [ ] Keyboard and screen-reader labels for all live controls.

## Task V10 — Mobile voice operation

**Files:**
- Responsive components under `components/voice/**`.
- E2E viewport coverage.

**Produces:** first-class iPhone/mobile operation matching approved mockup intent.

- [ ] Active-call screen prioritizes caller, state, waveform and four primary controls.
- [ ] Agent-assist is accessible without hiding/ending the active call.
- [ ] Queue/history screens are single-column and thumb-friendly.
- [ ] Minimum interactive target size follows design-system accessibility rules.
- [ ] Test at 390x844 plus at least one smaller width.
- [ ] No permanent 64px desktop sidebar may consume the active-call viewport; mobile navigation uses the project’s mobile shell/drawer/bottom-navigation direction when implemented.

## Task V11 — Scripts and campaigns

**Files:**
- Create voice-script domain/UI/API using current tenant-scoped configuration patterns.

**Produces:** reusable governed voice playbooks without bypassing Agent OS policy.

- [ ] Script stores objective, opening guidance, required disclosures, allowed tools, escalation conditions and version.
- [ ] Version/publish/rollback semantics mirror existing published agent/playbook patterns where possible.
- [ ] Script can be assigned to inbound number/route or outbound campaign.
- [ ] Model remains free to converse naturally inside policy; script is guidance + constraints, not a hardcoded dialogue tree unless explicitly configured.

## Task V12 — Numbers and routing UI

**Files:**
- Create numbers/routes UI and API.

**Produces:** tenant can understand which number routes where and under which mode.

- [ ] Display public number, technical Telnyx destination and routing mode without exposing secrets.
- [ ] Show health/status for Telnyx/LiveKit linkage.
- [ ] Support test-call diagnostic action with explicit confirmation.
- [ ] Prevent cross-org number assignment.

## Task V13 — Calls history, transcript and customer timeline

**Files:**
- Create calls list/detail UI and APIs.
- Integrate customer/contact timeline.

**Produces:** complete auditable call history.

- [ ] Calls list supports active, completed, failed, transferred and scheduled filters.
- [ ] Detail shows participants, outcome, duration, transcript when policy permits, tool/actions summary, transfer events and cost.
- [ ] Customer profile shows calls alongside WhatsApp/business history instead of creating a separate customer silo.
- [ ] Recording/transcript retention follows organization policy.

## Task V14 — Cost, quality and performance analytics

**Files:**
- Extend existing usage/metrics surfaces; create voice-specific aggregations only where needed.

**Produces:** the mockup’s operational metrics backed by actual data.

- [ ] Cost per call and total voice AI cost.
- [ ] STT/TTS/LLM/provider breakdown when available.
- [ ] Average latency and interruption/barge-in quality indicators.
- [ ] Resolution rate, transfer rate, abandonment rate and failed-call rate.
- [ ] Agent performance never reduces to a vanity score without underlying measurements.

## Task V15 — Safety, privacy and adversarial evals

**Files:**
- Extend `lib/agent-engine/evals/**` with voice scenarios.

**Produces:** safety gate before meaningful autonomy in real calls.

- [ ] Bad audio / ASR uncertainty.
- [ ] Wrong caller identity attempt.
- [ ] Duplicate contact and same number across tenants.
- [ ] Address/number mishearing requiring confirmation.
- [ ] Customer requests human repeatedly.
- [ ] Sensitive/legal/financial request.
- [ ] Prompt injection spoken over the phone.
- [ ] Provider disconnect mid-action.
- [ ] Transfer failure.
- [ ] Recording/transcription disabled by policy.
- [ ] No business-critical claim may be generated from low-confidence speech alone.

## Task V16 — Observability and production gate

**Produces:** operator can prove whether voice is healthy and affordable.

- [ ] Trace call lifecycle end-to-end without logging raw secrets or unnecessary PII.
- [ ] Correlate Telnyx event -> LiveKit room -> Agent OS run -> tool actions -> transfer/outcome.
- [ ] Persist latency/cost/provider/fallback metrics.
- [ ] Alert on repeated failed calls, provider outage, abnormal transfer rate and budget breach.
- [ ] Verify tenant isolation, mobile UX, human transfer and WhatsApp continuity.
- [ ] Run typecheck, unit, DB/RLS, invariants, voice E2E and production build gates on the exact final SHA.
- [ ] Record evidence under `docs/evidence/implementacao-tokens/`.
- [ ] Do not merge to `main` as part of this plan.

---

## Definition of Done

The approved mockup is considered implemented only when the visuals are backed by real state and actions: a tenant can configure voice, receive/initiate a call, identify the caller safely, hydrate Customer Memory, converse through Agent OS, use governed business tools, transfer to a human, inspect history/transcript/cost/quality, and operate the live call from desktop and mobile without cross-tenant leakage or bypassing policy.
