# Safe Git Consolidation — 2026-09-26

Status: IN PROGRESS. This audit belongs to the isolated `Lumenva-Unification` clone; it does not change the source checkout.

## Isolated clone and baseline

- Clone: `C:\Users\David\Desktop\Projetos\Lumenva-Unification`; its own `.git` directory (not a linked worktree).
- `origin`: `https://github.com/trydavidqix/Lumenva.git`.
- `source-local`: `C:\Users\David\Desktop\Projetos\Lumenva`.
- Initial `implementation/unified` baseline: SHA `2851ff59085b84d5465eac45c1bb94ff0232c358`.
- Fetch inventory: 54 origin branch refs and 24 source-local branch refs; neither remote currently exposes tags.
- No source files, source refs, or GitHub refs were modified by this task. No branch was merged or deleted; no push was made.
- During this task, PR #72 was confirmed merged externally on 2026-09-26. PR #73 later merged into remote `main`, now `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`; that exact upstream tip has been merged into `implementation/unified` as merge commit `8586e28f9217fe754fe2f38c6dbfa66873e95cb2`. The original baseline remains available in the parent history and backup bundle.

## Active branch exclusion

`chore/claude-harness-architecture` was kept **ACTIVE / DO NOT INTEGRATE** while PR #73 was unresolved. After GitHub merged PR #73, its result entered `origin/main` and was incorporated into `implementation/unified` through the merge above. No uncommitted files from the source checkout were copied.

## Backup and inventory evidence

The existing backup is `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-pre-unification.bundle`. `git bundle verify` succeeded and the bundle contains 100 refs, including the 21 recovery refs. All 79 current origin/source-local remote-tracking ref tips exactly match SHAs present in the bundle. Detailed point-in-time records remain under `.git-audit` beside the bundle: branch inventory, feature groups, PR inventory, worktrees, and source status. The older `docs/audits/branch-consolidation-plan-2026-09-01.md` is explicitly a DeskcommCRM audit and is not the current Lumenva plan.

## Consolidation decisions

- Preserve all refs pending integration and archival proof. A branch being behind `main` or having a merged PR is not alone proof that its unique commits, worktree, or operational purpose can be discarded; several PRs target feature branches and many were squash-merged.
- Do not integrate branches for open PRs. Current open PRs include #11, #13, #25, #40, #50, #66, #69, #71, and #73. PR #69 has conflicts/check failures; the others remain outside this consolidation unless their owners close or merge them.
- The inventory records 13 origin branches with no associated PR and one closed-unmerged branch (#12). Most no-PR branches have unique commits relative to `main` (e.g. TOKENS, VPS, Local Runtime, Command Center, and F3); keep them until purpose/ownership is reconciled. PR #73 remains **ACTIVE / DO NOT INTEGRATE YET** even though the current source checkout is clean.
- No complete current plan with the exact title “SAFE GIT BRANCH CONSOLIDATION AND TOOLCHAIN STANDARDIZATION” was found in the clone or the pre-unification snapshot. This audit records verified work without treating the unrelated 2026-09-01 DeskcommCRM plan as authoritative.

## Toolchain changes in this clone

- Canonical versions are Node `22.23.3` and pnpm `9.15.9`; root `packageManager` keeps its existing SHA-512 integrity suffix.
- `pnpm-workspace.yaml` is the single catalog for repeated shared direct dependencies. All repeated direct dependency declarations use `catalog:`; the root `package.json` contains the repository check script and exact engines.
- The workspace uses one direct version each for TypeScript (`5.9.3`), React/react-dom (`19.2.8`), Next.js (`16.3.2`), Vitest/coverage (`4.1.11`), and shared `@types/*`. The lockfile was regenerated under pnpm 9.15.9.
- Added `pnpm repo:check` to verify runtime versions, catalog consistency, workspace overrides, lockfile, CI, Docker, Cloud Build, and Vercel build/install configuration. CI workflows, Docker builds, Cloud Build, and Vercel now run the gate.
- The two existing overrides are root-only: PostCSS (`^8.5.26`) keeps Next/Vite peer resolutions on compatible PostCSS 8 releases; Sharp (`^0.35.0`) satisfies Next 16's optional peer. `pnpm why` confirmed those dependency paths. Third-party peer incompatibilities (`@emoji-mart/react` vs React 19, LlamaIndex workflow-core vs Next 16, and LlamaIndex tokenizer vs gpt-tokenizer 3) are documented as unresolved upstream compatibility warnings; no unsafe transitive override was added.
- Vercel's managed Node runtime only supports selecting a major line and rolls patch versions automatically. The deployment build gate fails closed unless the build itself runs on exactly 22.23.3, but the managed function runtime patch cannot be pinned through Vercel configuration.
- No product/runtime behavior was intentionally changed; package versions changed only to enforce the requested shared direct-dependency policy.

## Validation

- Node `v22.23.3` and pnpm `9.15.9` were verified. `pnpm repo:check`: passed for 28 workspace manifests after lockfile regeneration.
- `pnpm install --frozen-lockfile`: passed after the final catalog update under Node `v22.23.3` / pnpm `9.15.9`.
- `pnpm typecheck`: passed after the final catalog update. `pnpm lint`: zero errors, 317 warnings.
- `actionlint`: passed. `git diff --check`: passed with only Git's LF/CRLF notices.
- `pnpm --filter @lumenva/web build`: passed. Next.js rewrote the app tsconfig during the build; that generated change was reverted, so it is not part of this patch.
- Full `pnpm test:unit` on the original unified baseline, exact Node/pnpm: 669 passed, 53 failed, 5 skipped (701 files; one suite-level worker/load issue also reported). The same suite on the original main baseline produced the same known failure signatures in the captured output; its terminal summary was truncated, so exact aggregate counts are not asserted. GitHub Actions comparison is the canonical repeatable evidence.
- Builds: `@lumenva/web` passed; `lumenva-website` passed with temporary `NEXT_PUBLIC_SITE_URL=https://example.invalid` (no env file changed). `@lumenva/mcp` failed on unresolved exports/files in `packages/core/operating-core/src/index.ts`; this is not attributed to toolchain changes and awaits comparison against main. The first website attempt without the required URL failed as expected; the placeholder retry passed.
- `pnpm repo:check` passed after the final lockfile update. The nested CRM `pnpm.overrides` was removed and central policy is checked; the existing workspace cycle warning remains unchanged.
- Added `.github/workflows/branch-parity-validation.yml`: pins one main SHA and the triggering unified SHA, runs on `windows-2025`, executes each pair sequentially with exact Node/pnpm and frozen installs, splits unit/typecheck/lint/build/toolchain into parallel jobs, uploads raw logs and JSON summaries, and emits a comparison artifact with pass/fail counts, test counts, timeout/worker errors, duration, and PREEXISTING/REGRESSION/UNKNOWN classification. This workflow has not yet run; Actions artifacts remain the canonical pending evidence.
- Remaining: push the isolated implementation branch to trigger Actions; review its artifacts; finish branch-by-branch content classification and write the final consolidation reports. No refs have been deleted.

No source checkout or GitHub branch was used as a write target. Consolidation is not complete: all refs remain preserved, open/unmerged PRs and branches without a verified owner/integration decision remain unintegrated, and no refs have been archived or deleted.
