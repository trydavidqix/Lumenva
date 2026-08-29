# Channel Gateway / Meta Unofficial API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. **Do not use subagents.** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing CRM channel seam into an owned multi-tenant Channel Gateway, keep WAHA working during migration, add a preferred unofficial WhatsApp engine behind a stable engine contract, and connect normalized channel events safely to the existing multimodal/Agent OS stack.

**Architecture:** Keep the existing modular monolith and `lib/channels/` boundary. Extend it with an engine layer, normalized event envelope, session supervision, durable event/outbox processing, identity resolution, and policy-aware Agent OS integration. Engine workers are isolated runtime units but share project-owned contracts; WAHA remains a migration/fallback engine and Meta Cloud remains the official engine.

**Tech Stack:** Next.js 16, React 19, TypeScript 6 strict, Node >=22, pnpm 9.15.9, Supabase/Postgres, Upstash Redis, Vitest, Playwright, Sentry, existing `event_log` workers, WAHA, Meta Cloud, preferred unofficial WhatsApp engine (Baileys-compatible transport selected during Task 4 after exact license/version verification).

**Spec:** `docs/superpowers/specs/2026-08-24-channel-gateway-meta-unofficial-api-design.md`

## Global Constraints

- Work only on branch `implementacao-tokens`; do not merge to `main`.
- Execute inline in the current session using `superpowers:executing-plans`; no subagents.
- GitHub Actions is disabled and must not be introduced, invoked, or relied on.
- Do not deploy or touch production during intermediate steps.
- Use local/unit/DB verification throughout. **Vercel Preview is allowed only at the final verification step of a completed task block**, never after each subtask.
- Any missing secret/API credential is represented only by a documented placeholder such as `<USER_REQUIRED_WAHA_API_KEY>` or `<USER_REQUIRED_META_ACCESS_TOKEN>`; never invent, print, commit, or request real secrets during autonomous implementation.
- A missing secret must not block work that can be completed with fakes, fixtures, contract tests, disabled-by-default feature flags, or local mocks.
- PostgreSQL is the durable source of truth. Redis is ephemeral/fast state only.
- `organization_id`/tenant scope comes from trusted server context, never request body authority.
- All tenant-aware DB changes require RLS plus cross-tenant tests.
- Schema changes ship as a triple: new migration + idempotent `supabase/baseline.sql` append + `supabase/migrations/MANIFEST.md` entry; regenerate `lib/database.types.ts` rather than editing it manually.
- External input is validated with Zod.
- `/api/v1/` uses canonical `ok()` / `fail()` wrappers and canonical error codes.
- Provider-specific names remain inside the channel boundary; `pnpm lint:channels` is a required gate.
- Trigger functions never perform network HTTP.
- All replayable side effects have explicit idempotency and retry ownership.
- Secrets, bearer tokens, cookies, session keys, and PII never enter logs, screenshots, committed fixtures, or docs.
- Existing WhatsApp/multimodal behavior must remain functional while the Gateway is introduced.
- WAHA is not removed until a later migration gate has production evidence.
- Automatic migration between incompatible engine auth/session formats is forbidden.
- Do not introduce Kafka, RabbitMQ, NATS, or another queue technology unless existing `event_log` + worker infrastructure is proven insufficient by measured requirements.
- Commits are allowed and expected after each independently reviewable task; push may occur on the working feature branch. No merge to `main`.

## Secret placeholders allowed during autonomous execution

These names are documentation/config placeholders only. Implementations must remain disabled or mockable until values exist:

```text
<USER_REQUIRED_WAHA_BASE_URL>
<USER_REQUIRED_WAHA_API_KEY>
<USER_REQUIRED_META_ACCESS_TOKEN>
<USER_REQUIRED_META_PHONE_NUMBER_ID>
<USER_REQUIRED_META_APP_SECRET>
<USER_REQUIRED_BAILEYS_SESSION_SEED>   # only if a real-device smoke needs re-auth; not required for contract/unit work
<USER_REQUIRED_SENTRY_DSN>             # only if absent and a live observability smoke requires it
```

Do not block on these values until the final live-smoke tasks that explicitly require them.

---

## Locked file structure

Existing files to evolve:

```text
lib/channels/types.ts
lib/channels/capabilities.ts
lib/channels/index.ts
lib/channels/adapters/waha.ts
lib/channels/adapters/meta-cloud.ts
scripts/lint-channels.ts
lib/agent-engine/channel-adapter.ts
lib/agent-engine/edge/channel/waha-adapter.ts
supabase/baseline.sql
supabase/migrations/MANIFEST.md
lib/database.types.ts
lib/env.ts
package.json
```

New focused modules:

```text
lib/channels/gateway/types.ts
lib/channels/gateway/engine.ts
lib/channels/gateway/registry.ts
lib/channels/gateway/normalize.ts
lib/channels/gateway/capabilities.ts
lib/channels/gateway/errors.ts
lib/channels/gateway/idempotency.ts
lib/channels/gateway/session-supervisor.ts
lib/channels/gateway/identity-resolver.ts
lib/channels/gateway/outbox.ts
lib/channels/gateway/trace.ts
lib/channels/engines/waha-engine.ts
lib/channels/engines/meta-cloud-engine.ts
lib/channels/engines/baileys-engine.ts
lib/channels/engines/baileys-auth-store.ts
workers/channel-gateway/main.ts
workers/channel-gateway/inbound-consumer.ts
workers/channel-gateway/outbox-consumer.ts
workers/channel-gateway/session-supervisor.ts
```

Tests follow existing Vitest conventions under focused test files, preferably colocated as `*.test.ts` where current repo patterns permit; DB/RLS coverage remains under `tests/db/` or the existing DB harness pattern.

---

### Task 1: Freeze the existing channel seam and define regression contracts

**Files:**
- Read/modify: `lib/channels/types.ts`
- Read/modify: `lib/channels/capabilities.ts`
- Read: `lib/channels/adapters/waha.ts`
- Read: `lib/channels/adapters/meta-cloud.ts`
- Create: `lib/channels/channel-seam.contract.test.ts`
- Modify only if necessary: `scripts/lint-channels.ts`

**Interfaces:**
- Consumes: existing `ChannelAdapter`, `ChannelProvider`, `ChannelCapabilities`, `OutboundEnvelope`.
- Produces: regression contract proving current WAHA/Meta adapters remain valid while the engine seam is added later.

- [ ] **Step 1:** Write tests that instantiate/mock both existing adapters and assert the current `resolveRecipient`, `isConfigured`, `send`, `codes`, optional profile-photo, and echo-ID contracts compile and behave as expected.
- [ ] **Step 2:** Add a type-level test asserting the current provider union is only consumed inside `lib/channels/` and that future engine names must not leak to feature code.
- [ ] **Step 3:** Run `pnpm vitest run lib/channels/channel-seam.contract.test.ts`; expect the new tests to expose any undocumented seam assumptions before architecture changes.
- [ ] **Step 4:** Make the smallest compatibility-only edits needed to `types.ts`/`capabilities.ts`; do not introduce the new engine contract yet.
- [ ] **Step 5:** Run `pnpm lint:channels` and `pnpm typecheck`.
- [ ] **Step 6:** Run the focused unit test again and record the baseline result in the task notes/commit message.
- [ ] **Step 7:** Commit only the contract freeze: `test(channels): freeze existing channel seam`.
- [ ] **Step 8:** No Vercel Preview for this task because it changes no runtime behavior or UI.

**Gate:** existing adapters remain green; no provider leakage outside the canonical channel boundary.

---

### Task 2: Add project-owned Gateway, Engine, Capability, and normalized-event contracts

**Files:**
- Create: `lib/channels/gateway/types.ts`
- Create: `lib/channels/gateway/engine.ts`
- Create: `lib/channels/gateway/capabilities.ts`
- Create: `lib/channels/gateway/errors.ts`
- Create: `lib/channels/gateway/registry.ts`
- Create: `lib/channels/gateway/contracts.test.ts`
- Modify: `lib/channels/index.ts`

**Interfaces:**
- Produces exact domain contracts:
  - `ChannelName = "whatsapp" | "instagram" | "messenger"`
  - `EngineName = "waha" | "meta_cloud" | "baileys" | "browser"`
  - `ChannelCapability` string union owned by Gateway.
  - `EngineCapabilities` readonly capability set.
  - `GatewayEventEnvelope` with `eventId`, `eventType`, `organizationId`, `channel`, `accountId`, `conversationId`, optional `customerId`, optional `externalMessageId`, `occurredAt`, `traceId`, normalized `content`, and bounded diagnostic metadata.
  - `MessagingEngine` with `connect`, `disconnect`, `health`, `send`, `downloadMedia`, `capabilities`, and event subscription/ingest boundary.
  - `EngineRegistry.register(name, factory)` / `EngineRegistry.resolve(name)`.

- [ ] **Step 1:** Write failing Vitest coverage for registry duplicate registration, unknown-engine resolution, stable capability checks, and envelope required fields.
- [ ] **Step 2:** Run the focused tests and verify failure because gateway modules do not exist.
- [ ] **Step 3:** Implement `ChannelName`, `EngineName`, event-envelope, message/media action, health-state, and capability types with no provider SDK imports.
- [ ] **Step 4:** Implement `MessagingEngine` and factory types in `engine.ts`.
- [ ] **Step 5:** Implement `EngineRegistry` with deterministic duplicate/unknown errors from `errors.ts`.
- [ ] **Step 6:** Export the new boundary through `lib/channels/index.ts` without breaking existing exports.
- [ ] **Step 7:** Run focused tests, `pnpm typecheck`, and `pnpm lint:channels`.
- [ ] **Step 8:** Commit: `feat(channels): add owned gateway engine contracts`.
- [ ] **Step 9:** No Vercel Preview; contract-only task.

**Gate:** Agent/domain code can type against owned Gateway contracts without importing WAHA/Meta/Baileys SDK types.

---

### Task 3: Wrap existing WAHA and Meta Cloud implementations as engines

**Files:**
- Create: `lib/channels/engines/waha-engine.ts`
- Create: `lib/channels/engines/meta-cloud-engine.ts`
- Create: `lib/channels/engines/existing-engines.test.ts`
- Modify: `lib/channels/adapters/waha.ts`
- Modify: `lib/channels/adapters/meta-cloud.ts`
- Modify: `lib/channels/index.ts`

**Interfaces:**
- Consumes: `MessagingEngine`, `GatewayEventEnvelope`, `EngineCapabilities`, current adapter behavior.
- Produces: `createWahaEngine(config)` and `createMetaCloudEngine(config)` implementing the exact Task 2 interface.

- [ ] **Step 1:** Write fake-transport tests proving each wrapper maps send success/failure, health, capabilities, and provider payloads without real network calls.
- [ ] **Step 2:** Verify RED with focused tests.
- [ ] **Step 3:** Refactor common provider-independent mapping out of the existing adapter only where necessary; preserve old public adapter behavior.
- [ ] **Step 4:** Implement WAHA engine using dependency-injected fetch/client so unit tests never need `<USER_REQUIRED_WAHA_API_KEY>`.
- [ ] **Step 5:** Implement Meta Cloud engine using dependency-injected transport so tests never need `<USER_REQUIRED_META_ACCESS_TOKEN>`.
- [ ] **Step 6:** Add capability declarations reflecting actual supported operations; do not claim unsupported capabilities.
- [ ] **Step 7:** Run focused tests + existing channel-seam test + `pnpm lint:channels` + `pnpm typecheck`.
- [ ] **Step 8:** Commit: `refactor(channels): wrap existing providers as engines`.
- [ ] **Step 9:** Run `pnpm test:unit` as the task-level regression gate.
- [ ] **Step 10:** **Only now**, if the branch is already connected to Vercel and no new credential is required, run/check one Vercel Preview build. If preview requires unavailable secrets, record `PREVIEW_BLOCKED_BY_USER_SECRET` and continue; do not ask for the secret yet.

**Gate:** WAHA and Meta Cloud work through the owned engine contract while existing channel behavior stays green.

---

### Task 4: Add the preferred unofficial WhatsApp engine behind a disabled-by-default feature flag

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `lib/channels/engines/baileys-engine.ts`
- Create: `lib/channels/engines/baileys-auth-store.ts`
- Create: `lib/channels/engines/baileys-engine.test.ts`
- Modify: `lib/env.ts`
- Modify: `.env.example`
- Create: `docs/licenses/channel-engine-dependencies.md`

**Interfaces:**
- Produces: `createBaileysEngine({ authStore, logger, clock })` implementing `MessagingEngine`.
- Produces: `BaileysAuthStore` abstraction with load/save/delete using encrypted persisted blobs through a storage adapter.
- Feature flag: `CHANNEL_GATEWAY_BAILEYS_ENABLED=false` by default.

- [ ] **Step 1:** Verify the exact current package/version/license chosen for the unofficial engine before adding it; record version and license in `docs/licenses/channel-engine-dependencies.md`. Do not copy source from external projects.
- [ ] **Step 2:** Add the dependency with pnpm and commit the lockfile change only with this task.
- [ ] **Step 3:** Write RED tests with a fake socket factory for lifecycle, message mapping, reconnection signal, media metadata, and capability reporting.
- [ ] **Step 4:** Implement the engine using dependency injection around the socket/client factory so no live WhatsApp session is required for tests.
- [ ] **Step 5:** Implement `BaileysAuthStore`; test encryption/decryption through a fake key-provider boundary. Never commit a real pairing/session artifact.
- [ ] **Step 6:** Add env parsing for `CHANNEL_GATEWAY_BAILEYS_ENABLED`; default false. Any real auth seed remains `<USER_REQUIRED_BAILEYS_SESSION_SEED>` and is never required for unit tests.
- [ ] **Step 7:** Run focused tests + `pnpm typecheck` + `pnpm lint:channels` + `pnpm test:unit`.
- [ ] **Step 8:** Commit: `feat(channels): add disabled unofficial whatsapp engine`.
- [ ] **Step 9:** Do not pair a real device yet.
- [ ] **Step 10:** Vercel Preview only now; feature flag must remain false in preview unless a safe test account is explicitly configured later.

**Gate:** engine compiles, is unit-tested, is disabled by default, and requires no user secret to keep moving.

---

### Task 5: Persist Gateway accounts, sessions, events, idempotency, and outbox with tenant isolation

**Files:**
- Create: `supabase/migrations/<next_timestamp>_channel_gateway_core.sql`
- Modify: `supabase/baseline.sql`
- Modify: `supabase/migrations/MANIFEST.md`
- Regenerate: `lib/database.types.ts`
- Create: `tests/db/channel-gateway-core.test.ts`

**Schema to create/extend:**
- `channel_accounts`
- `channel_sessions`
- `channel_events`
- `channel_idempotency`
- `channel_outbox`
- `channel_delivery_attempts`

All tenant-aware rows include `organization_id`; unique constraints include tenant/account scope where required. Session secret material stores ciphertext/reference only, never plaintext.

- [ ] **Step 1:** Write DB tests first for two organizations proving cross-tenant reads/writes are denied and service-role queries require explicit organization filters.
- [ ] **Step 2:** Add idempotency tests for duplicate `(organization_id, account_id, external_message_id/event key)` insert behavior.
- [ ] **Step 3:** Add outbox-state tests for `pending -> processing -> sent` and retry/failure metadata without network calls.
- [ ] **Step 4:** Create one forward migration; do not edit previous migrations.
- [ ] **Step 5:** Append the same schema idempotently to `supabase/baseline.sql` and add the manifest entry.
- [ ] **Step 6:** Regenerate `lib/database.types.ts` using the repo's canonical Supabase/type workflow; never hand-edit generated types.
- [ ] **Step 7:** Run `pnpm test:db` and focused DB tests. If a local Supabase prerequisite is missing, document the exact local blocker and continue with static/unit work only; do not request production DB access.
- [ ] **Step 8:** Run `pnpm typecheck` and `pnpm lint:tenant-filter`.
- [ ] **Step 9:** Commit: `feat(db): add tenant-safe channel gateway persistence`.
- [ ] **Step 10:** No Vercel Preview unless the migration can be applied safely to a disposable preview DB; never apply to production as a preview shortcut.

**Gate:** RLS/cross-tenant isolation and idempotent durable state are proven locally/test DB.

---

### Task 6: Implement normalization, durable inbound ingestion, and idempotent event consumption

**Files:**
- Create: `lib/channels/gateway/normalize.ts`
- Create: `lib/channels/gateway/idempotency.ts`
- Create: `workers/channel-gateway/inbound-consumer.ts`
- Create: `lib/channels/gateway/inbound.test.ts`
- Modify: existing webhook/ingest entry points identified by search for WAHA/Meta inbound handling.

**Interfaces:**
- Produces: `normalizeProviderEvent(input): GatewayEventEnvelope` through engine-specific mappers.
- Produces: `persistInboundEvent(envelope)` that durably inserts before publishing/processing.
- Produces: `consumeInboundEvent(eventId)` with idempotent ownership.

- [ ] **Step 1:** Inventory exact current WAHA/Meta webhook handlers and add regression fixtures for text, image, audio, video, document, from-me echo, delivery/read events, and malformed payloads.
- [ ] **Step 2:** Write RED normalization tests using synthetic provider payloads stripped of real PII.
- [ ] **Step 3:** Implement engine-specific mapper functions inside the channel boundary and a provider-independent normalized envelope.
- [ ] **Step 4:** Implement durable `receive -> normalize -> persist -> publish/process` ordering using existing `event_log`/worker infrastructure rather than adding a new queue product.
- [ ] **Step 5:** Handle uniqueness conflict as successful duplicate suppression, not a 500.
- [ ] **Step 6:** Preserve `fromMe`/echo semantics to avoid duplicate conversation messages.
- [ ] **Step 7:** Run focused tests + `pnpm test:unit` + `pnpm lint:channels` + `pnpm lint:tenant-filter`.
- [ ] **Step 8:** Commit: `feat(channels): normalize and persist inbound channel events`.
- [ ] **Step 9:** Run `pnpm build` as the block gate.
- [ ] **Step 10:** Vercel Preview only after Step 9; use fixture-driven webhook smoke if no live secrets exist.

**Gate:** provider payloads stop leaking past the Gateway boundary and duplicates do not duplicate domain work.

---

### Task 7: Implement transactional outbound outbox, retry classification, DLQ state, and delivery worker

**Files:**
- Create: `lib/channels/gateway/outbox.ts`
- Create: `workers/channel-gateway/outbox-consumer.ts`
- Create: `lib/channels/gateway/outbox.test.ts`
- Modify: existing outbound send orchestration to enqueue owned outbox intents before transport send.

**Interfaces:**
- `enqueueOutboundIntent(tx, intent)` writes message/domain intent + outbox row in one DB transaction.
- `claimOutboxBatch(workerId, limit)` claims with lease/locking semantics.
- `classifyDeliveryError(error) -> "transient" | "permanent"`.
- `markDelivered`, `scheduleRetry`, `markDeadLetter` update durable status.

- [ ] **Step 1:** Write RED tests for crash-after-commit, duplicate worker claim prevention, transient retry, permanent failure, max-attempt dead-letter, and idempotent business operation keys.
- [ ] **Step 2:** Implement atomic enqueue using the existing DB transaction pattern available in the repo.
- [ ] **Step 3:** Implement bounded exponential backoff with jitter from an injected clock/random source for deterministic tests.
- [ ] **Step 4:** Implement claim/lease behavior so one outbox item cannot be concurrently sent by two workers.
- [ ] **Step 5:** Route delivery through `EngineRegistry` and capability checks; never branch on provider names in domain code.
- [ ] **Step 6:** Ensure no automatic switch from Baileys to WAHA/Meta on send failure; incompatible engine migration stays explicit.
- [ ] **Step 7:** Run focused tests + `pnpm test:unit` + `pnpm typecheck`.
- [ ] **Step 8:** Commit: `feat(channels): add durable outbound outbox delivery`.
- [ ] **Step 9:** Run `pnpm build`.
- [ ] **Step 10:** Vercel Preview only now; perform a no-side-effect dry/fake transport smoke unless a safe preview account already exists.

**Gate:** a committed outbound intent survives process crash and cannot silently duplicate transactional actions.

---

### Task 8: Add Session Supervisor, worker leases, health model, and controlled recovery

**Files:**
- Create: `lib/channels/gateway/session-supervisor.ts`
- Create: `workers/channel-gateway/session-supervisor.ts`
- Create: `lib/channels/gateway/session-supervisor.test.ts`
- Modify: Redis helper modules only through existing project patterns.

**Interfaces:**
- `SessionHealth = "up" | "degraded" | "down"`.
- Supervisor input includes auth state, last event, last successful send, ACK activity if available, heartbeat, latency, consecutive errors, active engine.
- Lease key includes organization/account/session scope and has explicit TTL/owner.

- [ ] **Step 1:** Write tests for healthy, stale-events-but-connected, auth-expired, repeated-send-failure, expired lease takeover, and two-worker contention.
- [ ] **Step 2:** Implement pure health classification first.
- [ ] **Step 3:** Implement Redis lease acquisition/renew/release through the existing Upstash abstraction; never make Redis the only durable session state.
- [ ] **Step 4:** Implement recovery actions: reconnect current engine, restart current worker/session runtime, or mark operator attention required.
- [ ] **Step 5:** Explicitly forbid supervisor-driven engine migration.
- [ ] **Step 6:** Add structured, redacted health logging and metrics hooks.
- [ ] **Step 7:** Run focused tests + `pnpm test:unit` + `pnpm typecheck`.
- [ ] **Step 8:** Commit: `feat(channels): supervise session health and leases`.
- [ ] **Step 9:** Run `pnpm build`.
- [ ] **Step 10:** Vercel Preview only now; preview smoke may validate health endpoints with fake engine status and no user secret.

**Gate:** socket-connected-but-dead event flow becomes `degraded`, and abandoned session ownership can recover safely.

---

### Task 9: Add Identity Resolver and bridge to existing Customer Memory without duplicating it

**Files:**
- Create: `lib/channels/gateway/identity-resolver.ts`
- Create: `lib/channels/gateway/identity-resolver.test.ts`
- Modify: current customer/contact identity modules found by repository search, reusing `contacts.wa_identity` and phone canonicalization.
- Modify DB only if the existing identity model cannot represent account-scoped Instagram/Messenger identities; if required, use a new migration triple.

**Interfaces:**
- `resolveCustomerIdentity({ organizationId, channel, accountId, externalIdentity }) -> { customerId | null, confidence: "exact" | "unresolved" }`.
- Weak/name similarity never auto-merges customers.

- [ ] **Step 1:** Inventory current phone/contact identity functions and tests before adding schema.
- [ ] **Step 2:** Write exact-match tests for E.164/WhatsApp identity and cross-tenant isolation.
- [ ] **Step 3:** Write unresolved tests for ambiguous/name-only identities.
- [ ] **Step 4:** Implement resolver by composing existing canonical phone/WA identity paths.
- [ ] **Step 5:** Add a generic external identity table only if Task 9 inventory proves current schema cannot represent new channels; if added, ship migration + baseline + manifest + generated types + DB tests in this same task.
- [ ] **Step 6:** Connect resolved `customerId` to the existing Customer Memory seam; do not create a second memory database.
- [ ] **Step 7:** Run focused unit/DB tests, `pnpm lint:tenant-filter`, and `pnpm typecheck`.
- [ ] **Step 8:** Commit: `feat(channels): resolve channel identities to customers`.
- [ ] **Step 9:** Run `pnpm test:unit`.
- [ ] **Step 10:** No preview unless a user-facing identity path changed; if it did, Vercel Preview only now.

**Gate:** one customer can own multiple exact external identities without accidental cross-tenant or fuzzy merges.

---

### Task 10: Connect normalized multimodal inputs to Agent OS and Tool Gateway policy

**Files:**
- Modify/reuse existing multimodal pipeline files discovered from `docs/handoffs/HANDOFF-inbox-multimodal.md` and current implementation search.
- Create: `lib/channels/gateway/user-input.ts`
- Create: `lib/channels/gateway/agent-bridge.ts`
- Create: `lib/channels/gateway/agent-bridge.test.ts`
- Modify: existing Agent OS runtime/tool gateway entry points only through their canonical seams.

**Interfaces:**
- `NormalizedUserInput` contains text, image/media refs, transcript, document refs, video-derived summary where existing pipeline supports it, channel context, organization/account/conversation/customer IDs, and trace ID.
- `dispatchToAgent(input)` passes compact Customer Memory context, not full conversation history by default.

- [ ] **Step 1:** Inventory the existing multimodal derivation and Agent OS entry contracts; document exact functions used in task notes.
- [ ] **Step 2:** Write RED tests for text, image, audio transcript, video/document reference, and media-analysis failure degradation.
- [ ] **Step 3:** Implement adapter from `GatewayEventEnvelope` to `NormalizedUserInput` by reusing existing media/storage/transcription components.
- [ ] **Step 4:** Resolve customer and fetch only L0/L1 fast memory by default; expose explicit retrieval function for L2/L3 when Agent OS requests it.
- [ ] **Step 5:** Route tool calls through existing Tool Gateway/policy; no direct DB writes from the agent bridge.
- [ ] **Step 6:** Add a regression test that a model-derived product guess cannot bypass catalogue/inventory authoritative lookup.
- [ ] **Step 7:** Run focused tests + existing Agent OS/multimodal tests + `pnpm ai:eval:local` if the current eval harness supports fixture-only execution.
- [ ] **Step 8:** Commit: `feat(agent): bridge normalized channel input to agent os`.
- [ ] **Step 9:** Run `pnpm build`.
- [ ] **Step 10:** Vercel Preview only now; fixture/mock journey if live provider keys are absent.

**Gate:** Agent OS consumes project-owned normalized input and compact memory with policy-controlled tools.

---

### Task 11: Add traceability, security guardrails, redaction, evals, and shadow-safe execution

**Files:**
- Create: `lib/channels/gateway/trace.ts`
- Create: `lib/channels/gateway/security.test.ts`
- Modify: structured logger/Sentry integration through existing canonical logging modules.
- Modify/add: local AI eval fixtures/scripts under existing `scripts/ai-platform-eval.ts` conventions.

**Interfaces:**
- One `traceId` follows receipt -> identity -> memory -> agent -> tools -> outbox -> delivery.
- Shadow execution cannot call side-effecting tools.

- [ ] **Step 1:** Write tests proving logs redact tokens, cookies, auth/session material, message bodies where policy requires, and PII fields selected by current logger doctrine.
- [ ] **Step 2:** Add prompt-injection fixture where external document text asks to override policy; assert it remains untrusted content and cannot authorize a restricted tool.
- [ ] **Step 3:** Add cross-tenant eval fixture and assert zero access to tenant B resources.
- [ ] **Step 4:** Add shadow-mode fixture where candidate agent can read allowed fixture data but any side-effecting tool returns a deterministic shadow-denied result.
- [ ] **Step 5:** Thread trace/correlation IDs through the Gateway path and structured logs without raw secrets.
- [ ] **Step 6:** Add metrics hooks for session state, reconnects, delivery latency, queue/outbox lag, agent latency/tokens/cost where existing telemetry exposes them.
- [ ] **Step 7:** Run security tests + `pnpm ai:eval:local` + `pnpm test:unit` + `pnpm gov:verify`.
- [ ] **Step 8:** Commit: `feat(channels): add gateway guardrails observability and evals`.
- [ ] **Step 9:** Run `pnpm build`.
- [ ] **Step 10:** Vercel Preview only now; verify fixture-driven diagnostics/health surfaces. Do not add secrets solely to make preview green.

**Gate:** no secret leakage, no cross-tenant leakage, no shadow side effects, and end-to-end trace IDs exist.

---

### Task 12: Put the owned Gateway in front of WAHA without changing production default

**Files:**
- Modify exact current inbound/outbound WAHA integration entry points discovered in Task 6.
- Create: `lib/channels/gateway/router.ts`
- Create: `lib/channels/gateway/router.test.ts`
- Modify: `lib/env.ts`
- Modify: `.env.example`

**Interfaces / flags:**

```text
CHANNEL_GATEWAY_ENABLED=false
CHANNEL_GATEWAY_DEFAULT_WHATSAPP_ENGINE=waha
CHANNEL_GATEWAY_BAILEYS_ENABLED=false
```

When Gateway is enabled, account configuration resolves engine explicitly. Existing installs stay behaviorally WAHA-first until rollout.

- [ ] **Step 1:** Write tests for Gateway disabled -> exact legacy behavior and Gateway enabled -> WahaEngine behavior.
- [ ] **Step 2:** Implement account-scoped engine selection through registry/config; never infer engine from arbitrary provider payloads in domain code.
- [ ] **Step 3:** Add disabled-by-default flags to `lib/env.ts` and `.env.example` with no secret values.
- [ ] **Step 4:** Route inbound WAHA events through normalization/persistence and outbound WAHA sends through outbox/engine while preserving external behavior.
- [ ] **Step 5:** Add rollback test proving setting Gateway disabled returns to the legacy path without losing CRM conversation state.
- [ ] **Step 6:** Run channel, multimodal, unit, type, tenant, and local eval suites.
- [ ] **Step 7:** Run `pnpm gov:verify`.
- [ ] **Step 8:** Commit: `feat(channels): front existing whatsapp flow with owned gateway`.
- [ ] **Step 9:** Run full `pnpm build`.
- [ ] **Step 10:** Vercel Preview only now. If preview lacks WAHA credentials, verify startup, configuration parsing, fake/fixture ingress, and that disabled/default flags produce no runtime secret requirement.

**Gate:** owned Gateway can front WAHA while default behavior remains WAHA and rollback is a config change, not a code revert.

---

### Task 13: Canary-readiness controls for Baileys without performing a live customer migration

**Files:**
- Create: `lib/channels/gateway/migration.ts`
- Create: `lib/channels/gateway/migration.test.ts`
- Modify channel-account configuration surface/data model only if needed.
- Create/update: `docs/runbooks/channel-gateway-rollout.md`

**Interfaces:**
- Explicit account-level `engine_name` / migration state.
- `migrationRequiresReauth(from, to)` returns true for incompatible auth boundaries unless a verified adapter explicitly says otherwise.
- No automatic failover between incompatible engines.

- [ ] **Step 1:** Write migration-state tests for WAHA -> Baileys requiring explicit operator action/reauth and for rollback preserving domain state.
- [ ] **Step 2:** Implement account-level engine selection/migration state machine: `legacy`, `shadow_ready`, `canary`, `active`, `rollback_required` (or equivalent exact enum defined in migration/schema if persisted).
- [ ] **Step 3:** Add rollout metrics query/helpers for delivery success, error rate, reconnect success, p95 latency, memory/CPU telemetry if measurable, and queue lag.
- [ ] **Step 4:** Add hard gate helpers for zero message loss, zero duplicate business actions, zero tenant leakage, and zero critical multimodal regression based on available evidence.
- [ ] **Step 5:** Write `docs/runbooks/channel-gateway-rollout.md` with explicit no-big-bang and rollback steps, but no real credentials.
- [ ] **Step 6:** Run focused tests + `pnpm test:unit` + `pnpm test:db` if schema changed.
- [ ] **Step 7:** Commit: `feat(channels): add explicit whatsapp engine migration controls`.
- [ ] **Step 8:** Run `pnpm gov:verify` and `pnpm build`.
- [ ] **Step 9:** Do **not** migrate any real account yet; this is readiness only.
- [ ] **Step 10:** Vercel Preview only now; exercise migration UI/API only with fixture/test account data if such a surface exists.

**Gate:** code is ready for an explicit canary, but no real session/account is switched autonomously.

---

### Task 14: Final autonomous verification and documentation reconciliation

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `docs/current-state.md`
- Modify: `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`
- Modify: relevant channel/WhatsApp handoff docs if they would otherwise claim direct WAHA coupling.
- Modify: `README.md`/`README.en.md` only if public architecture statements become stale.

- [ ] **Step 1:** Re-read the design spec and map every requirement to implemented code/tests; list any unimplemented item caused solely by missing user credential/external account access.
- [ ] **Step 2:** Run `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:channels`, `pnpm lint:tenant-filter`, `pnpm test:unit`, `pnpm test:db`, `pnpm ai:eval:local`, `pnpm gov:verify`, and `pnpm build` as applicable to the local environment.
- [ ] **Step 3:** If a command is blocked by an unavailable local service or secret, record the exact blocked proof separately; do not weaken tests or bypass guards.
- [ ] **Step 4:** Reconcile architecture/current-state docs to state that CRM/Agent OS target the owned Channel Gateway and WAHA is an engine/fallback during migration, not the domain boundary.
- [ ] **Step 5:** Update the master implementation plan cross-reference so this Gateway plan is the canonical sub-plan for the unofficial Meta/WhatsApp channel work.
- [ ] **Step 6:** Run documentation/harness checks required by repo doctrine: `pnpm test:harness` and `pnpm harness:check`.
- [ ] **Step 7:** Commit: `docs(channels): reconcile channel gateway implementation state`.
- [ ] **Step 8:** Confirm branch is still `implementacao-tokens`; confirm no merge/rebase into `main` occurred; confirm GitHub Actions were not added or used.
- [ ] **Step 9:** Push the feature branch if connector/credentials permit; do not open/merge a PR unless separately requested.
- [ ] **Step 10:** **Final Vercel Preview for the completed implementation only.** Verify build/startup, representative fixture journey, tenant-safe API behavior, and no secret-required code path when optional engines remain disabled. This is the final preview gate, not a production deploy.

**Gate:** everything achievable without external credentials is complete, tested, documented, committed, and preview-verified; remaining blockers are explicit credential/account-dependent items only.

---

## Deferred user-dependent live checks

These are the only intended places where autonomous work may stop on external credentials/account ownership after all mock/fixture/local work is complete:

1. Pair a real WhatsApp test number/session with the unofficial engine if `<USER_REQUIRED_BAILEYS_SESSION_SEED>` or interactive QR/pairing is required.
2. Live WAHA smoke if no safe WAHA preview/test credential is already configured.
3. Live Meta Cloud smoke if `<USER_REQUIRED_META_ACCESS_TOKEN>` / phone number ID / app secret are unavailable.
4. Actual canary migration of a real account from WAHA to Baileys.
5. Production deployment or production migration. This plan does not authorize production changes merely because implementation is green.

For every deferred item, leave the system disabled-by-default, document the exact env key or operator action required, and continue all unrelated tasks.

## Required end-state report

At completion, report four buckets only:

```text
DONE_AUTONOMOUSLY
- code/tests/docs completed without user input

VERIFIED
- exact local/test/preview commands and results

USER_DEPENDENCY
- only real secrets/accounts/pairing/production actions still needed

NOT_DONE
- any genuine implementation gap not caused by user dependency
```

Do not claim 100% if `NOT_DONE` is non-empty. A missing optional live credential belongs in `USER_DEPENDENCY`, not `NOT_DONE`, when the implementation and mock/contract coverage are complete.
