# Execution

## Purpose

Execution is responsible for making agent/workflow work bounded, resumable and safe under retries. It does not decide business strategy; the Agent Kernel and deterministic policies do that.

## Canonical orchestration owner

`AgentKernel.run()` in `lib/agent-engine/kernel/agent-kernel.ts` is the canonical Phase 2 orchestration entrypoint. `createAgentKernelComposition()` wires the kernel to internal ports without exposing provider-specific SDK types at the public boundary.

The kernel owns orchestration order only. Existing Phase 1 modules retain semantic ownership of execution state, policy, tool authorization, skills, model certification, observability and memory. The kernel must call those owners rather than duplicate their rules.

The required order is fail-closed: resolve tenant/agent/version and execution identity; load authoritative context and governed skills; resolve allowed tools and a certified compatible model; execute the bounded loop; apply deterministic tool policy; checkpoint/pause/resume as required; verify the outcome; record evidence; write permitted derived memory; emit events; and terminate with an explicit status and stop reason.

## Separation of concerns

- `event_log` = immutable business facts.
- queue/job infrastructure = work to execute.
- execution adapter = start/checkpoint/pause/resume/complete/fail semantics.
- `AgentKernel.run()` = canonical orchestration of one governed run.
- agent loop = bounded model/tool iteration inside an execution.

Business events and queued work remain distinct concepts even when one causes the other.

## Canonical run states

```text
running
waiting_approval
completed
blocked
retryable_failure
permanent_failure
budget_exhausted
policy_denied
cancelled
```

Illegal transitions must be rejected deterministically.

## Required loop limits

Every agent loop must have explicit limits for:

- max steps;
- max tool calls;
- max tokens;
- max cost;
- max runtime;
- repeated same-tool/same-args threshold;
- no-progress threshold;
- bounded tool/provider retries.

A model cannot raise these limits during a run.

## Progress and repetition

Repetition detection is deterministic. Normalized tool name + normalized arguments + stable state fingerprint are used to detect repeated work. No-progress detection must rely on execution/business-state fingerprints, not an LLM judging itself.

## Idempotency

Any side effect that can be retried must have a stable idempotency key. Preferred derivation:

```text
run_id + step_id + tool_id + business_target
```

The exact storage/lookup mechanism may differ by capability, but duplicate delivery must not create duplicate business side effects. The Agent Kernel carries the same derived key through bounded tool retries and rehydrates completed side-effect keys on resume so an already committed effect is not replayed.

## Checkpoints and waits

Long waits (for example human approval) are persisted as state. No HTTP request or model call remains open waiting for a human. Resume continues from the last verified checkpoint with the same run, trace and correlation identity.

## Runtime and provider boundary

`KernelRuntimePort` is provider-agnostic. Vercel AI SDK 7 remains behind the existing LLM seam/adapter and is translated into internal kernel step results before control returns to `AgentKernel.run()`. Certified capability filtering happens before runtime invocation; provider fallback preserves the same run/trace/correlation identity and emits explicit fallback events.

## Initial adapter

The first `ExecutionPort` implementation uses the existing Deskcomm `event_log`, `job_queue` and worker infrastructure. Inngest/Vercel Workflow remain benchmark candidates after real workloads exist.
