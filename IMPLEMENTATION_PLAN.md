# Consolidation Closeout Plan — PR #75

Status: IN PROGRESS. Direct parity is complete with zero new candidate-only regressions. User approved a narrow remediation of baseline unit failures so required PR checks can pass; the changes are awaiting GitHub Actions validation. Branch classification and a 95-ref archive checkpoint are complete. PR #75 remains open and unmerged; no branch cleanup occurred.

## Scope and evidence

- Candidate branch: `consolidation/lumenva-main-2026-09-27`, tested code HEAD `d02d002abdfe5c64282bf27c61c40aec3deff089`.
- Base: `main` at `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`.
- Canonical tests run only in GitHub Actions. Do not run heavy tests locally.
- Full detailed history and branch-by-branch dispositions are in [BRANCH_CONSOLIDATION_REPORT.md](BRANCH_CONSOLIDATION_REPORT.md).

## Completed

1. **Direct Actions parity:** [run 36405174959](https://github.com/trydavidqix/Lumenva/actions/runs/36405174959), same runner, frozen install, Node `22.23.3`, pnpm `9.15.9`. Build: main had 17 failures, candidate passed. Lint, toolchain and typecheck passed both. Unit totals (pass/fail/skip): main `5,486/90/10`, candidate `5,566/17/11`; 15 shared failure IDs, 0 candidate-only regressions, 38 baseline IDs resolved, timeouts `2/0`, worker errors `0/0`. Comparator workflow succeeded.
2. **E2E setup repair and parity diagnosis:** seed, build and browser installation pass. Runs [main 36405099925](https://github.com/trydavidqix/Lumenva/actions/runs/36405099925) and [candidate 36405103746](https://github.com/trydavidqix/Lumenva/actions/runs/36405103746) both time out waiting for Playwright's web server because Firebase reports `auth/invalid-api-key`; no test specs execute. No Firebase app configuration is available in repository Actions variables/secrets/environments. No real credential was invented or reused.
3. **Candidate CI/security:** invariants, typecheck, lint, harness, CodeQL, Semgrep, Gitleaks, OSV and vertical checks passed at tested HEAD. Standard unit jobs remain red on baseline-shared failures; do not weaken tests or fix unrelated CRM failures.
4. **Tool audit:** Git, `gh`, `rg`, ast-grep, dependency-cruiser and pnpm are installed. Knip/GitButler are absent and not required for the current Git/Actions validation; do not install GitButler.

## Completed closeout work

1. Refreshed inventory: 61 `origin` branches, 25 `source-local` branches, 4 archived PR refs, and 3 local branches (95 refs total, including two symbolic remote `HEAD` refs).
2. Classified all 15 no-PR origin branches. Added evidence-based dispositions for `mover-pro-nexus`, `v2.1`, and `v2.2`; their plan commits are present in candidate history, without claiming the planned product work is implemented.
3. Reconciled the report and this tracker with the latest direct GitHub Actions parity, current E2E setup failure, and exact PR #75 head/base.
4. Pushed the inventory/report refresh as `81fc25e56ef68940ef41ee302a14114187b37e69`. All 61 origin branch names are represented in the report; all 15 no-PR branches have dispositions.
5. Created checkpoint bundle `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-2026-09-28-81fc25e5.bundle`; `git bundle verify` passed and all 95 live ref names+SHAs match, with 3 extra advertised validation HEADs. Size 81,425,379 bytes; SHA-256 `84EAAAD820DC012C084BDD948C6ED84CEE5A92BA5E558572E2FDF6AAFADD170C`.
6. Actions for `81fc25e5`: lint, typecheck, invariants, vertical, CodeQL, Gitleaks, OSV and Semgrep passed. `verify` and `verify-and-build` failed only in unit tests (CRM: 5 failed, 5,128 passed, 1 skipped, across 9 files); the `verify-and-build` job stopped before its build step. The pinned same-runner parity [36405174959](https://github.com/trydavidqix/Lumenva/actions/runs/36405174959) remains canonical for regression classification: 0 candidate-only failures, 15 shared IDs. Do not fix baseline failures here.

## Remaining work

1. Commit and push the approved baseline-failure repairs plus refreshed report/plan to PR #75. Keep the PR open and do not merge or delete refs.
2. Wait for GitHub Actions to validate the new HEAD (tests only in Actions); classify any remaining failures against the pinned main baseline. Do not invent Firebase credentials for E2E.
3. Refresh remote refs without pruning; create a uniquely named final bundle under `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\`. Preserve all earlier bundles. Run `git bundle verify`; compare all live ref names and SHAs; record bundle size and SHA-256.
4. Recheck Actions and synchronize final evidence in both reports. Keep any genuine Firebase configuration need as the final human-dependent E2E blocker.

## Stop conditions

- Keep `main`, the source Lumenva checkout, recovery branches/worktrees, and all existing bundles unchanged.
- Do not fix the 15 baseline-shared test failures or alter product auth to mask the E2E configuration issue.
- Conclude only after the final branch/archive proof and reports are synchronized. If Firebase configuration is still absent, report it as a shared baseline blocker, not a candidate regression.
