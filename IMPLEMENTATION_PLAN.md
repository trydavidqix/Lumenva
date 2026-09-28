# Consolidation Closeout — PR #75

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
