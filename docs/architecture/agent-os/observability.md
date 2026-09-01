# Observability

## Goal

Every agent run must be explainable from trigger to terminal outcome without relying on model narration.

## Correlation identity

Where applicable, preserve:

```text
organization_id
event_id
job_id
run_id
trace_id
correlation_id
```

## Minimum run evidence

A run record should make it possible to determine:

- agent ID/version;
- trigger and authoritative context source identifiers;
- activated skill versions;
- selected model/provider and fallback history;
- step count and stop reason;
- tool calls/results/error classes;
- policy decisions and approvals;
- retries/checkpoints/resumes;
- token usage, cost and latency;
- verification evidence;
- terminal state.

## Trace boundaries

Model calls, tool calls, policy decisions, execution transitions and external side effects are separate trace spans/events. Sensitive payloads must be redacted/minimized according to existing security/LGPD doctrine.

## Source of truth

Deskcomm internal run/event storage remains canonical. Vercel telemetry, Sentry, LangSmith or other observability systems are secondary views/adapters and must share internal trace/correlation IDs where possible.

## Failure visibility

Provider failures and fallback transitions are first-class events. A run must never disappear because a provider fallback failed silently.

## Evidence before completion

`completed` requires verifiable output/business-state evidence appropriate to the action. A textual “done” emitted by the model is not completion evidence.
