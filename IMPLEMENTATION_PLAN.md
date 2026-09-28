# Consolidation Closeout — PR #75

## Current state

- Branch: `consolidation/lumenva-main-2026-09-27`
- Candidate HEAD: `9dbfd276e20748501d9960d249b2f444d1cd325d`
- Base `main`: `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`
- PR #75 is open and unmerged. Main and the original Lumenva checkout remain untouched.
- Heavy validation runs only in GitHub Actions. No local test suite is evidence.

## Completed and evidenced on current HEAD

1. Test-only E2E identity fixtures now seed the expected Firebase UID-to-user mappings; no genuine or production credential was created.
2. Test-only E2E environment disables external Sentry telemetry with `SENTRY_DSN=off`.
3. Invariants, F2/F3 vertical, security scans, direct-parity toolchain, and direct-parity lint have passed.
4. The report now records the current E2E failure and active Actions run IDs.

## Verified progress on current HEAD

1. Direct parity run `36445124677` completed on the same runner with Node `22.23.3` and pnpm `9.15.9`: candidate build/lint/toolchain/typecheck passed; unit failures were main `88` vs candidate `7`, with `0` regressions, `5` shared failures, and `47` resolved. No timeouts or worker errors.
2. Candidate CI `36444929702` and GCP CI `36444929947` passed, including their unit/build verification jobs.
3. E2E candidate run `36444930221` reached seven pages, then failed with HTTP 500 from `fn_user_org_ids` permission denial. Same-fixture `main` run `36450538203` failed earlier during test login and did not reach those pages; the exact runtime E2E failure is therefore not parity-proven. Relevant query callers and SQL grant match `origin/main`.
4. E2E workflow now overlays only non-secret emulator config, identity fixture, environment generator, and the exact visual spec into the disposable baseline worktree. No CRM source checkout or `main` file was changed.

## Remaining closeout

1. Push final evidence/report update; recheck the resulting PR checks and exact head/base.
2. Create a new, uniquely named final Git bundle after the last report commit; verify it and compare every live ref name/SHA. Preserve all existing bundles and refs.
3. Verify final remote synchronization, archive evidence, and clean worktree. Leave PR #75 open/unmerged for the owner.

## Constraints and stop condition

- Do not merge PR #75, modify `main` or the source checkout, delete/prune refs, or remove/overwrite existing bundles.
- Do not run heavy tests locally or fix unrelated CRM/product issues.
- Stop after final report and archive proof; no new phase or implementation work.
