# Remaining Implementation Plan

Status: IN PROGRESS. This file lists only unresolved work from the branch consolidation. Do not implement new product features here.

## 1. Resolve the four isolated Stripe test regressions

- Done: GitHub Actions run `36315065234` compared immutable `main` `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` with tested unified snapshot `ff871fac24e5ecd0cbb892375f08bfff3721d702` on `windows-2025`, Node `22.23.3`, pnpm `9.15.9`. The five suite jobs ran in parallel; each compared main/unified on the same runner and used frozen installs. [Canonical run](https://github.com/trydavidqix/Lumenva/actions/runs/36315065234).
- Done: lint, typecheck, and toolchain passed on both sides; unified `repo:check` passed. Build has the same 19 failure signatures on each side (`PREEXISTING`), duration 59,185 ms main / 60,349 ms unified.
- Done: unit artifacts show main 5,487 passed / 88 failed / 10 skipped and unified 5,488 passed / 96 failed / 11 skipped. 52 normalized failure IDs are shared (`PREEXISTING`); four IDs are unified-only (`REGRESSION`). Unit duration 1,496,763 ms main / 1,416,129 ms unified. Worker errors 0/0; explicit test/hook/worker timeouts 0/0. The first comparison report mistakenly counted timeout-like stack text; commit `45771c83` fixes this parser and adds coverage. Corrected parsing of the retained raw Actions logs reports 0/0, but GitHub's uploaded comparison artifact still contains its original parser defect; the raw logs/summaries are the evidence for corrected timeout counts.
- Regression cause: four Stripe tests use arrow-function mock constructors that Vitest 4 attempts to instantiate. The production Stripe `.ts` files are unchanged from main, so this is confirmed as a test/toolchain compatibility regression, not a proven production behavior regression. Do not change the 52 failures shared with main.
- Pending: investigate/correct only those four Stripe tests with Jules, then run the focused Stripe tests and a new parity validation for the changed snapshot. The Jules CLI has no branch selector and the API route needs credentials that are not configured; no Jules session was created, to avoid sending work to `main`. Resume only when a safe Jules session explicitly bound to `implementation/unified` is available, or after David authorizes a direct patch.

## 2. Preserve archival coverage before any branch cleanup

- Done: supplemental bundle at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-2026-09-26.bundle` passed `git bundle verify`.
- Done: 90 refs in bundle; all 88 expected local refs matched; 21 recovery refs and archived PR heads #1, #4, #5, and #12 are present.
- Done: created a separate up-to-date bundle at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-2026-09-27.bundle`; `git bundle verify` passed and all 89 current local branch/archive/origin/source-local refs match by name and SHA. It includes the fetched PR #74 head and current `origin/main` / `origin/implementation/unified`. Size 81,481,036 bytes; SHA-256 `51A4079C7874A379D3BA9CA71C46AFF4A2F9908EA880323C9F3F7CBA37A2742E`. The earlier bundle remains untouched.
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
- PR #50 (WAHA adapter): unique feature, not integrated. Its five new tests all fail at setup because they assign getter-only fields; adapter contract and focused correction remain unvalidated.
- PR #66 (Nuvemshop fail-closed): selectively ported safe subset; its five focused tests passed in PR CI. The PR's decrypt failure → 401 change was excluded. Selected changes are included in the exact-toolchain parity snapshot.
- PR #69 (package test discovery): selectively ported `test:unit` to 14 current workspace paths and corrected two test paths. Inventory finds 119 test/spec files. The complete Actions comparison tested the same coverage on main and unified; the separate four Stripe mock regressions are recorded above. Do not fix failures shared with main.
- PR #71 (F6–F8 handoff): dated docs/rules snapshot; verify/build fail. Preserve with PR and validate currentness before any selective copy.
- PR #74 (`chore/orchestration-gate`): new 18-file governance/hook/evidence implementation opened during parity validation. CodeQL, security scans, invariants, gcp-invariants, and vertical passed; `verify`, `verify-and-build`, and dependent `governance-evidence` completed FAILURE. Its workflow used base `.nvmrc` `22` (resolved to Node 22.23.2), so the run is not exact-toolchain evidence. Keep isolated; assess its own head and behavior before considering integration.
- Their current failing checks are stale-base results, not proof of regressions against present `main`: PR bases trail `origin/main` by 2–47 commits. PR #74's verify/build and dependent evidence checks are complete failures; its CI resolved main's floating `.nvmrc` `22` to Node `22.23.2`, so it is not exact-toolchain evidence. Re-run/inspect only candidates on the current base before deciding whether a failure is product-caused.
- Do not merge or close any PR as part of consolidation. Keep feature refs and evidence intact; only port a useful change after its contents, current-main overlap, and relevant checks are proven.
- Closed PR #1 contains an in-memory Agent Definition version-store prototype and a stale acceptance-test import path. No production persistence contract exists. Treat as a future product decision, not consolidation work.
- Closed PR #5 contains historical fixes already superseded by later merges plus unmatched test/runner changes. Do not merge the snapshot. Revisit only a specific remaining fix with current evidence.
- `fix/meta-provider-contracts` includes an old provider-router scaffold and an inbox-sync variant that does not persist events. Do not port it.

## Completion gate

- Exact-toolchain GitHub Actions comparison is complete. Four isolated Stripe test regressions remain; 52 unit failure IDs and 19 build failure signatures are preexisting. The corrected timeout parser is pushed, but its corrected count was confirmed against retained raw logs locally because the report-only workflow is not registered on the default branch.
- Branch classifications and all archive refs are documented and bundle-verified.
- `main` and the original Lumenva checkout are unchanged. Do not consider the consolidation complete until the four isolated Stripe test regressions have been handled and the affected parity evidence is refreshed.
- No branch is deleted until archival proof passes and its unique worktree/local data is accounted for.
