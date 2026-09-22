# Lumenva Core — M1 Design

Status: proposed
Date: 2026-09-22
Scope: first executable Lumenva Core slice, isolated from production and the main checkout.

## Intent and acceptance

M1 introduces a persistent local Core that owns runtime state and exposes a small, deterministic contract for the future Electron shell. The first vertical slice must prove:

```text
Core process → SQLite → Event Bus → MCG → telemetry → Codex Agent Node
```

The Core must start without the Desktop shell, recover state after restart, and fail closed when an adapter is unavailable. Electron, xterm.js/node-pty, and the full visual canvas remain consumers of this contract and are not implemented in this slice.

## Recommended architecture

Use a Node.js 22 ESM package at `apps/core`, written in TypeScript and compiled to `dist/`. Keep the public boundary transport-neutral in the first slice: an in-process command API plus a loopback JSON HTTP adapter for the future Desktop shell. No network listener binds outside `127.0.0.1`.

Components:

- `CoreRuntime`: lifecycle, dependency wiring, graceful shutdown, and recovery.
- `SqliteStore`: migrations, schema version, transactions, and durable records.
- `EventBus`: typed append-and-publish events with sequence and correlation IDs.
- `MgcAdapter`: calls the existing MCG CLI/API contract and records provenance.
- `CodexAgent`: starts a read-only Codex execution through an adapter; no secrets or unrestricted shell policy.
- `TelemetrySink`: writes exact provider usage and runtime events to the existing telemetry shape consumed by MCG.
- `CoreApi`: health, start/stop agent, task status, and event replay endpoints for the future Desktop shell.

SQLite is the source of truth for Core-owned lifecycle state. MCG remains the source of truth for context compilation, cache, history, validation, and context telemetry. The Core stores references and provenance instead of duplicating MCG state.

## Data flow

1. `CoreRuntime.start()` opens SQLite, applies migrations, restores non-terminal tasks, and creates the event sequence.
2. `CoreApi` accepts a command with an idempotency key and creates a durable task before execution.
3. `CodexAgent` emits `agent.started`, invokes the MCG adapter for context, then invokes the Codex executor with the task policy.
4. Each transition is committed to SQLite and published through `EventBus`; telemetry is emitted only after the durable transition succeeds.
5. Completion stores result metadata, token provenance, trace/task IDs, and terminal state. Failure stores a typed error and never fabricates savings or success.
6. On restart, tasks in non-terminal states become `RECOVERING`; the runtime emits a recovery event and either resumes through an idempotent command or marks `BLOCKED_OWNER` with evidence.

## Contracts

Every command and event carries:

- `id`, `type`, `schema_version`, `created_at`;
- `task_id`, `trace_id`, and optional `parent_event_id`;
- `source`, `measurement_type`, and policy metadata;
- a typed payload validated before persistence.

Initial commands: `core.health`, `task.start`, `task.cancel`, `task.get`, `events.replay`.

Initial events: `core.started`, `task.created`, `agent.started`, `context.requested`, `context.completed`, `agent.completed`, `task.completed`, `task.failed`, `core.recovered`.

The API must return `UNAVAILABLE` with provenance when MCG or Codex is not connected. It must not return fake zero metrics, `NaN`, or a successful task for an unavailable adapter.

## SQLite schema and recovery

Initial tables:

- `schema_migrations(version, applied_at)`;
- `tasks(id, type, status, idempotency_key, trace_id, created_at, updated_at, result_json, error_json)`;
- `events(sequence, id, type, task_id, trace_id, payload_json, created_at)`;
- `agents(id, provider, status, last_seen_at, metadata_json)`.

Writes use transactions. Event sequence is monotonic and replay is ordered by sequence. Migrations are forward-only in M1 and each migration is tested against a fresh database and a restart from the previous version.

## Error and security policy

- Bind only to loopback.
- Default agent execution is read-only and non-interactive.
- No credentials are written to SQLite, events, telemetry, or dashboard payloads.
- Adapter failures are typed as `MCG_UNAVAILABLE`, `CODEX_UNAVAILABLE`, `POLICY_DENIED`, `TIMEOUT`, or `RECOVERY_REQUIRED`.
- Cancellation is durable and idempotent.
- Shutdown closes adapters, flushes telemetry, commits SQLite, and exits non-zero only for unrecoverable startup failure.

## Verification plan

The implementation is complete only when these executable checks pass:

1. Fresh Core starts, migrates SQLite, answers health, and exits cleanly.
2. A task creates the expected event sequence and survives process restart.
3. A second command with the same idempotency key does not duplicate the task.
4. MCG adapter success produces provenance-linked telemetry; adapter failure produces `UNAVAILABLE` without fake metrics.
5. Codex Agent Node runs through the safe executor and persists exact usage when available.
6. Event replay returns the same ordered events after restart.
7. Core package tests, typecheck, syntax/import smoke, sensitive scan, and an end-to-end local smoke pass.

## Deferred boundaries

Electron shell, xterm.js/node-pty, visual Agent Nodes, Pixel Floor, multi-provider runtime management, and removal of Maestri are later milestones. M1 exposes the contracts they need without coupling Core state to a UI process.
