# Lumenva Voice Engine — implementation closure

Date: 2026-08-27
Branch: `implementacao-tokens-voice-core`
Main: not modified / not merged.

## Scope completed in code

The voice channel is implemented as a channel into the existing CRM/Agent OS, not as a second agent platform.

```text
PSTN
  -> Telnyx
  -> persistent Lumenva Voice Worker
       -> Patter-backed media (STT/TTS/VAD/barge-in/recording transport)
       -> authenticated CRM control plane
  -> tenant identity
  -> Caller ID
  -> Customer Memory
  -> canonical Agent Kernel / Product Agents
  -> canonical model seam / budgets
  -> CRM policy / handoff / observability
```

Implemented boundaries include:

- CRM-owned provider-neutral `VoiceEngine` contracts and factory.
- Patter isolated behind adapters; no CRM tool/model authority delegated to Patter.
- persistent Node voice worker with Patter 0.7.1 + Telnyx + Deepgram + ElevenLabs.
- Patter persistence/dashboard/anonymous telemetry disabled.
- technical E.164 -> tenant registry (`voice_phone_numbers`) before Caller ID.
- service-only technical-number -> private worker registry (`voice_worker_endpoints`).
- explicit `REVOKE ALL` from `anon` and `authenticated` on the private worker-endpoint registry, in addition to RLS with no tenant policies.
- tenant-scoped Caller ID and compact Customer Memory hydration.
- authenticated worker -> CRM context/turn/event control-plane endpoints.
- worker turn/lifecycle requests are bound to that worker's technical Telnyx E.164; CRM verifies the number belongs to the call organization and matches inbound `called_number` or outbound `caller_number` before accepting the request.
- call lifecycle refuses to reopen terminal (`completed/failed/canceled`) calls and refuses a conflicting provider call id.
- canonical Agent Kernel production composition for voice using the existing `runModelCall` seam.
- spoken-delivery policy derived from canonical autonomy; shadow/draft/off never become TTS.
- customer-safe output extraction only; internal rationale/action/reason fields are not spoken.
- two-phase human transfer semantics; AI is silenced only after takeover confirmation.
- LiveKit removed from the mandatory AI call path and preserved only behind optional browser-human takeover.
- normalized call lifecycle, latency and provider cost metrics persisted in CRM-owned records.
- tenant recording policy loaded by worker; recording fails safe when disclosure/consent is required.
- operations panel `Agente de Ligação` backed by tenant-scoped CRM call state.
- provider-free deterministic E2E simulator and safety evals.
- safe outbound transport correlation: CRM `voice_call_id` is reserved before dial and bound to the real provider call id on `onCallStart`; ambiguous concurrent same-destination pending calls are rejected.
- governed outbound orchestration accepts contact + goal + agent, resolves destination/source/worker server-side, requests customer-safe Agent OS opening copy, and only then invokes dial transport.
- product-facing `POST /api/v1/voice/calls` accepts only `contact_id`, Product Agent id and `goal`; no raw phone, first-message or worker URL is accepted from the client.
- persistent worker container has healthcheck, non-root runtime and graceful SIGTERM/SIGINT disconnect.

## Verified gates

Known green checkpoints during this implementation include:

- `eb9e35dcc8de4817530518cbacd26eb2bccec2fd` — READY after canonical Kernel LLM-env typing fix.
- `9821bc7fd3ff973a4abe7b3961f0ae0140ef214b` — READY with provider-free simulator + safety eval suite gated.
- `8c7067ea7e5dd78b00beca20445e559fe4ea124d` — READY with worker outbound-correlation test gated.
- `814dcbead88d8bfabb703ae1a2433da3b1515d78` — READY with governed CRM outbound orchestration implementation.
- `306a6290ea2bd5f73964d871c487e9ed31d57990` — READY with graceful worker shutdown implementation.

The authoritative gate is `scripts/verify-voice-core.sh`, which runs TypeScript typecheck, the explicit voice unit/eval suite, worker syntax/tests, tenant-filter lint, and Next.js build. It now also includes the worker technical-number/tenant-binding contract.

Latest code hardening checkpoint before this evidence-only commit: `cabfbec422aea370252a6909c28204306177ed65`.

At the time of this update, the newest HEAD cannot execute a new Vercel Preview because GitHub reports `Vercel – crm: failure` targeting `upgradeToPro=build-rate-limit`; the secondary `lumenva-website` status also points to a Vercel team-invite/access page. These are CI-runner/integration blocks, not reported compiler/test failures. There are no PR-triggered GitHub Actions runs available as an alternate runner. The latest unexecuted HEAD must not be called final-green until a runner actually executes `scripts/verify-voice-core.sh`.

## Provider-free E2E evidence

The deterministic simulator exercises:

1. provider-call input;
2. tenant/context resolution;
3. caller/contact context;
4. Agent OS turn;
5. reply vs governed block;
6. lifecycle active/completed/failed persistence.

Safety evals prove at minimum:

- unknown technical number fails before Agent OS;
- shadow-delivery policy returns no spoken reply;
- empty transcripts consume no model turn;
- provider-free call lifecycle can complete without Telnyx/STT/TTS credentials.

Worker tests additionally prove outbound pending correlation, duplicate-destination rejection and stale reservation expiry. The expanded contract also requires every worker turn/event to carry its technical number, verifies that CRM binds it to the call/tenant/direction, keeps worker endpoint URLs unavailable to tenant roles, and protects terminal/provider identity invariants.

## Intentionally fail-closed activation state

The implementation is not equivalent to a live production phone number yet. Real activation is intentionally blocked until all of the following are true:

1. Canonical Product Agents intended to speak externally are promoted through the existing governance process from `shadow` to an autonomy level authorized for voice delivery. The voice implementation must not modify that policy itself.
2. A real Telnyx number/account is provisioned and its technical E.164 is registered to the correct organization.
3. A persistent voice-worker instance is deployed for that technical number and registered in `voice_worker_endpoints`.
4. Runtime secrets are configured: Telnyx credentials, control-plane internal secret, Deepgram key, ElevenLabs key/voice id (or future provider adapters).
5. Public Telnyx/Patter webhook host is configured and reachable.
6. A real PSTN inbound/outbound E2E is executed and its provider IDs, audio latency, transfer behavior and actual cost are captured.
7. Recording remains OFF unless the tenant policy and applicable consent/disclosure flow allow it.
8. A runner executes the latest `verify-voice-core.sh` after the current Vercel build-rate-limit clears or an alternate CI runner is configured.

These are activation/provisioning/verification gates, not reasons to weaken tenant isolation or Agent OS governance.

## Multiempresa invariant

One worker instance is currently deployed per technical Telnyx number because Patter 0.7.1 has one instance-level `phoneNumber` and no per-call `from` in `LocalCallOptions`. This is an operational shard only: all workers use the same code and call the shared multi-tenant CRM control plane. Tenant identity is never selected from caller-supplied `organization_id`.

Every turn and lifecycle event is additionally checked against the technical E.164 of the worker and the persisted call direction. An inbound worker can operate only on calls whose `called_number` is that technical number; an outbound worker can operate only on calls whose `caller_number` is that technical number, and the number must be enabled in `voice_phone_numbers` for the call organization.

## Outbound safety invariant

The raw worker control endpoint is internal only. Product-facing code does not expose a `number + arbitrary text` dial API. `POST /api/v1/voice/calls` derives the organization from authenticated context, accepts contact/agent/goal only, resolves the destination and technical source number server-side, creates the tenant-scoped call, asks Agent OS for customer-safe opening copy, applies delivery governance and only then calls the registered worker. Multiple enabled source workers without an explicit routing choice fail closed rather than selecting one implicitly.

## Remaining real-world proof

No claim is made here that a live PSTN call has completed successfully in this environment. The code path is prepared and provider-free behavior is tested, but live carrier/media proof requires the external resources listed above.

## Final architecture ownership

- Telnyx: PSTN carrier.
- Lumenva Voice Worker: persistent media process.
- Patter OSS: replaceable media implementation detail.
- Deepgram / ElevenLabs: current replaceable STT/TTS providers.
- LiveKit: optional browser-human takeover only.
- CRM: tenant/customer/business source of truth.
- Customer Memory: shared omnichannel memory.
- Agent OS / Agent Kernel: reasoning/routing/governance authority.
- `runModelCall`: model/provider/budget seam.
- Tool Gateway / policies: business action authority.

The architecture can replace Patter, STT, TTS or the carrier without changing CRM identity, Customer Memory, Agent OS, tools or tenant-facing voice contracts.
