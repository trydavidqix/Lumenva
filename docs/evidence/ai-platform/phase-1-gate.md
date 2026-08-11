# Phase 1 — observability gate

Date: 2026-08-11
Scope: optional LangSmith observability only; no external account, API key, provider activation, network experiment, or production request was used.

## Decision

**GO.** The complete local gate passed on Windows at commit `feee3977`. Database verification used only the disposable local Postgres container created by `pnpm test:db`; the script removed that container after the run.

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
| `pnpm install --frozen-lockfile` | PASS | Exit code 0; the lockfile was not changed. |
| `pnpm typecheck` | PASS | Exit code 0 from `tsc --noEmit` on the final tree. |
| `pnpm lint` | PASS | Exit code 0; 0 errors and 187 existing warnings. |
| `pnpm test:unit` | PASS | Exit code 0 from the Windows-safe log/exit-code collector: 298 files and 2,994 tests passed. Vitest runs one worker on this 8 GB host; the full final run took 1,615.07 s. |
| `pnpm test:db` | PASS | Exit code 0: 72 files passed; 480 tests passed and 1 was skipped. Docker daemon 29.6.2 hosted only the disposable local Postgres container, which the script removed on teardown. |
| `pnpm ai:eval:local` | PASS | Exit code 0: 25 synthetic cases, 0 duplicate IDs, 0 P0 failures. |
| `pnpm build` | PASS | Exit code 0 from the complete Next.js 16.3.0 production build. |
| `git diff --check` | PASS | Exit code 0; no whitespace errors reported before the evidence commit. |

## Gate closure

The earlier Mac-only blockers are closed by the Windows results above. No external account, API key, provider, production environment, Vercel project, Supabase project, WAHA instance, or Redis instance was configured or changed. LangSmith remains OFF by default; this GO decision authorizes only the local Phase 1 code and safety evidence, not remote tracing activation.
