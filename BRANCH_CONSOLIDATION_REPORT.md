# Branch Consolidation Report

Status: IN PROGRESS. No branch refs have been deleted. No changes have been made to the source checkout or `main`.

## Repository and comparison baseline

- Isolated clone: `C:\Users\David\Desktop\Projetos\Lumenva-Unification`.
- `origin`: `https://github.com/trydavidqix/Lumenva.git`.
- `source-local`: `C:\Users\David\Desktop\Projetos\Lumenva`.
- Source checkout was read-only and clean on `main` at `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`.
- Current `origin/main`: `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`.
- Current `implementation/unified`: `153e390fb3da06602c6b9ebb95ad75efe9a96a8d`.
- This branch includes the exact current `origin/main` tip and selective F3–F5 cleanups. It has not been merged to `main`.
- Existing pre-unification bundle remains at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-pre-unification.bundle`.
- Supplemental bundle: `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-2026-09-26.bundle`. `git bundle verify` passed. It contains 90 refs; all 88 expected local refs match exactly (0 missing, 0 mismatched), including all 21 recovery refs and four archived closed-PR heads (#1, #4, #5, #12). Size: 81,425,389 bytes. SHA-256: `737FBC45553E988CC90C47D31477F67FECD3A16C0242F2D769A3706D50C048FA`.
- Current remote-tracking inventory: 56 origin refs, including `main` and `implementation/unified`; 24 `source-local` refs, including 21 recovery refs. No refs were deleted.
- Isolated clone has one detached, clean baseline worktree at `C:\Users\David\AppData\Local\Temp\Lumenva-main-validation-20260926`, HEAD `2851ff59085b84d5465eac45c1bb94ff0232c358`. It remains untouched and preserved as an extra bundle ref.

## Branch decisions

### Integrated or superseded by current `main`

- Merged pull-request work targeting `main` is represented there; PRs #72 and #73 were incorporated, and the exact current `main` SHA is in `implementation/unified`.
- Exception: PR #26 (`codex/mcg-ci-integration`) merged only into `lumenva-command-center`, not `main`. It remains outside CRM consolidation because its MCG/dashboard ownership is Nexus.
- PRs #39–42 targeted the F5 aggregate branch; their final aggregate entered `main` through PR #43.
- `feat/f1-identity-mapping` is superseded by the later F1 identity mapping and F2 canonical mapping. Its Maestri/Codex plan belongs to Nexus, not Lumenva CRM.
- `feat/f3-rbac` is an aggregator for PRs #20–24, but those PRs merged only into that feature branch, not directly into `main`. PR #27 merged the final matrix to `main`; it does not prove every RBAC code change reached `main`.
- `feat/meta-direct-social-login` has no commits missing from `main`.
- `fix/meta-provider-contracts` has no remaining tree delta in the Meta integration paths against `main`; its provider-router prototype targets an obsolete package path.
- `feat/maestri-engineering-council` duplicates the council material in the open clean-council PR #11.
- `fix/f4-j1-lint`, `fix/f5-task5-lint`, and the F3 ACL-audit post-PR cleanup contained small type/test-quality changes. Safe changes were selectively ported in commit `227ac411`; no branch was merged wholesale.
- A separate post-PR F5 change that changes an endpoint contract from HTTP 410 to 501 was rejected because current `main` and its tests explicitly require 410.

### Active pull requests — preserve and do not integrate while open

| PR | Branch | Classification | Scope |
|---|---|---|---|
| #11 | `feat/maestri-engineering-council-clean` | ACTIVE | Engineering Council documentation |
| #13 | `voz` | ACTIVE | Voice notifications; targets legacy Command Center branch |
| #25 | `vps-17455632840955604138` | ACTIVE / OUTSIDE CRM | Maestri/MCG; preserve for Nexus ownership |
| #40 | `docs/jules-delegation-skill` | ACTIVE | Jules delegation documentation |
| #50 | `jules-f7-waha-adapter-7831325555235237843` | ACTIVE | WAHA adapter |
| #66 | `fix/f7-nuvemshop-webhook-fail-closed` | ACTIVE | Nuvemshop webhook security |
| #69 | `chore/package-ci-tests` | ACTIVE | Package test registration |
| #71 | `docs/f6-f7-f8-handoff-2026-09-24` | ACTIVE | F6–F8 handoff documentation |

### Merged PRs — branch-by-branch record

| PR | Head branch | Merged into | Classification |
|---|---|---|---|
| #2 | `fix/waves-10-15` | `main` | INTEGRATED |
| #3 | `fix/docs-current-state-case` | `main` | INTEGRATED |
| #6 | `fix/waves-1-9` | `main` | INTEGRATED |
| #7 | `fix/ai-creator-commerce` | `main` | INTEGRATED |
| #8 | `fix/ci-pnpm-version-2026-09-18` | `main` | INTEGRATED |
| #9 | `remediation/business-os-cli-entitlements-2026-09-15` | `main` | INTEGRATED |
| #10 | `fix/customer360-remediation` | `main` | INTEGRATED |
| #14 | `chore/upstream-pull-01` | `main` | INTEGRATED |
| #15 | `feat/f2-tenant-isolation` | `main` | INTEGRATED |
| #16 | `chore/update-testing-doctrine` | `main` | INTEGRATED |
| #17 | `security/mcp-auth-rate-limit` | `main` | INTEGRATED |
| #18 | `chore/upstream-migrations-0347-0380` | `main` | INTEGRATED |
| #19 | `feat/f1-identity-mapping-v2` | `main` | INTEGRATED |
| #20 | `feat/f3-rbac-17111202584489541287` | `feat/f3-rbac` | Aggregator only; not in main |
| #21 | `feat/f3-task-1-platform-admin-api-12582833702745023097` | `feat/f3-rbac` | Aggregator only; not in main |
| #22 | `feat/f3-rbac-acl-audit-17806325391317863887` | `feat/f3-rbac` | Aggregator only; not in main |
| #23 | `feat/f3-rbac-14201095918533104138` | `feat/f3-rbac` | Aggregator only; not in main |
| #24 | `feat/f3-task4-human-role-separation` | `feat/f3-rbac` | Aggregator only; not in main |
| #26 | `codex/mcg-ci-integration` | `lumenva-command-center` | MCG/Nexus scope; not in main |
| #27 | `feat/f3-task6-final-matrix` | `main` | INTEGRATED; matrix only |
| #28 | `jules-auth-firebase-client-4940827573783815306` | `feat/f4-firebase-auth` | Included by F4 aggregate #33 |
| #29 | `feat/f4-firebase-identity-bridge-5646239490154747231` | `feat/f4-firebase-auth` | Included by F4 aggregate #33 |
| #30 | `feat/f4-firebase-auth-8431202958264026743` | `feat/f4-firebase-auth` | Included by F4 aggregate #33 |
| #31 | `feat/f4-firebase-auth-api-routes-2853622509282931784` | `feat/f4-firebase-auth` | Included by F4 aggregate #33 |
| #32 | `feat/f4-firebase-auth-6584745336670343089` | `feat/f4-firebase-auth` | Included by F4 aggregate #33 |
| #33 | `feat/f4-firebase-auth` | `main` | INTEGRATED; F4 aggregate |
| #34 | `feat/f5-task1-gcs-11165633749417281418` | `feat/f5-storage-realtime` | Included by F5 aggregate #43 |
| #35 | `feat/f5-task4-sse-8705358404323605379` | `feat/f5-storage-realtime` | Included by F5 aggregate #43; post-PR status change rejected |
| #36 | `feat/f5-task2-media-gcs-5082288770740349695` | `feat/f5-storage-realtime` | Included by F5 aggregate #43 |
| #37 | `feat/f5-task-3-aux-storage-15945593050366616123` | `feat/f5-storage-realtime` | Included by F5 aggregate #43 |
| #38 | `feat/f5-task5-realtime-client-14073667979986859526` | `feat/f5-storage-realtime` | Included by F5 aggregate #43 |
| #39 | `feat/f5-storage-realtime-7459603192977202492` | `feat/f5-storage-realtime` | Included by F5 aggregate #43 |
| #41 | `fix/f5-findings-2-3` | `feat/f5-storage-realtime` | Included by F5 aggregate #43 |
| #42 | `fix/f5-media-storage-test-mock` | `feat/f5-storage-realtime` | Included by F5 aggregate #43 |
| #43 | `feat/f5-storage-realtime` | `main` | INTEGRATED; F5 aggregate |
| #44 | `docs/f6-f7-f8-design` | `main` | INTEGRATED |
| #45 | `chore/f8-gcp-ci-workflow-3472599334636875907` | `main` | INTEGRATED |
| #46 | `feature/f8-j2-gcp-secrets-11517427039554397630` | `main` | INTEGRATED |
| #47 | `feature/f7-j3-meta-adapter-368541147442802420` | `main` | INTEGRATED |
| #48 | `f8-j3-publish-workflow-2470113440388419535` | `main` | INTEGRATED |
| #49 | `f7-j1-stripe-adapter-16080938620046599204` | `main` | INTEGRATED |
| #51 | `feat/f7-j4-nuvemshop-resend-adapters-17233514225075684717` | `main` | INTEGRATED |
| #52 | `f8-j4-gcp-logging-16419022131821244108` | `main` | INTEGRATED |
| #53 | `f6-drizzle-bootstrap-2-12269237188929114407` | `main` | INTEGRATED |
| #54 | `task-f8-j5-scheduler-1226964521338345617` | `main` | INTEGRATED |
| #55 | `jules/f7-j5-sentry-ratelimit-7369976782948795000` | `main` | INTEGRATED |
| #56 | `chore/f6-j3-shadow-messaging-17260995457662267953` | `main` | INTEGRATED |
| #57 | `f6-shadow-crm-3903949313584370746` | `main` | INTEGRATED |
| #58 | `f8-j6-gcp-runbook-17835513388088120930` | `main` | INTEGRATED |
| #59 | `docs/tdd-agent-doctrine` | `main` | INTEGRATED |
| #60 | `feature/f6-j4-shadow-read-14547404810458452972` | `main` | INTEGRATED |
| #61 | `f7-j6-adapter-matrix-18043191461025142301` | `main` | INTEGRATED |
| #62 | `fix/f6-c1-high-findings` | `main` | INTEGRATED |
| #63 | `fix/f8-c1-hardening` | `main` | INTEGRATED |
| #64 | `fix/orphan-packages-workspace-11502432029800832518` | `main` | INTEGRATED; retain test-skip behavior as existing baseline |
| #65 | `fix/f7-c1-approved-findings` | `main` | INTEGRATED |
| #67 | `chore/security-scanning-report-only` | `main` | INTEGRATED |
| #68 | `fix/security-batch-bc` | `main` | INTEGRATED |
| #70 | `docs/security-scanning-owner-decisions` | `main` | INTEGRATED |
| #72 | `refactor/lumenva-clean-architecture` | `main` | INTEGRATED; current main SHA included |
| #73 | `chore/claude-harness-architecture` | `main` | INTEGRATED; current main SHA included |

### Closed-unmerged pull requests

- PR #1 `remediation/business-os-acceptance-mcp-2026-09-15`: PARTIAL / SUPERSEDED. Most later fixes are represented by subsequent merged work. The remaining agent-version-store code is in-memory scaffolding, not a production persistence path; acceptance-test paths also reference the pre-reorganization package location. Preserve source head as `refs/archive/pr-001-head`; do not merge wholesale.
- PR #4 `feat/codex-ai-platform-architect`: OBSOLETE for this consolidation. It adds a Codex agent/subagent profile, not runtime functionality. Preserve source head as `refs/archive/pr-004-head`.
- PR #5 `fix/audit-stripe-windows`: PARTIAL / SUPERSEDED. It is a historical 167-file snapshot. Later main commits contain many equivalent fixes; unmatched commits include temporary runner configuration, old Windows workarounds, and test adjustments requiring individual product-context review. Preserve source head as `refs/archive/pr-005-head`; do not merge wholesale.
- PR #12 `lumenva-command-center`: OBSOLETE for CRM consolidation. Its MCG/Command Center and Local Runtime work belongs to Nexus, not Lumenva CRM. Preserve source head as `refs/archive/pr-012-head`.

### No-PR origin branches

| Branch | Classification | Decision |
|---|---|---|
| `backup/lumenva-command-center-pre-cleanup-2026-09-22` | BACKUP | Preserve as recovery snapshot. |
| `feat/f1-identity-mapping` | SUPERSEDED / OUTSIDE CRM | F1 v2 supersedes mapping; Maestri/Codex plan belongs to Nexus. |
| `feat/f3-rbac` | PARTIAL / AUTH-CONTRACT CONFLICT | PRs #20–24 merged only into this aggregator; see F3 security review below. ACL test cleanup was selectively ported. |
| `feat/maestri-engineering-council` | DUPLICATE | Preserve; open clean-council PR #11 is the active line. |
| `feat/meta-direct-social-login` | SUPERSEDED | No branch-only commits remain beyond `main`. |
| `fix/f4-j1-lint` | PARTIAL / SELECTIVELY INTEGRATED | Firebase error narrowing and auth-test typing ported; focused tests and CRM typecheck pass. |
| `fix/f5-task5-lint` | PARTIAL / SELECTIVELY INTEGRATED | Realtime mock typing ported without changing behavior; focused tests pass. |
| `fix/meta-provider-contracts` | SUPERSEDED / PARTIAL | Meta code paths match `main`; do not import old provider-router scaffold or behavior that drops inbox persistence. |
| `lumenva-command-center-blueprint-v2` | OUTSIDE CRM | Nexus/Command Center blueprint; preserve in source history. |
| `lumenva-local-runtime` | OUTSIDE CRM | Local Runtime belongs to Nexus; preserve. |
| `TOKENS` | OUTSIDE CRM | Context/token gateway belongs to Nexus; preserve. |
| `vps` | OUTSIDE CRM | Maestri V3/VPS belongs to Nexus; preserve. |

### F3 security branch — partial, not safe to merge wholesale

- `origin/feat/f3-rbac` has six commits ahead of `main` and a 37-path delta from its merge base. Twenty-four touched paths match current `main`; nine differ; four old paths are absent from current `main`.
- Its role-gate/admin changes switch Firebase identity checks to Supabase `auth.getUser()` and an `auth.uid()`-based RPC. Current `main` explicitly treats Firebase as auth authority and says Supabase `auth.uid()` cannot represent the Firebase session. Directly applying the F3 version risks breaking the F4 identity contract.
- The branch also carries an ACL migration under the old `supabase/` path, while current canonical layout moved Supabase files, plus an unrelated `patch_session_req.ts` artifact.
- Decision: classify as PARTIAL / AUTH-CONTRACT CONFLICT. Keep source and PR evidence archived. Do not merge these auth changes blindly. Useful remaining work: re-evaluate the ACL and human/agent role boundaries against current Firebase identity, map the migration to canonical infra, then validate on both auth paths.

## Merged PRs whose target was not `main`

- PR #26 `codex/mcg-ci-integration` merged into `lumenva-command-center`. Its target branch is closed/unmerged to `main`; preserve it with the Command Center/MCG history. Do not treat the PR as integrated into Lumenva CRM.
- PRs #20–24 merged into `feat/f3-rbac`, not `main`. Their branch code remains subject to the F3 security/auth-contract review above.

## Open PR content review — 2026-09-26

All 8 open PRs were reviewed individually by changed paths, descriptions, and current target. Open PRs and their source refs remain preserved; none was merged during this consolidation.

| PR | Content | Classification | Disposition |
|---|---|---|---|
| #11 `feat/maestri-engineering-council-clean` | 13 docs-only files for Maestri roles, Partitura and governance; draft | OUTSIDE CRM / MAESTRI OPERATIONS | Keep in its existing PR; do not absorb the Maestri control-plane docs into CRM. |
| #13 `voz` → `lumenva-command-center` | 59 files: Twilio/Asterisk voice notifications, CRM workers/routes and DB migrations; draft explicitly says “Não mergear” | ACTIVE / SEPARATE VOICE WORKSTREAM | Preserve on `voz`; not a branch-cleanup change. |
| #25 `vps-17455632840955604138` → `vps` | 2 files implementing Maestri M0–M4 session/recovery | OUTSIDE CRM / NEXUS | Preserve with Nexus/Maestri. |
| #40 `docs/jules-delegation-skill` | One 81-line Claude skill; docs-only; PR reports harness-check findings in AGENTS/CLAUDE | UNIQUE PROCESS DOC / OPEN | `verify` fails while invariants/vertical pass. Keep with PR; not needed for CRM code consolidation. |
| #50 `jules-f7-waha-adapter-7831325555235237843` | 5 files adding WAHA adapter, wiring and fake-based tests | UNIQUE PRODUCT FEATURE / OPEN DRAFT | `verify` and `verify-and-build` fail; invariants/vertical pass. Preserve isolated; no cherry-pick without diagnosing failures and review. |
| #66 `fix/f7-nuvemshop-webhook-fail-closed` | 5 files adding tenant/signing fail-closed checks and route tests; PR says local focused suite did not finish | SECURITY FIX / OPEN | `verify` and `verify-and-build` fail; CodeQL/invariants/vertical pass. Candidate for selective adoption only after failures are understood and current unified comparison passes. |
| #69 `chore/package-ci-tests` | 18 files adding `test:unit` to 14 packages; PR claims 118 existing tests become recursively discoverable | CI COVERAGE GAP / OPEN | `verify` and `verify-and-build` fail; invariants/vertical pass on a base 4 commits behind current main. Of its 18 changed paths, 14 were moved in the architecture refactor (mostly exact Git renames; two test files were similarity-renames), while 4 remain at the same path. Map scripts/tests to current paths before adoption; do not claim this coverage ran in current parity. |
| #71 `docs/f6-f7-f8-handoff-2026-09-24` | 5 docs/rules files; dated F6–F8 handoff, no product code | UNIQUE DOCS / OPEN | `verify` and `verify-and-build` fail; security scans/invariants/vertical pass. Keep with PR; do not copy an operational snapshot without validating currentness. |

Only #66 and #69 are candidates that could directly affect unified’s security behavior or canonical test coverage. Revisit them after the pinned Actions artifacts are available; if adopted, rerun parity on both sides using equivalent inputs. No PR was merged or closed by this review.

### Open-PR CI freshness

The open PR check results above are not canonical evidence against current `main`: their recorded base SHAs are stale. At review time, current `origin/main` is `3fbe74a3`; PR bases lag it by #11 47 commits, #13 35, #25 35, #40 27, #50 22, #66 5, #69 4, and #71 2. Thus failed `verify`/`verify-and-build` checks do not alone prove a new defect in current code. The PRs remain unmerged; their failures must be rerun on current bases before judging their implementation.

## Validation and changes

- Toolchain target: Node `22.23.3`, pnpm `9.15.9`.
- `pnpm repo:check`: passed locally on the isolated branch.
- CRM typecheck: passed after typing corrections.
- Focused tests: 4 files, 17 tests passed.
- CRM-only lint: 0 errors, 313 warnings. This command scope differs from the earlier root lint run; warning totals are not directly comparable.
- `node --check` for both parity scripts and `git diff --check`: passed.
- Selective cleanup commit: `227ac411` (`fix: apply selective F3-F5 lint and typing cleanups`).
- Parity-report hardening commits: `4f5808bf` (`ci: report test counts and classify unknown failures`) and `153e390fb3da06602c6b9ebb95ad75efe9a96a8d` (`ci: detect unit coverage regressions in parity report`).
- GitHub push reported 45 Dependabot alerts on the default branch (14 critical, 7 high, 24 moderate). This audit did not modify dependencies or security findings.

## GitHub Actions parity runs

- Workflow: `.github/workflows/branch-parity-validation.yml`.
- Runner: `windows-2025`; one immutable `main` SHA and one immutable `unified` SHA are pinned per run. Each suite runs main then unified on the same runner with the same exact Node/pnpm and frozen install. Unit, typecheck, lint, build, and toolchain suites run as separate parallel jobs.
- Raw logs, per-side JSON summaries, and comparison report are uploaded as artifacts. The report includes passed/failed/skipped tests, failure IDs, timeouts, worker errors, durations, and PREEXISTING/REGRESSION/UNKNOWN classifications.
- Run `36269336485`: superseded by a checker defect; cancelled.
- Run `36270379852`: pinned older comparator; terminal status `cancelled`. Do not use as canonical evidence.
- Run `36271881713`: immutable test comparison pins `main` `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` against `unified` `4f5808bf1c27225aa8ca28c23ce7d9a16444d877`. Only the report classifier changed afterward; no product/test code changed. As of 2026-09-26 21:30 UTC, unit is still running (~21 minutes); four other validation jobs succeeded.
- After raw artifacts are complete, dispatch read-only workflow `branch-parity-report.yml` on current `implementation/unified` to regenerate the canonical comparison using the stricter `153e390f` classifier without rerunning tests.
- Jules has not been used. No isolated regression has been confirmed.

## Pending proof

1. Wait for run `36271881713`; inspect the comparison artifact and raw logs.
2. If the report identifies a genuine isolated regression, investigate only that regression; use Jules only for that case.
3. Supplemental bundle is created and verified; do not delete any branch before reviewing Actions evidence and the final classification.
4. Update this report with exact Actions outcomes and final branch decisions.
5. Keep open PR branches and all recovery refs intact. No merge to `main` is authorized by this report.
