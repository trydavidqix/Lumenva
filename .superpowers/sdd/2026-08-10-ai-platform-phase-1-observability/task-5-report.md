# Task 5 — agent-turn and retrieval tracing

## Delivered

- Added an optional `AiTracer` to `InboundTurnDeps`.
- `runAgentTurn` opens one `agent_turn` span keyed by the job ID, forwards that tracer to both LLM calls and to `searchKnowledge`, and always ends the parent span in `finally`.
- Parent failure completion is the stable redacted code `agent_turn_failed`; no caught error text is exported.
- `searchKnowledge` starts a `knowledge_search` span with only opaque organization, job, KB version, `top_k`, and threshold metadata. Query text and hit content are never sent.
- Retrieval completion records only `result_count`; failure ends with `knowledge_unavailable`.
- Added focused metadata/redaction coverage, plus DB-backed lifecycle assertions for successful LLM correlation and the error closure path.

## Verification

- RED observed: `pnpm exec vitest run lib/agent-engine/agent/search-knowledge.test.ts` initially failed the two new trace assertions because no spans existed.
- PASS: `pnpm typecheck`.
- PASS: `pnpm exec vitest run lib/agent-engine/agent/search-knowledge.test.ts lib/agent-engine/edge/llm/run-model-call.test.ts` (15 tests).
- PASS with pre-existing warnings only: focused ESLint over the changed files (four `consistent-type-imports` warnings already present in `agent-no-credential.test.ts`; zero errors).
- PASS: `git diff --check`.

## Verification gap

The two DB-backed agent lifecycle tests could not be run in this environment. `pnpm test:db tests/invariants/agent-send-template-turn.test.ts tests/invariants/agent-no-credential.test.ts` stopped before Vitest because Docker is unavailable (`scripts/test-db.sh: docker: command not found`).

## Round 1 formatting correction

- Restored the original formatting of the five source/test files while retaining only the Task 5 tracing and test hunks (`git diff --stat HEAD^` reports 192 additions and 7 deletions across those files).
- Re-ran `pnpm typecheck`, the focused 15-test Vitest command, and `git diff --check` after the correction.
- The DB lifecycle suite remains inconclusive for the Docker reason above.

## Round 2 span identity correction

- Added optional `traceId` to the tracing contract. `runId` now identifies one external span, while `traceId` identifies its root trace.
- Agent turns mint a root UUID and propagate it as `traceId` to LLM and retrieval spans; every span mints its own UUID and retains the safe `job_id` metadata correlation.
- LangSmith now uses `runId` for `createRun`/`updateRun` identity and `traceId` for `trace_id` on both calls.
- Added a real `LangSmithAiTracer` fake-client regression test that proves parent/child create and update IDs differ while both retain the parent trace ID.
- PASS: `pnpm exec vitest run lib/agent-engine/obs/langsmith-adapter.test.ts lib/agent-engine/edge/llm/run-model-call.test.ts lib/agent-engine/agent/search-knowledge.test.ts` (18 tests), `pnpm typecheck`, and `git diff --check`.

## Round 3 parent hierarchy correction

- Added optional `parentRunId` to the tracing contract and propagated the parent agent-turn span ID into its LLM and retrieval children.
- LangSmith exports `parent_run_id` and derives child `dotted_order` values from the recorded parent dotted order, so child runs are explicitly nested while retaining distinct run IDs and the shared root `trace_id`.
- The real-adapter fake-client regression now asserts distinct IDs, common `trace_id`, `parent_run_id`, and a child dotted order prefixed by the parent dotted order.
- PASS: focused 18-test tracing suite, `pnpm typecheck`, and `git diff --check`.

## Round 4 dotted-order lifecycle correction

- `LangSmithAiTraceSpan.end` now removes its run ID from the adapter's dotted-order map in `finally`, including update failures. Failed creates never insert an entry.
- Parent entries remain while child spans are active, preserving their dotted-order prefix; each child removes only its own entry on completion.
- The adapter regression verifies a parent plus child creates two entries, child completion preserves only the parent entry, and parent completion returns the map to zero.
- PASS: focused 18-test tracing suite, `pnpm typecheck`, and `git diff --check`.
