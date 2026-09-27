# Remaining Implementation Plan

Status: IN PROGRESS. This file lists only unresolved work from the branch consolidation. Do not implement new product features here.

## 1. Finish canonical parity evidence after test-discovery port

- Done: GitHub Actions run `36271881713` completed with immutable `main` SHA `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` and tested `unified` SHA `4f5808bf1c27225aa8ca28c23ce7d9a16444d877` on `windows-2025`, Node `22.23.3`, pnpm `9.15.9`.
- Done: raw artifacts show lint/typecheck/toolchain pass on both sides. Build has the same 19 failures on each side (PREEXISTING). Unit has 5,051 passed, 36 failed, 5 skipped on each side; the same 42 normalized failures, 2 timeouts each, 0 worker errors (PREEXISTING 42, REGRESSION 0, RESOLVED 0). Build duration: 56,790 ms main / 56,533 ms unified. Unit duration: 1,478,040 ms main / 1,380,893 ms unified.
- Done locally: six parser/summary tests pass; corrected comparison over downloaded GitHub artifacts produces the above classifications and reconstructs unified toolchain PASS from the install and gate logs. Frozen-install durations: 36,800 ms main / 34,200 ms unified; gate duration is not measured separately.
- Done for the original snapshot: report-only Actions run `36275964555` downloaded the retained raw artifacts and published the corrected canonical comparison at https://github.com/trydavidqix/Lumenva/actions/runs/36275964555. Its matrix was skipped; the heavy suite was not rerun. This evidence predates the PR #69 test-discovery port and is superseded for final consolidation.
- The first run's own comparison artifact had parser/toolchain-summary defects and is not canonical; the report-only artifact supersedes it. Toolchain timing reports the frozen install only, not the separate policy-gate duration.
- Ported PR #69 test discovery selectively: 14 workspace scripts expose 119 existing test/spec files (the PR description says 118); two repository-relative test paths were updated for the current architecture.
- The parity runner applies an equivalent temporary script/path overlay to the pinned main validation worktree, restores it afterward, and checks that both snapshots use identical commands. It records the coverage profile as an artifact.
- Next: push this change to `implementation/unified`, run the full Actions comparison under Node `22.23.3` / pnpm `9.15.9`, and classify exact test failures as PREEXISTING or REGRESSION. Do not change failures shared with main. Use Jules only if Actions proves a real isolated regression and diagnosis/correction is appropriate.

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
- PR #69 (package test discovery): selectively ported `test:unit` registration to the 14 current workspace paths and corrected two test references to the current repository layout. Inventory finds 119 test/spec files across those packages (PR description claimed 118). The parity runner now applies equivalent ephemeral script/path overlays to the pinned main worktree and runs the same recursive suite on main and unified; main source remains unchanged. Pending exact Node 22.23.3 / pnpm 9.15.9 Actions comparison. Do not fix failures shared with main.
- PR #71 (F6–F8 handoff): dated docs/rules snapshot; verify/build fail. Preserve with PR and validate currentness before any selective copy.
- PR #74 (`chore/orchestration-gate`): new 18-file governance/hook/evidence implementation opened during parity validation. CodeQL, security scans, invariants, gcp-invariants, and vertical passed; `verify`, `verify-and-build`, and dependent `governance-evidence` completed FAILURE. Its workflow used base `.nvmrc` `22` (resolved to Node 22.23.2), so the run is not exact-toolchain evidence. Keep isolated; assess its own head and behavior before considering integration.
- Their current failing checks are stale-base results, not proof of regressions against present `main`: PR bases trail `origin/main` by 2–47 commits. PR #74's verify/build and dependent evidence checks are complete failures; its CI resolved main's floating `.nvmrc` `22` to Node `22.23.2`, so it is not exact-toolchain evidence. Re-run/inspect only candidates on the current base before deciding whether a failure is product-caused.
- Do not merge or close any PR as part of consolidation. Keep feature refs and evidence intact; only port a useful change after its contents, current-main overlap, and relevant checks are proven.
- Closed PR #1 contains an in-memory Agent Definition version-store prototype and a stale acceptance-test import path. No production persistence contract exists. Treat as a future product decision, not consolidation work.
- Closed PR #5 contains historical fixes already superseded by later merges plus unmatched test/runner changes. Do not merge the snapshot. Revisit only a specific remaining fix with current evidence.
- `fix/meta-provider-contracts` includes an old provider-router scaffold and an inbox-sync variant that does not persist events. Do not port it.

## Completion gate

- Original pinned GitHub Actions comparison is published; final canonical comparison after the PR #69 coverage port is pending.
- Branch classifications and all archive refs are documented and bundle-verified.
- `main` and the original Lumenva checkout are unchanged. The unified branch has the described PR #69 selective port in progress; do not treat it as validated until the new Actions artifact completes.
- No branch is deleted until archival proof passes and its unique worktree/local data is accounted for.
