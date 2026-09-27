# Remaining Implementation Plan

Status: IN PROGRESS. This file lists only unresolved work from the branch consolidation. Do not implement new product features here.

## 1. Resolve the four isolated Stripe test regressions

- Done: GitHub Actions run `36315065234` compared immutable `main` `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` with tested unified snapshot `ff871fac24e5ecd0cbb892375f08bfff3721d702` on `windows-2025`, Node `22.23.3`, pnpm `9.15.9`. The five suite jobs ran in parallel; each compared main/unified on the same runner and used frozen installs. [Canonical run](https://github.com/trydavidqix/Lumenva/actions/runs/36315065234).
- Done: lint, typecheck, and toolchain passed on both sides; unified `repo:check` passed. Build has the same 19 failure signatures on each side (`PREEXISTING`), duration 59,185 ms main / 60,349 ms unified.
- Done: unit artifacts show main 5,487 passed / 88 failed / 10 skipped and unified 5,488 passed / 96 failed / 11 skipped. 52 normalized failure IDs are shared (`PREEXISTING`); four IDs are unified-only (`REGRESSION`). Unit duration 1,496,763 ms main / 1,416,129 ms unified. Worker errors 0/0; explicit test/hook/worker timeouts 0/0. The original comparison artifact counted timeout-like stack text incorrectly; report-only Actions run `36319801822` regenerated and uploaded the corrected comparison from retained run `36315065234` artifacts, with the heavy matrix skipped. [Corrected artifact run](https://github.com/trydavidqix/Lumenva/actions/runs/36319801822).
- Regression cause: four Stripe tests use arrow-function mock constructors that Vitest 4 attempts to instantiate. The production Stripe `.ts` files are unchanged from main, so this is confirmed as a test/toolchain compatibility regression, not a proven production behavior regression. Do not change the 52 failures shared with main.
- Pending: investigate/correct only those four Stripe tests with the existing Jules session, then run focused Stripe tests and a new parity validation for the changed snapshot. At the 2026-09-27 checkpoint, `jules remote list --session` showed session `2727874664977885671` last active 28m42s earlier with blank status, and `jules remote pull --session 2727874664977885671` returned `No diff found in the remote VM.` This is inconclusive, not terminal. Chrome was running, but screenshot-backed computer use stopped because it could not determine the current URL confidently; no page interaction occurred. Do not start a replacement session, send a competing task, or modify the same tests until the existing session's state is known. Its prompt requires a new branch from `origin/implementation/unified` and proof of the validation base before editing; stop if the gate fails. Do not change preexisting failures.

## 2. Preserve archival coverage before any branch cleanup

- Done: supplemental bundle at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-2026-09-26.bundle` passed `git bundle verify`.
- Done: 90 refs in bundle; all 88 expected local refs matched; 21 recovery refs and archived PR heads #1, #4, #5, and #12 are present.
- Done: created a separate branch-ref snapshot at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-2026-09-27.bundle`; `git bundle verify` passed and all 89 refs present at creation (heads/archive/origin/source-local) matched by name and SHA. It includes PR #74 and current main/unified at that time. Size 81,481,036 bytes; SHA-256 `51A4079C7874A379D3BA9CA71C46AFF4A2F9908EA880323C9F3F7CBA37A2742E`. Subsequent unified commits only update consolidation documentation; the earlier bundles remain untouched.
- Done: refreshed after documentation checkpoint `379511a6` at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-2026-09-27-379511a6.bundle`. `git bundle verify` succeeded and advertised 91 refs (all enumerated refs plus bundle HEAD and the main-validation worktree ref); it includes current `implementation/unified`, current `origin/main`, all fetched origin/source-local refs, archive refs and local `main`. Size 81,491,614 bytes; SHA-256 `E4D2B7D35F20C93928B2DC203B3725D29EF4E148EE4C1FF6E942775C3F91BB20`.
- Evidence note: local `refs/heads/main` and detached main-validation worktree remain at `2851ff59085b84d5465eac45c1bb94ff0232c358`; current `origin/main` is `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`, one commit ahead. Preserve this state; parity uses the exact remote SHA and neither local main nor the original Lumenva checkout was changed.
- Keep all source refs until Actions evidence and final classification are reviewed.
- Do not delete `main`, `implementation/unified`, open-PR branches, recovery refs, or any branch/worktree with unique local data.
- No branch deletion is part of the current run. Any cleanup candidate must be listed separately with archive proof first.

## 3. Resolve individually reviewed open-PR candidates

- PR #11 (Maestri Council docs): outside CRM; preserve with its existing PR.
- PR #13 (voice notifications): separate active voice workstream targeting Command Center; draft explicitly prohibits merge; preserve on `voz`.
- PR #25, `TOKENS`, `vps`, Local Runtime, Command Center/Maestri: Nexus ownership; keep outside CRM.
- PR #40 (Jules delegation doc): docs-only; `verify` fails while invariants/vertical pass. The documented SDK is installed locally, but its workflow and secret/branch-selection behavior remain unvalidated. Preserve with PR; do not copy into this consolidation yet.
- PR #50 (WAHA adapter): unique feature, not integrated. Its five new tests all fail at setup because they assign getter-only fields; adapter contract and focused correction remain unvalidated.
- PR #66 (Nuvemshop fail-closed): selectively ported safe subset; its five focused tests passed in PR CI. The PR's decrypt failure → 401 change was excluded. Selected changes are included in the exact-toolchain parity snapshot.
- PR #69 (package test discovery): selectively ported `test:unit` to 14 current workspace paths and corrected two test paths. Inventory finds 119 test/spec files. The complete Actions comparison tested the same coverage on main and unified; the separate four Stripe mock regressions are recorded above. Do not fix failures shared with main.
- PR #71 (F6–F8 handoff): reviewed; dated snapshot still lists #69 as pending, and its rule edits assert persistent Claude CEO merge authority and remove MFA requirements. No separate Owner authorization exists in this consolidation to adopt those governance changes. Do not copy; preserve the open PR/history.
- PR #74 (`chore/orchestration-gate`): new 18-file governance/hook/evidence implementation opened during parity validation. Latest head run [36275779098](https://github.com/trydavidqix/Lumenva/actions/runs/36275779098) passed typecheck, lint, harness checks, invariants, GCP invariants, and vertical; unit tests failed in `verify` and `verify-and-build`, and dependent `governance-evidence` failed. The run used Node 22.23.2, not exact 22.23.3. Keep isolated; assess its own head and behavior before considering integration.
- Their current failing checks are stale-base results, not proof of regressions against present `main`: PR bases trail `origin/main` by 2–47 commits. PR #74's verify/build and dependent evidence checks are complete failures; its CI resolved main's floating `.nvmrc` `22` to Node `22.23.2`, so it is not exact-toolchain evidence. Re-run/inspect only candidates on the current base before deciding whether a failure is product-caused.
- Do not merge or close any PR as part of consolidation. Keep feature refs and evidence intact; only port a useful change after its contents, current-main overlap, and relevant checks are proven.
- Closed PR #1 contains an in-memory Agent Definition version-store prototype and a stale acceptance-test import path. No production persistence contract exists. Treat as a future product decision, not consolidation work.
- Closed PR #5 contains historical fixes already superseded by later merges plus unmatched test/runner changes. Do not merge the snapshot. Revisit only a specific remaining fix with current evidence.
- `fix/meta-provider-contracts` includes an old provider-router scaffold and an inbox-sync variant that does not persist events. Do not port it.

## Completion gate

- Exact-toolchain GitHub Actions comparison and corrected report-only artifact are complete. Four isolated Stripe test regressions remain; 52 unit failure IDs and 19 build failure signatures are preexisting. The report-only run skipped the heavy matrix and published corrected timeout counts from the retained raw artifacts.
- Local `repo:check` passes under explicitly selected Node 22.23.3/pnpm 9.15.9. The machine's default Node remains 24.19.0; the isolated Node 22 runtime is available without a global PATH change.
- Branch classifications and all archive refs are documented and bundle-verified.
- `main` and the original Lumenva checkout are unchanged. Do not consider the consolidation complete until the four isolated Stripe test regressions have been handled and the affected parity evidence is refreshed.
- No branch is deleted until archival proof passes and its unique worktree/local data is accounted for.
