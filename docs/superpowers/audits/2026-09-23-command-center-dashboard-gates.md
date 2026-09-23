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

Live dashboard check against the user's current MCG runtime (PowerShell HTTP GET; browser not used): loopback dashboard started on a temporary port and was stopped after inspection. `/api/health` reported wire `ONLINE` and workspace online. `/api/tasks` returned 15 stored tasks; stats summarized 7 completed and 6 active. Token metrics were `unavailable`, Trust was `UNVALIDATED`, and there were 0 eligible paired evaluations among 16 stored A/B records. Observed resources: 3 agents, 3 runtimes, 1 tool; plugins and MCPs had no observed records and remained unavailable. The server periodically refreshes `state/dashboard/snapshot.json` while running; this generated local snapshot was updated during inspection. No task, telemetry, history, or evaluation records were intentionally written.

The 13 dashboard views were queried read-only: Overview, Traces, Tasks, Agents, Tools, and Alerts had observations; Plugins, MCPs, Graph, Cache, and Memory were unavailable/unconfigured; Validation was unvalidated with no eligible pairs. History had observed and unavailable subtypes. This exposed an aggregate label bug: History reported `exact` whenever any subtype existed. A regression now requires `unavailable` if any subtype is unavailable, `estimated` if all are available but at least one is estimated, and `exact` only when every subtype is exact.

## Pending evidence

## Remote GitHub evidence

- Draft PR: https://github.com/trydavidqix/Lumenva/pull/26, targeting `lumenva-command-center`; no merge performed.
- Initial integration: MCG `35802405655` PASS; vertical `35802405657` PASS; invariants `35802405587` PASS; core `35802405583` FAIL; verify `35802405587` FAIL.
- Latest completed remote code commit `7f2d23c9`: MCG `35805179393` PASS; vertical `35805179433` PASS; core `35805179418` FAIL; general CI `35805179410` FAIL in verify typecheck (invariants job passed).

The MCG-specific remote gate is green. The PR remains draft/open because the mandatory core and general verify checks are red due to errors outside the MCG allowlist. No merge or main-branch change was made. The separate M0.13 completion gate remains open.

## Follow-up verification

- Authorized Core repair, limited to `packages/lumenva-core/**`: source imports now use `.ts` consistently with the package's direct-TypeScript entry point; typecheck permits those extensions; Node tests use `--experimental-transform-types` for existing parameter properties; tests subscribe through the implemented `EventBus.on` API and use void-returning callbacks. Typecheck PASS and 9/9 unit tests PASS locally. No `apps/crm/**`, workflow, or lockfile change.
- Authorized Validation Lab execution: 30 real Codex CLI paired runs using `gpt-6-luna` / `medium`, with one pilot counted as case 1 and the remaining 29 resumed at offset 1. Exact usage was captured. All 30 pairs are eligible, 5 per category; baseline and MCG task success 100%, context recall 100%, evidence grounding 100%, hallucination rate 0%; quality-preserving token saving 10.2%; Trust `VALIDATED` (77.55). Final suite (30 total pairs, 0 new runs during summary consolidation): `C:\Users\David\.lumenva\maestri-context-gateway\state\evals\suites\suite-1790128750253-0aaeed89.json`.
- Runner regression: evaluation aggregates are filtered by dataset/model/effort, resumed runs have an explicit offset/progress, and the final suite distinguishes total eligible pairs from newly executed pairs. This prevents mixing unrelated historical evaluations or repeating the pilot case.
- Dashboard `/api/views` GET after the suite returned HTTP 200 with all 13 views; Validation reports `VALIDATED`, 30/30 paired runs, exact measurement and 10.2% quality-preserving savings; Overview measurement is exact. No browser used.

- Latest PR #26 checks for `ff2454f7`: MCG PASS (`35808642712`), Core PASS (`35808642638`), Vertical PASS (`35808642639`), Invariants PASS (`35808642650`); general `verify` FAIL (`35808642650`, job `107014957792`). Failure is `TS2307` for `@lumenva/integration-meta` at `apps/social-brain-web/app/api/webhooks/meta/route.ts:2-3`. The workspace package exists, but `apps/social-brain-web/package.json` does not declare it. Git history contains the prior one-line dependency fix `9879271c`, not in this branch's ancestry. This is outside the authorized Core/MCG code scope; no Social Brain or CRM file was changed. PR remains OPEN/DRAFT, merge state UNSTABLE; no merge/main/production action occurred.

- Follow-up fix in `1e37f1b3`: declared `@lumenva/integration-meta` as a workspace dependency and added a narrow public `./webhook` entrypoint; the Social Brain Web route and webhook tests import that stable API instead of the package root, whose legacy `MetaClient` graph contains app-coupled imports. Local validation: frozen install PASS, workspace typecheck 19 projects PASS, Social Brain Web tests 49/49 PASS, webhook tests 13/13 PASS, MCG unit 35/35 PASS, dashboard smoke 13/13 PASS, contracts 1/1 PASS, syntax 30 modules PASS, sensitive scan 80 files PASS. Root `pnpm lint` completed with 0 errors (existing warnings); `lint:channels` and `test:harness` PASS. Remote checks: Core/MCG/Vertical/Invariant PASS; `verify` FAILS at harness consistency with 14 CRM doctrine-link findings. No CRM paths were edited. Root `harness:check` reproduces the same 14 findings locally; root unit was stopped after multiple CRM test failures surfaced, and shell test on Windows/Git Bash reports 18 failures due to path/fixture behavior. Dashboard-specific gates remain green; PR #26 stays open/unmerged.

- Scheduler concurrency regression: RED before implementation (`maxActive` was 1 with a limit of 2); GREEN after the fix (`maxActive` reached 2 for independent ready nodes). The scheduler change is included in the latest remote MCG PASS above.
- Full MCG unit suite after scheduler change: 34/34 PASS; syntax/import smoke: 30 modules PASS; sensitive scan: 80 files PASS; `git diff --check` PASS.
- Runtime audit: 16 A/B records; 14 non-real executor pairs, 13 with unavailable measurement, 4 without canonical category; 0 pass the current eligibility filter. The two `real_executor=true` pairs lack model/snapshot/tools/policy comparability fields. The checked-in validation dataset contains 30 cases balanced at 5 per category, but no provider evaluations were launched. Dashboard inspection refreshed only the generated `state/dashboard/snapshot.json`; no task/evaluation/telemetry records were written.
- Evaluator regression: an uncategorized A/B record previously inflated paired counts; test failed at 3 instead of 2, then passed after the aggregator began rejecting missing/noncanonical categories.
- Latest completed Actions before persistent-circuit integration, commit `3c71f29e`: MCG run `35803769908` PASS; vertical `35803770109` PASS; invariants `35803769795` PASS; core `35803769679` FAIL; general verify `35803769795` FAIL at `lumenva-core` typecheck.
- Persistent circuit integration test: three executor failures persist `CIRCUIT_OPEN`; a new scheduler instance does not dispatch to that provider. Full local suite after integration: 34/34 PASS, syntax/import 30 modules PASS, sensitive scan 80 files PASS.
- Evaluation persistence regression: fabricated `measurement_type` is rejected by the eval contract; partial exact/unavailable paired usage stays `unavailable` instead of being mislabeled `exact`. Targeted eval tests and full suite pass locally; remote CI for this additional change is pending.
- Remote validation for evaluation and contract enforcement code in `7f2d23c9`: MCG gates PASS, including unit, syntax, sensitive scan, dashboard and contract smoke. Vertical gates and invariants also pass; pre-existing core/verify typecheck failures remain unchanged.
- Latest correction `dbb102c6`: remote MCG run `35806666214` PASS; vertical run `35806666216` PASS; invariants in CI run `35806666208` PASS. Core run `35806666207` and verify in `35806666208` FAIL on the same existing `packages/lumenva-core` typecheck issues, outside this MCG scope. PR #26 remains draft/open; no merge or main change.
- Contract wiring regressions: task state, inbound/published event, trace/span, telemetry, registry, alert, evaluation and artifact/evidence paths are now checked against their corresponding runtime schemas. RED→GREEN tests cover malformed task events, traces and alerts. Full MCG suite 34/34, syntax 30 modules, sensitive scan 80 files, dashboard 12/12, contracts 1/1, and `git diff --check` all PASS locally; MCG-specific and vertical remote gates PASS on `7f2d23c9`.
- Root harness repair, commit `52f8cdde`: root `CLAUDE.md` now links all 13 existing shared rules; root `AGENTS.md` points agents to that doctrine and `.claude/rules/`. Local `pnpm --dir apps/crm harness:check` PASS; remote harness step PASS. No `apps/crm/**` files were changed. The same remote `verify` run (`35811934714`) then failed in general CRM unit tests: 659 files and 4,942 tests passed, 4 files/2 tests failed (`e2e-workflow-honra-o-env.test.ts`, `evidencia-citada.test.ts`, `manifest-x-migrations.test.ts`, `next-config-output.test.ts`). Failures: absent `.github/workflows/e2e.yml`, quoted/missing Knowledge path, two migration manifest entries missing, and Vercel standalone output expectation. The shell step did not run because unit tests failed first. `core`, `mcg`, `vertical` and `invariants` PASS on `52f8cdde`.
- M0.8 follow-up, commit `6ca61708`: MCG dashboard registry APIs refresh and serve six canonical registries (`agents`, `tools`, `plugins`, `mcps`, `runtimes`, `models`); `/api/views` exposes registry-backed Agents/Tools/Plugins/MCPs. Entries without evidence remain `UNAVAILABLE`, with null `last_seen` and unavailable measurement. RED→GREEN integration test checks all six endpoints/files and the user-facing Agents view; the existing telemetry test covers discovered rows. Local checks: MCG 36/36, dashboard 14/14, contracts 1/1, syntax 30 modules, sensitive scan 80 files, `git diff --check` PASS. Actual provider config discovery, MCP/tool capability probes and measured success/failure/latency remain open; M0.8 and M0.13 are not closed.
