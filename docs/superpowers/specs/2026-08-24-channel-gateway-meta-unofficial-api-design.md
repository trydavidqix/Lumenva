# Channel Gateway / Meta Unofficial API — Design Specification

**Date:** 2026-08-24
**Branch:** `implementacao-tokens`
**Status:** Design approved in conversation; implementation not started

## 1. Goal

Build an owned, multi-tenant Channel Gateway for the CRM, starting with WhatsApp and designed to extend to Instagram and Messenger. The CRM and Agent OS must not depend directly on WAHA, Baileys, Meta SDKs, Instagrapi, Mautrix, or any other transport implementation.

The gateway is inspired by architectural lessons from Evolution API, WAHA, Baileys, WPPConnect, whatsapp-web.js, Instagrapi, and Mautrix, but its core contracts, normalized event model, tenancy, identity, policy, reliability, and Agent OS integration are owned by this project.

## 2. Architectural decision

Use a modular monolith for the control/domain plane with isolated engine workers. Engines are replaceable behind stable interfaces. WAHA remains available during migration and as a compatibility/fallback engine; Baileys is the preferred initial unofficial WhatsApp engine; Meta Cloud is the official adapter.

High-level flow:

```text
Channels
  -> Channel Gateway
  -> Channel Adapter
  -> Engine
  -> Event Normalizer
  -> Identity Resolver
  -> Customer Memory / Multimodal Pipeline
  -> Agent OS
  -> Policy + Tool Gateway
  -> Response Router
  -> Channel Gateway
  -> Customer
```

## 3. Core boundaries

### ChannelAdapter

Represents channel semantics, not a concrete vendor/library. Initial adapters: WhatsApp, Instagram, Messenger.

The adapter owns account lifecycle, send/download operations, conversation semantics, capability exposure, and conversion between engine-specific payloads and gateway domain types.

### MessagingEngine

Represents a replaceable transport/runtime implementation. Initial WhatsApp engines:

- `BaileysEngine`: preferred unofficial engine.
- `WahaEngine`: migration/compatibility fallback.
- `MetaCloudEngine`: official WhatsApp provider.
- `BrowserEngine`: optional fallback for capabilities that require a browser-based implementation.

Engines only connect channels, receive provider events, expose transport capabilities, and execute channel actions. They must not access CRM domain data, Customer Memory, orders, leads, or Agent OS directly.

### Capability Registry

Every engine advertises explicit capabilities. The Agent OS or response layer must check capabilities before requesting channel-specific actions. Capabilities include text, image, video, audio, documents, reactions, groups, presence, templates, and future channel-specific features.

No automatic provider switch may assume equivalent authentication or capabilities.

## 4. Normalized event model

Provider payloads are converted to a project-owned event envelope before entering CRM/Agent OS flows.

Required envelope identity fields:

- `event_id`
- `event_type`
- `tenant_id`
- `channel`
- `account_id`
- `conversation_id`
- `customer_id` when resolved
- `external_message_id` when applicable
- timestamps
- normalized content/media references
- trace/correlation identifier

Initial event families:

- `account.connected`
- `account.disconnected`
- `account.degraded`
- `message.received`
- `message.sent`
- `message.delivered`
- `message.read`
- `message.failed`
- `media.received`
- `conversation.created`
- `conversation.updated`
- `customer.typing`
- `customer.presence_changed`

Channel-specific payloads may be retained as bounded diagnostic metadata, but downstream domain logic must not depend on them.

## 5. Multi-tenancy

`tenant_id` is mandatory throughout the gateway. Tenant scope applies to accounts, sessions, customers, conversations, messages, media, queues, outbox records, idempotency keys, logs, metrics, caches, and storage paths.

Every account-scoped operation also carries `account_id`. Domain APIs must never retrieve a conversation, message, media object, or session using an unscoped identifier alone.

Database RLS is used where applicable. Queue jobs and Redis keys include tenant scope. Object storage paths are tenant/account scoped.

## 6. Session Supervisor

Each channel account has an independently supervised session. Health is not defined as socket connectivity alone.

Health signals include:

- authentication state
- last event received
- last successful send
- ACK/delivery activity where available
- latency
- heartbeat
- consecutive errors
- reconnect history
- active engine

States include at least `UP`, `DEGRADED`, and `DOWN`.

Recovery policy may reconnect an engine, restart its worker, restore persistent auth state, or escalate to an operator. Switching between incompatible engines is an explicit migration action, not an automatic retry.

## 7. Persistence and reliability

### PostgreSQL

PostgreSQL is the source of truth for durable gateway state. Durable data includes tenants, channel accounts, session metadata, customers, conversations, messages, message status, normalized events, outbox entries, delivery attempts, idempotency records, and audit events.

### Redis

Redis is used for ephemeral/fast state only: locks, rate limits, presence, typing, worker leases, heartbeats, caches, and temporary deduplication. Durable business state must not exist only in Redis.

### Session credentials

Engine authentication material is persisted in encrypted storage. Local VPS files are not the source of truth. Session records are scoped by tenant, account, engine type, and session version.

### Media

Media binaries belong in object storage; metadata and hashes belong in PostgreSQL. Agent OS receives media references/IDs and obtains binary content through the media service when needed.

### Inbound processing order

Inbound events follow:

`receive -> normalize -> persist -> publish -> process`

The system must be able to recover persisted-but-unprocessed work after a crash.

### Idempotency

Inbound event idempotency includes tenant, channel, account, and external event/message identity. Commercial tools such as order creation and booking creation also require operation-level idempotency so retries cannot duplicate business actions.

### Transactional outbox

Outbound intent and its outbox record are committed atomically. A worker drains the outbox and performs delivery. A process crash after commit must not lose the pending delivery.

### Retry and DLQ

Transient failures use bounded exponential backoff with jitter. Permanent failures do not loop. Exhausted work enters a dead-letter state/queue with auditability and explicit reprocessing/discard controls.

### Worker leases

Only one active worker may own a channel session at a time. Lease expiry allows another worker to recover abandoned work after a crash.

## 8. Identity Resolver

The gateway resolves external identities into project-owned `customer_id` records. Channel identities remain separate identifiers linked to the customer.

Examples include E.164 phone identity, WhatsApp identity, Instagram user ID, Messenger user ID, and authenticated web identities.

Identity linking must be evidence-based; the system must not merge two customers merely because names or weak profile attributes resemble each other.

## 9. Customer Memory and token efficiency

Customer context is layered:

- L0 Identity: stable identifiers and basic customer identity.
- L1 Fast Memory: compact structured context such as relevant preferences, current address, last order, recent summary, and service flags.
- L2 Relevant Memory: selectively retrieved semantic/relevant facts.
- L3 Full History: complete conversations, orders, calls, tickets, and historical events.

Normal turns begin with L0 + L1. L2/L3 are retrieved only when needed. Full conversation history must not be sent to an LLM on every turn.

## 10. Multimodal input

Text, images, audio, video, PDFs/documents, and supported stickers/media are converted into a normalized `UserInput` representation containing text, media references/derived understanding, transcript or summary where applicable, metadata, and channel context.

Existing CRM multimodal infrastructure should be reused where compatible rather than rebuilt.

Model-derived interpretation must not replace authoritative CRM/tool data. For example, product availability is verified through catalogue/inventory tools rather than invented from an image or conversation.

## 11. Agent OS and Tool Gateway

Agent OS consumes only gateway/domain contracts; it never imports transport libraries directly.

Tools are mediated by the Tool Gateway and policy layer. Suggested risk tiers:

- read-only operations
- low-risk writes
- transactional operations
- high-risk/restricted operations

Agents do not access the database directly for business actions. Tool execution performs tenant, permission, capability, schema, policy, and idempotency checks and writes an audit record.

Human handoff occurs when requested by the customer, required by policy, confidence is insufficient, repeated failures occur, or an operation cannot be safely authorized. Handoff includes customer identity, concise conversation summary, actions already taken, and escalation reason.

## 12. Security and guardrails

Secrets, cookies, tokens, and session keys must not appear in logs or plaintext application storage. Runtime access is minimized and rotation supported where possible.

External messages, images, documents, websites, and extracted text are untrusted content. Their instructions never override system, agent, or tool policy.

Authority order is:

`system policy > agent policy > tool policy > user request > external content`

Destructive/high-risk tools are denied by default unless explicitly designed and authorized.

## 13. Observability

Every customer interaction has a trace/correlation ID spanning channel receipt, identity resolution, memory retrieval, model routing, tool calls, response generation, outbox delivery, and channel acknowledgement.

Observability covers:

- infrastructure: CPU, memory, queue depth, worker health
- channel: sessions, disconnects, delivery/ACK latency, failures, media errors
- agent: model/provider, tokens, latency, tool calls, cost, handoff, outcome

Sensitive customer content is excluded or redacted from logs by default.

## 14. Evals and shadow mode

Regression evaluation covers response correctness, correct tool use, no fabricated authoritative data, tenant isolation, prohibited-action prevention, correct handoff, cost, and latency.

New agents/model policies can run in shadow mode: they receive production-shaped inputs and produce non-customer-visible outputs for comparison. Shadow execution must not perform side-effecting tools.

## 15. WAHA migration strategy

No big-bang replacement.

1. Put the owned Channel Gateway in front of existing WAHA flows using `WahaEngine`.
2. Convert WAHA-specific payloads to normalized gateway events so CRM/Agent OS no longer consume WAHA shapes.
3. Implement and validate `BaileysEngine` without immediately making it the production default.
4. Canary selected accounts onto Baileys with explicit account-level engine configuration.
5. Increase rollout only while gates remain green.
6. Make Baileys the preferred unofficial engine after evidence supports it.
7. Keep or remove WAHA based on production evidence, not architectural preference.

Migration does not assume sessions are portable between engines. Reauthentication requirements are explicit.

Rollback is account-scoped and must preserve CRM/domain state even when transport reauthentication is necessary.

## 16. Migration gates

A rollout stage does not advance with any observed:

- message loss
- duplicate business actions
- tenant leakage
- critical multimodal regression
- critical engine crashes without recovery

Track delivery success, p95 latency, reconnect success, memory per session, CPU per session, queue lag, and error rate. Regression beyond agreed operational thresholds stops rollout and triggers rollback/investigation.

## 17. Scope discipline / YAGNI

Initial implementation does not need every integration exposed by Evolution API. Do not introduce Kafka, RabbitMQ, NATS, or multiple queue technologies merely for parity. Use the CRM's existing infrastructure where suitable and add infrastructure only when measured requirements justify it.

Do not clone external projects wholesale. Architectural patterns may be adopted; external source code is incorporated only after explicit license compatibility review.

## 18. Licensing boundary

Treat Baileys, WAHA, Evolution API, WPPConnect, whatsapp-web.js, Instagrapi, and Mautrix as independently licensed dependencies/reference implementations. Before copying or vendoring source code, verify the exact current license and obligations for that code/version. The owned gateway should prefer stable public interfaces/dependencies over copied source.

## 19. Success criteria

The first production-capable WhatsApp milestone is complete when:

1. CRM/Agent OS have no direct dependency on WAHA/Baileys provider payloads.
2. At least WAHA and the preferred unofficial WhatsApp engine conform to the owned adapter/engine contracts.
3. Inbound/outbound text and existing supported multimodal flows pass through normalized gateway contracts.
4. Tenant isolation is enforced across persistence, cache, queue, media, sessions, and tool execution.
5. Crash recovery cannot silently lose persisted inbound work or committed outbound intent.
6. Duplicate provider events and retries cannot duplicate transactional business actions.
7. Session health, retries, failures, delivery status, and traces are observable.
8. Existing WhatsApp functionality can remain on WAHA while accounts are migrated incrementally.
9. Rollback is account-scoped and documented.
10. Security/eval gates demonstrate no cross-tenant leakage and no unauthorized high-risk tool execution.

Instagram and Messenger use the same owned contracts when added, without requiring Agent OS to learn provider-specific payloads.

## 20. Explicit non-goals for the first implementation

- Reimplementing Meta/WhatsApp cryptographic protocols from scratch.
- Removing WAHA before the replacement has production evidence.
- Supporting every Evolution/WAHA/WPPConnect feature on day one.
- Automatic migration between engines with incompatible authentication.
- Rebuilding existing CRM multimodal features that already satisfy the gateway contract.
- Introducing distributed infrastructure without measured need.
