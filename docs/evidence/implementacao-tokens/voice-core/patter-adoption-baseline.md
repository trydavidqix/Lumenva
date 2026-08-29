# Patter adoption baseline — Lumenva Voice Engine

Date: 2026-08-27
Branch: `implementacao-tokens-voice-core`
Starting SHA: `a7d876e54a5eaa7b517e8c8093bfbe1998a74392`
Patter reference: `PatterAI/Patter@f01875136816c953151a0e61dcf3a0057027b2b4`
License: MIT (copyright/permission notice must remain with copied/substantial portions).

## Baseline verification

The current branch is intentionally RED at `lib/voice/transfer/adapter.test.ts` because the previous TDD cycle committed the transfer boundary test before `lib/voice/transfer/adapter.ts` existed. Vercel deployment `dpl_B3J5KGNd4NN1inQa74MPZMvpDaAA` fails at TypeScript resolution with exactly:

`TS2307: Cannot find module './adapter'`

This is a known unfinished feature, not an unexplained regression. The last confirmed green functional milestones before that RED are:

- `474751fd4cd4a4a1f27bc760ac59fc766fa93e09` — Caller ID tenant-scoped, deployment READY.
- `199f0cc4d30a255cdd5f041253edad85ca380541` — Telnyx webhook verification/normalization, deployment READY with the voice gate green.
- `6598b1d7575b4a1e219b322afeb0d6703fe67c14` — LiveKit session manager, deployment READY.

The transfer RED will be closed by Task 7 of the Patter-based plan. Until then, a full branch build is expected to remain red if the gate includes that test.

## Component classification

| Component | Decision | Reason |
|---|---|---|
| `lib/voice/contracts.ts` | KEEP | Lumenva domain contract; provider-independent and tenant-aware. |
| `lib/voice/repository.ts` + `voice_calls`/events migrations | KEEP | CRM source of truth, RLS, idempotency and audit data belong to Lumenva. |
| `lib/voice/config.ts` | KEEP | Tenant policy/configuration is product logic, not media-engine logic. |
| `lib/voice/runtime/session.ts` | KEEP/ADAPT | Call-state invariants remain ours; media state transitions may delegate to the engine. |
| `lib/voice/runtime/stt-port.ts` | ADAPT | Keep provider-neutral semantics; first implementation can be Patter-backed. |
| `lib/voice/runtime/tts-port.ts` | ADAPT | Keep provider-neutral semantics; first implementation can be Patter-backed. |
| `lib/voice/runtime/barge-in.ts` | ADAPT/REPLACE | Preserve behavior contract, but let Patter drive media interruption if equivalence tests pass. |
| `lib/voice/telnyx/**` | KEEP | Signature verification, anti-replay, normalized events and tenant-first resolution are security/product boundaries. |
| `lib/voice/identity/**` | KEEP | Caller identity must remain CRM tenant-scoped and independent of Patter. |
| `lib/voice/livekit/**` | OPTIONAL | Remove from default AI path; preserve only as a future browser-human transport adapter. |
| `lib/voice/transfer/**` | KEEP/ADAPT | Business handoff stays Lumenva; transport bridge may use Patter/Telnyx. |
| Agent OS / Customer Memory / Model Router / Tool Gateway | KEEP | Patter receives no authority over reasoning, tools, identity, memory or business policy. |

## Adoption rule

No existing implementation is deleted because Patter has a similar feature. A component is replaced only after the Lumenva `VoiceEngine` contract has an equivalence test proving the replacement preserves the required behavior, security and tenant isolation.

## Target ownership

- Telnyx: PSTN carrier.
- Lumenva Voice Engine: our stable voice interface and source of voice-domain state.
- Patter-backed adapter: replaceable media/telephony implementation behind our interface.
- Lumenva Agent OS: sole authority for routing, LLM selection, reasoning, tools, policy and handoff decisions.
