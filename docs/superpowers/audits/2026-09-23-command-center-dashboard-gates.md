# Command Center dashboard — local gate evidence

Date: 2026-09-23
Branch: `codex/mcg-ci-integration` (based on current `origin/lumenva-command-center`)
Scope: MCG dashboard and its M0.3 CI gates. No production deployment or main-branch change.

## Environment and setup

- Node `v24.19.0`; pnpm `9.15.9`.
- `pnpm install --lockfile-only`: PASS; repaired the missing `packages/lumenva-core` importer and added the MCG workspace importer to `pnpm-lock.yaml`.
- `pnpm install --frozen-lockfile`: PASS; 1,596 packages resolved, no downloads.
- The workflows use Node 22. Local Node version therefore differs from CI.

## Exact M0.3 commands and results

| Command | Result |
|---|---|
| `pnpm --filter @lumenva/maestri-context-gateway test:unit` | PASS — 34/34 tests |
| `pnpm --filter @lumenva/maestri-context-gateway check:syntax` | PASS — 30 modules parsed |
| `pnpm --filter @lumenva/maestri-context-gateway scan:sensitive` | PASS — 80 files |
| `pnpm --filter @lumenva/maestri-context-gateway smoke:dashboard` | PASS — 12/12 tests |
| `pnpm --filter @lumenva/maestri-context-gateway smoke:contracts` | PASS — 1/1 test |

The lockfile change also triggers the existing Lumenva Core workflow. Both downstream checks were run locally and fail on pre-existing issues outside the MCG allowlist:

| Command | Result |
|---|---|
| `pnpm --filter @lumenva/lumenva-core typecheck` | FAIL — test TypeScript config rejects `.ts` import suffixes; test callback types mismatch; `EventBus.subscribe` is missing |
| `pnpm --filter @lumenva/lumenva-core test:unit` | FAIL — all 5 test files stop at module resolution (`src/contracts.js` is missing; source is TypeScript) |

These failures are recorded as a downstream CI blocker. Core source, tests, package manifest and workflow were not changed because they are outside this task's allowlist.

Dashboard tests cover the read-only local endpoints, keyboard-accessible navigation, the M0.12 views, honest unavailable states, graph source drill-down and loopback binding. These are automated tests, not a claim of a production deployment or remote workspace connectivity.

## Pending evidence

GitHub Actions has not run for this integration branch because no branch push or PR was created. Remote CI remains required before M0.3 can be marked complete. The existing core workflow is expected to fail until its independent test/runtime issues are addressed. The separate M0.13 completion gate remains open.
