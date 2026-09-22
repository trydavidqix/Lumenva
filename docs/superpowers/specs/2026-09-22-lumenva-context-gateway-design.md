# Lumenva Context Gateway Design

## Goal

Provide a loopback-only dashboard that reports only persisted, attributable
telemetry. Every metric has `source`, `measurement_type`, and `timestamp`.

## Architecture

`core.mjs` persists task source metadata and terminal task evidence.
`telemetry.mjs` owns the append-only telemetry, discovery, aggregation,
budgets, alerts, and validation records. `dashboard.mjs` is read-only: it
serves APIs, SSE snapshots, and an interface which renders covered sources
only. `evals/` holds immutable run inputs and graders.

## Measurement policy

Provider usage is `exact`; compatible tokenizer or chars/4 is `estimated`;
missing data is `unavailable`. Exact values never downgrade. Pending tasks
never contribute savings. Old detailed telemetry is ignored after seven days;
aggregates and task evidence remain intact.

## Discovery policy

Processes, Wire terminal snapshots, task metadata, and telemetry are joined by
stable names/PIDs where available. A missing source produces a small coverage
row, never an empty feature card. Plugin attribution comes only from explicit
task metadata; legacy records are `Legacy / Não identificado`.

## Validation policy

Each A/B run records two isolated inputs, command output, token provenance,
deterministic recall and hallucination grades, and a Trust Score. A validation
is not valid until both lanes complete with real executor output.

## Constraints

No deployment, push, merge, task deletion, evidence deletion, secrets, or
invented measurements. Dashboard binds only to `127.0.0.1:7435`.
