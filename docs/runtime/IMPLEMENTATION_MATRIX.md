# Local Runtime Implementation Matrix

Branch: `lumenva-local-runtime`

## Baseline

The runtime extends the current Operating Core instead of creating a competing orchestration stack.

| Capability | Canonical existing owner | Local Runtime action |
|---|---|---|
| Job lifecycle | `packages/operating-core/src/job-engine.ts` | integrate; do not duplicate |
| Event persistence | `packages/operating-core/src/event-log-adapter.ts` | extend with runtime events through adapter boundary |
| Persistent claims | `packages/operating-core/src/job-claim-store.ts` | reuse for job ownership |
| Session/tool loop | existing Session Runtime / ToolLoopLock | bridge in agentic-loop phase |
| Resource/model routing | Operating Core router + CRM resource router | adapt, do not fork |
| Context | `packages/operating-core/src/context` + MCG package | bridge context packs |
| Evidence | Operating Core event/receipt abstractions | emit typed runtime evidence |
| Core service | `packages/lumenva-core` | expose runtime API later |
| Local execution | none canonical found | NEW: `packages/local-runtime` |
| Worktree execution | Command Center architecture requirement | implement behind local-runtime boundary |
| UI | Command Center/CRM surfaces | projection only, later phase |
| MCP/CLI | existing Operating Core surfaces | expose runtime through same policy boundary later |

## Package decision

`packages/local-runtime` is the only new execution package. It owns OS-facing local execution and daemon lifecycle. It does not own jobs, model policy, memory, context storage, or business orchestration.

## Repository gates discovered

Root:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:harness`
- `pnpm harness:check`
- `pnpm test:unit`
- `pnpm test:shell`
- `pnpm test:db`

The local-runtime package adds its own `typecheck` and `test:unit` scripts so root recursive gates include it.

## Baseline caveats

- Historical Session Runtime documentation includes skeleton/single-process warnings; it is not treated as durable persistence proof.
- GitHub connector writes source but cannot execute the repository locally. Runtime gates must therefore be proven by CI/workflow execution or a connected local executor; source creation alone is not a PASS.
- No merge path to `main` is part of this implementation.
