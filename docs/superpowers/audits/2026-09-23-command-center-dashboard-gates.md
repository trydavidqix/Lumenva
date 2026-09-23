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

## Remote GitHub evidence

- Draft PR: https://github.com/trydavidqix/Lumenva/pull/26, targeting `lumenva-command-center`; no merge performed.
- Initial integration: MCG `35802405655` PASS; vertical `35802405657` PASS; invariants `35802405587` PASS; core `35802405583` FAIL; verify `35802405587` FAIL.
- Latest scheduler-code commit `fdd2dafe`: MCG `35803286772` PASS; vertical `35803286785` PASS; invariants `35803286827` PASS; core `35803286768` FAIL; verify `35803286827` FAIL.

The MCG-specific remote gate is green. The PR remains draft/open because the mandatory core and general verify checks are red due to errors outside the MCG allowlist. No merge or main-branch change was made. The separate M0.13 completion gate remains open.

## Follow-up verification

- Scheduler concurrency regression: RED before implementation (`maxActive` was 1 with a limit of 2); GREEN after the fix (`maxActive` reached 2 for independent ready nodes). The scheduler change is included in the latest remote MCG PASS above.
- Full MCG unit suite after scheduler change: 34/34 PASS; syntax/import smoke: 30 modules PASS; sensitive scan: 80 files PASS; `git diff --check` PASS.
- Read-only runtime aggregate: 2 valid paired evaluations; both lack a category. M0.11 still requires 30 real, categorized pairs. No runtime records were changed and no provider evaluations were launched.
