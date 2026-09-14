# Voice local/free sandbox verification — 2026-09-14

Branch: `feat/voice-personality-patter-inline`
PR: #37 (draft / do not merge)

This evidence records only checks actually executed in the assistant sandbox using source fetched from this branch through the GitHub connector. It does **not** claim a full-monorepo pass, a real-model Speaches pass, or a live PSTN pass.

## Fresh verification run

### Node worker-focused suites — 35/35 passed, 0 failed

Executed with Node 22 against the current branch implementations.

Breakdown:

- brain client + control server + pending outbound: **9/9**
- call-scoped delivery context: **8/8**
- delivery log + Speaches health: **5/5**
- faster-whisper/Speaches STT adapter: **6/6**
- Kokoro/Piper/Speaches TTS adapter: **7/7**

Covered:

- `delivery` metadata survives CRM-style HTTP transport through the worker brain client;
- `/healthz` fails closed when local speech is unavailable;
- outbound dialing is rejected before carrier use while speech runtime is unavailable;
- outbound reservation carries `organization_id` and rejects requests without it;
- destination reservations are unique, expire, and validate E.164/call/tenant identity;
- provider-neutral delivery metadata is validated and strips unrelated payload fields;
- call-scoped delivery envelopes round-trip without becoming speakable text;
- corrupt internal envelopes fail closed;
- `slow` maps to `0.92x`, `fast` to `1.06x`, normal preserves base speed, bounded to the provider-safe range;
- concurrent calls keep different delivery styles on the same TTS provider instance without mutating its base speed;
- stale/cancelled response metadata does not inherit the wrong style;
- call delivery state clears and expires;
- PCM16 mono WAV generation is valid;
- faster-whisper requests are local/keyless and final transcripts are isolated per call;
- STT utterance buffering is bounded;
- closing a call aborts in-flight STT and suppresses late transcript/error callbacks;
- local TTS requests PCM16/16 kHz with no hosted TTS key;
- the internal delivery envelope is removed before text reaches Speaches;
- Kokoro -> Piper fallback happens only before the first primary audio byte;
- fallback never changes voice mid-sentence after primary audio has started;
- local TTS validates model, voice and non-empty text.

### TypeScript focused runtime assertions — 16/16 passed

The exact current branch source for the pure runtime modules was executed with Node 22 type stripping and a minimal assertion harness. This is focused runtime evidence, not a substitute for the repository's full `pnpm typecheck`/Vitest gate.

Covered:

- negative + warm personality -> empathetic / slow / warm delivery;
- negative + professional -> calm / slow / serious;
- positive + casual may be upbeat but remains energy-bounded;
- professional personality cannot become hyper-upbeat;
- absent personality uses the professional neutral default;
- humanizer removes canned bot praise and visual Markdown;
- humanizer preserves numbers, dates, prices, identifiers and factual sentences;
- humanizer can reduce a canned-only response to empty, matching the fail-closed case enforced by `turn-service`;
- voice output policy accepts one/two short turns with an explicit handoff cue;
- voice output policy rejects >2 sentences;
- voice output policy rejects raw digits/currency symbols;
- voice output policy rejects missing end-of-turn cues;
- voice output policy rejects empty output.

### Syntax checks — 8/8 passed

`node --check` passed for the reconstructed current branch sources of:

- `brain-client.mjs`
- `control-server.mjs`
- `pending-outbound.mjs`
- `delivery-context.mjs`
- `delivery-log.mjs`
- `speaches-health.mjs`
- `speaches-stt.mjs`
- `speaches-tts.mjs`

## Review closure

All six inline review threads currently present on PR #37 are resolved. The fixes verified in branch source include:

- cwd-independent contract-test paths;
- conversation personality moved onto the versioned canonical `AgentDefinition`;
- post-humanizer empty text fails closed with `voice_agent_output_not_speakable`;
- inbound/outbound tenant identity is propagated and `lumenva_voice_delivery` logs carry `organization_id`;
- evidence/plan no longer treats GitHub Actions as an authoritative gate.

## Static branch verification

Fetched directly from the branch:

- `workers/voice-worker/main.mjs` uses call-scoped `beforeSynthesize(callId)` delivery decoration and logs tenant-tagged delivery metadata;
- inbound context returns `organization_id`;
- outbound CRM -> worker control requests send `organization_id`;
- pending outbound reservations retain tenant identity and fail closed without it;
- `/api/internal/voice/turn` regression coverage asserts `delivery` is returned unchanged;
- `brain-client.mjs` transparently returns the CRM control-plane payload;
- Product Agent conversation style is owned by the versioned `AgentDefinition`, not a parallel runtime registry;
- `turn-service.ts` re-checks text after humanization and fails closed if no speakable text remains;
- production worker path uses local Silero/faster-whisper/Kokoro/Piper infrastructure and no Deepgram/ElevenLabs adapter path;
- worker package pins `getpatter` `0.7.1` and `onnxruntime-node` `~1.18.0`.

## Verification doctrine correction

GitHub Actions is intentionally disabled by repository doctrine and is **not** an authoritative completion gate for this task. The temporary branch-only workflow previously created during experimentation has been removed. PR #37 remains a draft review surface only.

Canonical full-checkout commands, when a complete runnable checkout is available:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm lint:tenant-filter
pnpm test:unit
cd apps/crm && bash scripts/verify-voice-core.sh
cd ../../workers/voice-worker && npm run check
```

These full-monorepo commands remain **unmeasured in this assistant environment** unless explicitly recorded otherwise.

## Remaining gates before 100% production-proven

1. Full repository install/typecheck/lint/unit/`verify-voice-core.sh` in a complete checkout.
2. Resolve the current Vercel Preview team/access configuration and run the final Preview only after local gates are green.
3. Start a real Speaches runtime with approved faster-whisper/Kokoro/Piper model assets.
4. Controlled real PSTN call.
5. Two overlapping real calls with different delivery styles.
6. Barge-in/interruption, runtime failure/fallback, transfer/handoff and endpointing-to-first-audio p50/p95 measurement.
7. Richer acoustic emotion beyond pace remains provider-capability-dependent; no unsupported Kokoro/Piper prosody behavior is claimed.

No merge to `main` was performed or authorized.
