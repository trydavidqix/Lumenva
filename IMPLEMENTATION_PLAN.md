# Remaining Implementation Plan

Status: IN PROGRESS. This file lists only unresolved work from the branch consolidation. Do not implement new product features here.

## 1. Finish canonical parity evidence

- Wait for GitHub Actions run `36271881713`, which pins code SHA `4f5808bf1c27225aa8ca28c23ce7d9a16444d877` against main. Current branch `153e390f` changes only the report classifier. Four validation jobs succeeded; unit was still running at 21:30 UTC.
- Review `branch-parity-comparison` plus all raw suite artifacts.
- Dispatch `branch-parity-report.yml` on current `implementation/unified` to regenerate the report from those raw artifacts with the latest failure-count and coverage-loss rules. Do not rerun the heavy suite solely for this classifier update.
- Record passed, failed, and skipped tests; failure signatures; timeouts; worker errors; durations; and PREEXISTING/REGRESSION/UNKNOWN result.
- If a genuine isolated regression appears, investigate only that regression. Use Jules only for a confirmed isolated regression.
- Do not change preexisting failures.

## 2. Preserve archival coverage before any branch cleanup

- Done: supplemental bundle at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-2026-09-26.bundle` passed `git bundle verify`.
- Done: 90 refs in bundle; all 88 expected local refs matched; 21 recovery refs and archived PR heads #1, #4, #5, and #12 are present.
- Keep all source refs until Actions evidence and final classification are reviewed.
- Do not delete `main`, `implementation/unified`, open-PR branches, recovery refs, or any branch/worktree with unique local data.
- No branch deletion is part of the current run. Any cleanup candidate must be listed separately with archive proof first.

## 3. Reconcile remaining F3 security work safely

- PRs #20–24 merged into `feat/f3-rbac`, not `main`. Do not report the aggregate implementation as integrated.
- The branch replaces Firebase identity checks with Supabase `auth.getUser()` and an `auth.uid()`-based role RPC. Current `main` explicitly uses Firebase identity and documents why Supabase `auth.uid()` cannot represent that session.
- Re-evaluate only the still-useful RBAC/ACL work against the current Firebase identity contract. Map any retained migration into canonical `infra/supabase/`, add focused evidence, and validate before integration.
- Do not copy unrelated `patch_session_req.ts` or merge the whole branch.

## 4. Resolve individually reviewed open-PR candidates

- PR #11 (Maestri Council docs): outside CRM; preserve with its existing PR.
- PR #13 (voice notifications): separate active voice workstream targeting Command Center; draft explicitly prohibits merge; preserve on `voz`.
- PR #25, `TOKENS`, `vps`, Local Runtime, Command Center/Maestri: Nexus ownership; keep outside CRM.
- PR #40 (Jules delegation doc): docs-only; verify is failing, so preserve with PR and do not claim validated.
- PR #50 (WAHA adapter): unique feature; verify/build fail, so keep isolated pending diagnosis/review.
- PR #66 (Nuvemshop fail-closed): security candidate; verify/build fail despite CodeQL/invariants/vertical passing. Do not port until failing checks are understood and behavior is compared with unified.
- PR #69 (package test discovery): PR claims 118 existing tests across 14 packages become discoverable. Verify/build fail on a base 4 commits behind current main. Fourteen of its 18 changed paths moved during architecture refactor; map scripts/tests to new paths. Candidate only after determining failures and ensuring main/unified execute equivalent tests.
- PR #71 (F6–F8 handoff): dated docs/rules snapshot; verify/build fail. Preserve with PR and validate currentness before any selective copy.
- Their current failing checks are stale-base results, not proof of regressions against present `main`: PR bases trail `origin/main` by 2–47 commits. Re-run/inspect only candidates on the current base before deciding whether a failure is product-caused.
- Do not merge or close any PR as part of consolidation. Keep feature refs and evidence intact; only port a useful change after its contents, current-main overlap, and relevant checks are proven.
- Closed PR #1 contains an in-memory Agent Definition version-store prototype and a stale acceptance-test import path. No production persistence contract exists. Treat as a future product decision, not consolidation work.
- Closed PR #5 contains historical fixes already superseded by later merges plus unmatched test/runner changes. Do not merge the snapshot. Revisit only a specific remaining fix with current evidence.
- `fix/meta-provider-contracts` includes an old provider-router scaffold and an inbox-sync variant that does not persist events. Do not port it.

## Completion gate

- Canonical GitHub Actions comparison is complete and artifacts are retained; package coverage limitations are recorded and no PR with failing verify/build is treated as validated.
- Branch classifications and all archive refs are documented and bundle-verified.
- `main` is unchanged; `implementation/unified` contains no unreviewed changes.
- No branch is deleted until archival proof passes and its unique worktree/local data is accounted for.
