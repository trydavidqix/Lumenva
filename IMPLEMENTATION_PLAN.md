# Consolidation Closeout — PR #75

## Current state

- Branch: `consolidation/lumenva-main-2026-09-27`
- Candidate HEAD: `8d2962808a89656a106ccd6e3d729536b300d93d`
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
3. E2E candidate run `36444930221` failed at application queries with permission denied for `fn_user_org_ids`. Relevant application code and function grants match `origin/main`.
4. Updated E2E workflow to copy only the candidate's non-secret identity seed and exact visual spec into the disposable `main` test worktree, enabling a same-fixture baseline run without changing product code.

## Remaining useful work

1. Commit/push the test-harness parity change and report updates to the PR branch; dispatch the same E2E visual spec against `main` and collect its result.
2. Update the reports with that result and current PR checks; push the final documentation-only closeout update.
3. Create a new, uniquely named final Git bundle after the last report commit; verify it and compare every live ref name/SHA. Preserve all existing bundles and refs.
4. Verify final PR head/base, remote synchronization, archive evidence, and clean worktree. Leave PR #75 open/unmerged for the owner.

## Constraints and stop condition

- Do not merge PR #75, modify `main` or the source checkout, delete/prune refs, or remove/overwrite existing bundles.
- Do not run heavy tests locally or fix unrelated CRM/product issues.
- Stop after final report and archive proof; no new phase or implementation work.
