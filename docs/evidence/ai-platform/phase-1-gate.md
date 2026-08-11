# Phase 1 — observability gate

Date: 2026-08-11
Scope: optional LangSmith observability only; no external account, API key, provider activation, network experiment, or production request was used.

## Decision

**NO-GO.** The local safety proofs below passed, but the full gate is incomplete: database verification is blocked by the missing Docker CLI, the full unit suite did not conclude in the bounded local runner, and the production build did not conclude or produce a `BUILD_ID`.

This is not evidence of a remote LangSmith experiment. It is local fake-client evidence only.

## Feature OFF — Phase 0 preservation

Command:

```bash
pnpm vitest run lib/agent-engine/edge/llm/run-model-call.test.ts \
  lib/agent-engine/obs/langsmith-adapter.test.ts \
  lib/agent-engine/obs/external-tracing-config.test.ts \
  lib/agent-engine/obs/external-redaction.test.ts
pnpm ai:eval:local
```

Result: the focused suite passed (4 files, 23 tests). `resolveExternalTracingConfig` explicitly proved that feature mode `off` resolves to `{ enabled: false }`; the tracer then uses the no-op path. The local evaluator produced the same Phase 0 baseline shape:

```json
{"total":25,"duplicate_ids":0,"p0_failures":0,"status":"pass"}
```

No LangSmith client is created in the OFF test path.

## Controlled SHADOW trace shape and data minimization

The focused suite uses an injected fake LangSmith client with synthetic configuration. It proved the client receives only this sanitized shape:

- opaque `organization_id` (`tenant_<hash>`), not the source UUID;
- trace name with e-mail replaced by `[EMAIL]`;
- sensitive fields replaced by `[REDACTED]`;
- e-mail and telephone text replaced by `[EMAIL]` and `[PHONE]`;
- metadata-first LLM spans (no system prompt, raw customer prompt, or provider credential).

The test serializes the fake-client calls and warning fields, asserting that neither source tenant IDs nor synthetic sensitive values appear. This is a local inspection of payloads before the client boundary; it does not prove remote ingestion.

## Controlled outage proof

`runModelCall` was exercised with the real `LangSmithAiTracer` and an injected fake client that rejects its trace start with each condition below:

| Simulated external condition | Agent/model result | Trace effect |
| --- | --- | --- |
| timeout | model fake returns `ok` | one credential-safe structured warning |
| HTTP 401 | model fake returns `ok` | one credential-safe structured warning |
| HTTP 429 | model fake returns `ok` | one credential-safe structured warning |

The warnings contain only `event=langsmith_trace_failure`, `operation=start`, an opaque tenant label, and `trace_name=llm_model_call`. The fake trace configuration value is asserted absent from warning serialization.

## Full local gate

| Command | Result | Evidence / limitation |
| --- | --- | --- |
| `pnpm typecheck` | PASS | `tsc --noEmit` exited successfully. |
| `pnpm lint` | PASS | `eslint .` exited successfully. |
| `pnpm test:unit` | BLOCKED / inconclusive | The full Vitest process remained running beyond the bounded capture (one process exceeded nine minutes) and was terminated. No green result is claimed. Focused observability tests passed separately. |
| `pnpm test:db` | BLOCKED | Attempted; `scripts/test-db.sh` stopped at `docker: command not found`. Docker is unavailable on this Mac. |
| `pnpm ai:eval:local` | PASS | 25 synthetic cases, 0 duplicate IDs, 0 P0 failures. |
| `pnpm build` | BLOCKED / inconclusive | Two bounded attempts reached `Creating an optimized production build ...` without a final success result or `.next/BUILD_ID`. The first left a stale generated `.next/lock`; with no active build process, that lock alone was removed before retry. |
| `git diff --check` | PASS | Re-run after Task 7 commit `d16399f0` against the current worktree; no whitespace errors reported. This is current-state evidence, not a claim about pre-commit timing. |

## Required follow-up before GO

1. Install/start Docker locally (or use an approved disposable Postgres environment) and rerun `pnpm test:db`.
2. Diagnose why full `pnpm test:unit` does not exit in this runner; retain its final result.
3. Diagnose the incomplete `pnpm build`, then retain successful build output and `BUILD_ID` evidence.
4. Re-run the complete gate after those blockers are resolved. Do not enable remote LangSmith tracing from this evidence alone.
