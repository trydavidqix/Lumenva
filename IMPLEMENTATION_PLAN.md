# Lumenva Total Consolidation — Active Implementation Plan

**Status:** IN_PROGRESS — this plan supersedes the historical PR #75 closeout below.
**Canonical candidate:** `integration/lumenva-complete`
**Current HEAD:** `506e290af22f358c1d1a6fb7611a506598baf5b4` (documentation-only commits after tested code SHA `db52970416dbc0118c51d8964e6c0ca9a93d8b43`)
**Base:** `origin/main` `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`
**Source baseline:** the 63 frozen remote refs in `BRANCH_RECONCILIATION_MANIFEST.md` and the verified pre-unification bundle.

## Goal and safety boundary

Reconcile every useful implementation, partial/experimental feature, and useful documentation item from the frozen 63 refs into this candidate or explicitly record why it is preserved elsewhere. Retain the distinctions `PRODUCTION_READY`, `EXPERIMENTAL`, `PARTIAL`, `DUPLICATE`, `OBSOLETE`, and `NEXUS_OUT_OF_SCOPE`, each supported by source commit/path/diff evidence. Keep `main` unchanged. Do not delete source branches, worktrees, or recovery snapshots in this task. Stop after final preservation proof and request Owner authorization before cleanup.

The independent CRM checkout at `C:\Users\David\Desktop\Projetos\Lumenva` is not being edited; work is confined to this isolated unification checkout. Nexus-owned Maestri/MCG/Command Center runtime work is out of scope for Lumenva and remains preserved by frozen refs/archive.

## Live pipeline (8 gates)

1. **Freeze source refs and baseline archive — DONE.** 63 names/SHAs frozen; original bundle verified.
2. **Classify all 63 refs with evidence — DONE.** Every frozen row has a disposition with source SHA/path/blob evidence. Independent final audit confirmed 63/63 rows and no useful work missing at `db529704`.
3. **Integrate useful partial/experimental content — DONE.** WAHA is isolated and `EXPERIMENTAL/PARTIAL`, not default-enabled. Unique disabled Twilio outbound templates and the useful `voz` plan/runbook are preserved in explicit experimental/archive paths. Meta OAuth/account-sync remains preserved as `PARTIAL` in the frozen source/archive, not activated because of tenant-RLS and token-storage defects. Independent audit found no additional useful content to port.
4. **Run current-head remote validation — IN PROGRESS.** GitHub Actions only; standard CI `36541103963` passed on code SHA `db529704`. Branch parity `36541107625` passed lint/typecheck/build/toolchain and compared unit tests: 5 shared failed IDs, 0 candidate-only, 47 resolved, 0 timeouts/worker errors, with one extra candidate skip. Candidate E2E `36541115754` completed with 42 failures/8 passes in part 2; main E2E `36541111186` is still running part 2. Both have the same two failed initial stages; compare artifacts after main completes before classification. Report-only security `36541133755` completed with Semgrep/OSV passed and historical Gitleaks detections. Results from older SHAs are not current evidence.
5. **Independent zero-missing-work audit — DONE.** Auditor confirmed all 63 frozen SHAs exist, all 63 rows have dispositions, and no unique useful content is missing from the candidate/archive; it verified the voice and `implementation/unified` reconciliations.
6. **Create final archive — IN PROGRESS.** A checkpoint bundle for candidate `6633bb47` verifies with 105 refs, all 63 frozen refs at exact SHAs, and the candidate ref present; SHA-256 and size are recorded in the manifest. After final Actions evidence/docs are committed, create a distinct final bundle for that resulting HEAD. Keep all prior bundles untouched.
7. **Prove preservation and synchronization — TODO.** Confirm all 63 frozen refs still resolve to their exact SHAs, no ref was deleted or moved, integration local equals remote, `main` is unchanged, and the working tree is clean.
8. **Owner handoff — TODO.** Deliver 63/63 matrix, 0 useful work missing, archive proof, and Actions outcomes; stop and ask David before any branch cleanup. No branch deletion is authorized before that separate approval.

## Current evidence and known limits

- Current remote candidate equals local HEAD `db52970416dbc0118c51d8964e6c0ca9a93d8b43`; `origin/main` remains `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`.
- Frozen source refs were unchanged at the last audit; no source branch has been deleted. Latest local documentation delta is the F7 classification update, not yet committed.
- Independent F7 audit: Resend is represented; old Nuvemshop adapter is superseded by stricter URL/redirect checks; Meta adapter source weakens fail-closed token handling and is obsolete; webhook missing-secret fail-closed behavior is represented in current handlers and test. Commit/path/blob evidence is in the manifest.
- Previous current-head CI `36538511186` at `c1f9c2d` failed six WAHA adapter unit cases because the test used `Object.assign` on read-only getters `baseUrl`/`apiKey`; the adapter behavior was not exercised. Test-only env mock fix is pushed at `db529704`.
- Corrected-head standard CI `36541103963` passed. Parity `36541107625` has lint/typecheck/build/toolchain passed and unit comparison still running. Main E2E `36541111186` and candidate E2E `36541115754` show the same two initial-stage failures on both sides; their second halves and logs are not complete, so no final baseline/regression classification is made yet. Report-only security run `36541133755` completed: Semgrep and OSV passed; Gitleaks reported 12 detections in older commits across test fixtures/token alphabet, none introduced by `db529704`. Workflow conclusion is success because this scan is report-only; finding locations are recorded without exposing values. Older `c1f9c2d` parity/E2E runs are obsolete and were asked to cancel.
- Independent `implementation/unified` audit: `withTempDir` and cleanup tests have matching blobs in the candidate; the candidate harness guard is broader; source commit `082baf95` is a 99-path reversal and must not be replayed. Evidence is in the manifest.
- Previous parity/E2E evidence applies to earlier candidates only. E2E previously failed on both sides with shared failures and zero candidate-only failures; do not label E2E green based on that.
- No local heavy tests are permitted. Use `git diff --check` and static Git/reference inspection locally; all test, build, lint, typecheck, security, and E2E gates run through GitHub Actions.

## Scope exclusions

- Do not merge to `main`, merge source branches blindly, force-push, delete/prune source refs, remove recovery work, modify the original CRM checkout, or touch Nexus.
- Do not fix pre-existing CRM failures merely to make the candidate green. Correct only regressions introduced by this consolidation and supported by same-environment GitHub Actions evidence.
- Do not activate partial/experimental integrations just to claim completeness. Keep useful unfinished work explicitly represented and preserved.

---

# Historical PR #75 Closeout — Superseded

## Current implementation plan — 2026-09-29 05:52 Europe/Lisbon

The branch-content review and closeout are complete. No useful voice integration remains missing. Required code checks passed on `5d013d57a8bc430f8a8a946e5c654fe25c02a8a2`; current documentation-only tip is `127aecccb476c4c1d8bde64835a6eeb23e3f4ef5` and its Actions checks were running at this update. PR #75 stays open and unmerged. No implementation work remains in this consolidation plan:

1. **Current-head parity — complete:** run `36514960201` pinned main/candidate on `windows-2025`, Node `22.23.3`, pnpm `9.15.9`, frozen installs. Lint/toolchain/typecheck passed both; main build had 17 failure signatures, candidate 0; unit main `5,487/88/10`, candidate `5,623/7/11` (pass/fail/skip), 5 shared failures, 0 candidate-only, 47 resolved, zero timeouts/worker errors. Comparator unit row labels `REGRESSION` only for one extra skipped test on candidate.
2. **Comparable E2E — complete, suite red on both:** paired runs `36513998219` (main) and `36513998388` (candidate) used the same workflow revision `878e3019`. Both E2E jobs failed. Artifact comparison found 42 shared failing contexts, 8 main-only, and 0 candidate-only. This rules out a candidate-only E2E regression in the pair but does not make E2E green. Do not change product authorization, test assertions, or seeds to force green.
3. **Archive — verified:** bundle `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-final-2026-09-29-5d013d57.bundle` contains all 97 live refs at candidate `5d013d57a8bc430f8a8a946e5c654fe25c02a8a2`; `git bundle verify` passed. It advertises only the expected `HEAD` and two preserved stale worktree HEADs as additional entries. Size `81,260,269` bytes; SHA-256 `1641CF4A1724FF0023AAA6E2D7DF285341EB4867BD54E27344245F3A616DAF56`. The bundle remains in the external recovery directory; its binary is intentionally not uploaded to GitHub.
4. **Publication — complete:** the three tracked closeout documents are pushed and referenced by the PR; local and origin branch SHAs match; working tree is clean; PR remains open/unmerged; `main` is unchanged. Actions for the latest documentation-only tip were still pending at this update. No further implementation is planned by this tracker.

Completed: 92-path content audit, voice integration audit, required PR checks on `5d013d57`, current-head parity, comparable E2E failure classification, archive verification, and publication. The current unit comparison has 0 candidate-only failed IDs; one additional skip causes its row label to read `REGRESSION`. The Windows runner cannot provide PostgreSQL Docker image coverage for the shared receipt-store integration test. E2E has shared baseline failures in both runs and zero candidate-only failing contexts; it is not green.

## Current checkpoint — 2026-09-28 19:46 Europe/Lisbon

- Candidate `5b5e062d85f7b9ef833ee1a36b1d0041a5cb35fd`, branch `consolidation/lumenva-main-2026-09-27`; PR #75 OPEN/unmerged; base `main` `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`.
- Decision on commit `082baf95`: its 92-path removal was not requested. Keep the changes unless proven duplicate. All 92 paths are present in the candidate; the targeted audit found no duplicate implementation in the reviewed areas. Keep the baseline/migration schema mirror because both installation paths are deliberately maintained.
- This decision is resolved. No more owner choice is needed for the 92 paths. The prior paired E2E runs were cancelled before completion, so final main-vs-candidate E2E parity is still outstanding.
- Checks on `5b5e062d` at 19:43: `verify`, `verify-and-build`, invariants, vertical, and Semgrep pending; Gitleaks and OSV passed; CodeQL skipped. Rerun on the next PR head before treating them as current evidence.

## Historical checkpoint — 2026-09-28 18:28 Europe/Lisbon (superseded)

- Candidate: `f1acf2a41b2475e024504a03ac0fa7242f7c19e7`; branch `consolidation/lumenva-main-2026-09-27`; PR [#75](https://github.com/trydavidqix/Lumenva/pull/75) OPEN/unmerged; base `main` `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`.
- The latest workflow change makes the remaining Playwright parts run after the visual E2E step fails; it keeps the job failed. Paired main/candidate runs [36456011711](https://github.com/trydavidqix/Lumenva/actions/runs/36456011711) and [36456014775](https://github.com/trydavidqix/Lumenva/actions/runs/36456014775) are still executing part 2. Both previously failed the same visual gate and part 1. Final E2E comparison is not available yet.
- PR checks observed at 18:28 passed for `verify`, `verify-and-build`, invariants, vertical, CodeQL, Semgrep, Gitleaks, and OSV.
- Historical note (superseded): the 18:28 checkpoint incorrectly treated the 92-path removal as a pending owner decision. David clarified that it was not intended; retain the non-duplicated work as recorded in the current checkpoint.
- Archive proof is stale after `f1acf2a4`; preserve old bundles and regenerate a uniquely named final bundle after final docs, then verify all live refs by exact name/SHA.

## Current state — superseded by the checkpoint above

- This older snapshot is retained as historical context; use the current checkpoint above and `ACTIVE_PIPELINE.md` for live status.

## Previously completed evidence (older candidate checkpoint)

1. Test-only E2E identity fixtures now seed the expected Firebase UID-to-user mappings; no genuine or production credential was created.
2. Test-only E2E environment disables external Sentry telemetry with `SENTRY_DSN=off`.
3. Invariants, F2/F3 vertical, security scans, direct-parity toolchain, and direct-parity lint have passed.
4. The report now records the current E2E failure and active Actions run IDs.

## Historical verification (older candidate checkpoint)

1. Direct parity run `36445124677` completed on the same runner with Node `22.23.3` and pnpm `9.15.9`: candidate build/lint/toolchain/typecheck passed; unit failures were main `88` vs candidate `7`, with `0` regressions, `5` shared failures, and `47` resolved. No timeouts or worker errors.
2. Candidate CI `36444929702` and GCP CI `36444929947` passed at that older candidate checkpoint, including their unit/build verification jobs.
3. E2E candidate run `36444930221` reached seven pages, then failed with HTTP 500 from `fn_user_org_ids` permission denial. Same-fixture `main` run `36450538203` failed earlier during test login and did not reach those pages; the exact runtime E2E failure is therefore not parity-proven. Relevant query callers and SQL grant match `origin/main`.
4. E2E workflow now overlays only non-secret emulator config, identity fixture, environment generator, and the exact visual spec into the disposable baseline worktree. No CRM source checkout or `main` file was changed.

## Remaining closeout

1. Complete paired main/candidate E2E on comparable inputs, then record exact outcomes and artifacts. Previous paired runs were cancelled before completion.
2. (Completed) Keep the 92 paths removed by `082baf95` when not duplicated; targeted audit found no duplicate implementation in the reviewed areas.
3. Finish content review of the useful voice integration gaps without importing the legacy branch wholesale; retain production security guards and test only any scoped port.
4. After all content/report changes, create a uniquely named Git bundle, verify it, and compare every preserved live ref name/SHA. Keep all earlier bundles.
5. Publish final closeout evidence, confirm local/remote head equality and clean status, and leave PR #75 open/unmerged. Do not continue to another task.

## Constraints and stop condition

- Do not merge PR #75, modify `main` or the source checkout, delete/prune refs, or remove/overwrite existing bundles.
- Do not run heavy tests locally or fix unrelated CRM/product issues.
- Stop after final report and archive proof; no new phase or implementation work.
