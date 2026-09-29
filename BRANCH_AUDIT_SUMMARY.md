# Frozen branch audit — first-pass reconciliation

Captured 2026-09-29. Every branch name and frozen SHA is in `BRANCH_RECONCILIATION_MANIFEST.md`. Findings below combine first-pass read-only audits and the current root verification. A `PRESERVE/UNRESOLVED` decision is not permission to discard. Current integration HEAD: `c1f9c2dbfbdfc3ef166c9b8e2de3030b41095bef`; the CRM-owned WAHA adapter was selectively ported (`3154e781`, `eb532b8f`); an earlier Nexus-owned Command Center/Local Runtime port was reversed in `675a2a00`. No whole source branch was merged. Final independent 63-ref audit is in progress.

## Root verification checkpoint — current candidate `c1f9c2db`

- **`backup/lumenva-command-center-pre-cleanup-2026-09-22` — PARTIAL, preserve; do not port whole commit.** Source commit `437a0f53` adds Meta OAuth start/callback/disconnect/reconnect routes, social-account data/sync, and Content OS accounts UI. Example source blobs: Facebook callback `db377ff9`, workspace binding `3f85db26`, accounts data `060a6682`, sync `1dc8182e`, UI `5a5e4f01`. Current HEAD lacks those files and schema. The frozen branch plus verified baseline bundle preserve the source for later recovery. The separate MFA deletions/rewrites in the same commit are not approved for porting.
  - **Security/schema blockers:** `supabase/migrations/20260920212000_social_connections.sql` (`436a5a9c`) creates `access_token_ciphertext`/`refresh_token_ciphertext`; `packages/social-brain/db/src/social/account-repository.ts` writes `access_token`/`refresh_token`. The encryption helper exists at `packages/social-brain/db/src/social/encryption.ts`, but this upsert path does not call it. The table policy compares a row's workspace ID to itself instead of binding it to the authenticated user's tenant. OAuth callbacks trust the workspace cookie after state validation and do not revalidate current membership. Migration files also use the legacy `supabase/migrations/` path rather than `infra/supabase/migrations/`. Do not expose these routes or run the migration until corrected and reviewed.
- **`voz` — DUPLICATE/SUPERSEDED, no useful delta confirmed.** Event route blob is identical (`ea30f65c`). Reminder route differs (`6e1479dc` source vs `4fb10711` HEAD) but both perform idempotency, rate limiting, and audit; HEAD checks idempotency before reserving budget and uses `createNotificationAckToken`. Current migrations are stronger equivalents: source `fc8f9f11` maps to `infra/supabase/migrations/20260927100000_0204_voice_notification_router.sql` (`31587110`), which adds a tenant-composite FK and explicit grants; source `da3d8eaf` maps to `infra/supabase/migrations/20260927110000_0205_notification_delivery_policy.sql` (`38a64d48`). HEAD retains reminder tests; its voice test (`01a57a53`) covers completion/retry beyond source test `10408f92`.
- **`fix/temp-test-cleanup` — DUPLICATE for CRM/core cleanup; PARTIAL only alongside governance gate.** `test-temp.ts` (`1c54425b`), its test (`40efa570`), and four core tests have identical blobs in source and HEAD. CRM harness test differs (`664323b2` source vs `8be887cb` HEAD); HEAD retains temp cleanup and adds the broader missing-cleanup guard. The only absent gate test (`tooling/agent-governance/gate.test.mjs`, `49e27c23`) belongs to the still-unapproved experimental governance gate, so it is not an independent missing cleanup fix.
- **`chore/package-ci-tests` — DUPLICATE, represented semantically.** Current root uses `pnpm -r --if-present --no-bail test:unit`; package scripts and fixture paths are adapted to the reorganized workspace. Source commits `4ce54bec`, `47c319c6`, `2f2d937e` add no confirmed useful delta.
- **`f8-j3-publish-workflow` — DUPLICATE/OBSOLETE for the relevant workflow.** Current E2E/publish workflow is more complete; source image helper is simulated and does not prove a live publish path. **`f8-j4-gcp-logging` — DUPLICATE:** current `packages/observability/gcp-logging` supersedes the weaker `any`-typed logger/redaction implementation.

These decisions are source/path reconciliations, not production approval. GitHub Actions runs from `ab5234aa` are stale for current candidate `675a2a00`.

## Additional F7 independent review — 2026-09-29

The independent Git comparison for frozen refs 37, 41, and 44 used exact source SHAs against current candidate paths and blobs:

- **Ref 37, `feat/f7-j4-nuvemshop-resend-adapters` (`f056c0f3`) — DUPLICATE/OBSOLETE.** Resend source and candidate blob match at `packages/integrations/resend/src/index.ts` (`d68928c26bf2`). Nuvemshop source adapter is superseded at the same path by the candidate's stricter URL/redirect checks (`97d8f9ffa53a` source vs `9af39bc67d32` candidate); its test also differs. No useful source-only behavior is missing.
- **Ref 41, `feature/f7-j3-meta-adapter` (`4beaf078`) — OBSOLETE/DUPLICATE.** Port and DI contracts are represented; the old `adapter.ts` and test weaken fail-closed token behavior and are not imported (`8c25844541e8` vs `8c46d726460b`; test `599d49dcc1ad` vs `5cc905dfc4a7`).
- **Ref 44, `fix/f7-nuvemshop-webhook-fail-closed` (`f21d50f8`, PR #66) — DUPLICATE/REPRESENTED.** All four current webhook handlers reject a missing tenant secret before RPC/effects; absent tenant is rejected. The test blob matches (`393d89efba21`). On decryption failure, candidate returns HTTP 500 rather than source HTTP 401 but still fails closed; this is not a lost security behavior.
- **Validation note:** these are static commit/tree/blob comparisons, not runtime claims. Current-SHA GitHub Actions remain the validation gate; no local heavy tests were run.

## `implementation/unified` independent review — 2026-09-29

Frozen source SHA `d6f36b074b94d10238d106ed26591b54212178b3` was compared with candidate `c1f9c2dbfbdfc3ef166c9b8e2de3030b41095bef`. The branch is three commits ahead of merge-base `f0965af5454fde3ec08f321e6de510d5f9f71263`, but it contributes no useful unique implementation missing from the candidate:

- `packages/core/social-brain/engineering-core/src/test-temp.ts` and `test-temp.test.ts` match candidate blobs `1c54425b92d7` and `40efa570871f`.
- The harness cleanup test differs (`c5a319925404` in source; `8be887cbdf84` in candidate); candidate additionally handles `t.after(...)` and is broader.
- Commit `082baf95eb9c587e2c969d70c98cd93675500510` reverses 99 paths (merge-base-to-tip: 2,831 insertions / 5,216 deletions), including workflows, notifications, voice, migrations and report docs. This is historical reversal, not additive work; do not replay it.
- Useful plan documents removed by that reversal remain in the candidate: `docs/plans/mover-pro-nexus/MOVER_PRO_NEXUS.md`, `docs/plans/v2.1/MASTER_BLUEPRINT_V2.1.md`, and `docs/plans/v2.2/MASTER_PLAN_V2.2.md`.

This is a static Git comparison; no tests were run. Source SHA remains preserved in the frozen refs and archive.

## Current-head CI finding — candidate `c1f9c2d`

GitHub Actions CI run `36538511186` failed six WAHA adapter unit cases. The shared cause was test setup attempting `Object.assign` to `baseUrl` and `apiKey`, which are read-only getters; no adapter behavior was exercised. The test fixture was corrected to mock `@/lib/env` without changing production code or assertions. This test-only correction is pending remote validation on the next pushed candidate SHA. Do not classify WAHA as validated or production-ready until that corrected-head Actions run passes.

Abbreviations: `I` = `integration/lumenva-complete` at initial tree `f46cdd4`; `M` = `main` at `3fbe74a`. “Candidate” means review/port only the listed useful slice, never merge the source branch wholesale.

## Branches 1–16

| # | Frozen branch | Classification | Preliminary decision / destination | Evidence and caveat |
|---:|---|---|---|---|
| 1 | `TOKENS` | NEXUS_OUT_OF_SCOPE | Exclude from Lumenva integration; preserve frozen ref/bundle for Nexus | Tip `3de6694`, 142 exclusive commits; frontier/workforce/cloud-fabric content belongs to Maestri/Nexus; no CRM-owned missing slice confirmed. |
| 2 | `backup/lumenva-command-center-pre-cleanup-2026-09-22` | PARTIAL + EXPERIMENTAL | PRESERVE/UNRESOLVED; compare useful paths to I | Tip `34c6b39`; commits `ed148778`, `437a0f53`, `34c6b398`; mixed Command Center plan, vendored MCG, auth/MFA, Meta, Social Brain, identity. |
| 3 | `chore/claude-harness-architecture` | PARTIAL | Candidate already represented via M; verify paths in I | Tip `b73f2c7`; `.claude/settings.json`, harness rules/commands/hooks; PR #73 merged, but auditor observed tree differences from I. |
| 4 | `chore/orchestration-gate` | PARTIAL | Candidate port to I after diff review | Tip `cec5d76`; `tooling/agent-governance/`, `docs/engineering/AGENT_GOVERNANCE.md`, workflows; PR #74 open; mixed temporary test fixture cleanup. |
| 5 | `chore/package-ci-tests` | PARTIAL | Candidate port minimal CI/test-fixture fix to I | Tip `2f2d937`; operating-core, social-brain/db, engineering-core test fixture resolution; PR #69 open, reported merge conflict. |
| 6 | `chore/update-testing-doctrine` | DUPLICATE candidate | Check current doctrine in I; do not replay blindly | Tip `f3c9e9f`; `.claude/rules/testing-verification.md`; PR #16 merged. |
| 7 | `chore/upstream-migrations-0347-0380` | DUPLICATE candidate | Preserve document if absent; verify against I | Tip `433a18d`; `docs/audits/upstream-migrations-0347-0380-2026-09-22.md`; PR #18 merged. |
| 8 | `chore/upstream-pull-01` | DUPLICATE candidate | Verify idempotency SQL/test in I before closure | Tip `e12710f`; `supabase/baseline.sql`, `apps/crm/tests/unit/baseline-unique-index-idempotency.test.mjs`; PR #14 merged. |
| 9 | `codex/mcg-ci-integration` | NEXUS_OUT_OF_SCOPE | Exclude MCG extraction/runtime; preserve frozen ref/bundle | Tip `cd975c8`; PR #26 belongs to the Command Center/MCG line, not CRM; no Lumenva CI delta confirmed. |
| 10 | `consolidation/lumenva-main-2026-09-27` | DUPLICATE | ALREADY represented: I starts at exact tip `f46cdd4` | Zero commits and tree delta versus I at frozen tip. |
| 11 | `docs/f6-f7-f8-handoff-2026-09-24` | PARTIAL | Candidate documentation slices to I; review mixed policy edits | Tip `a68f337`; F6–F8 handoff and model reference plus Git/security/testing rules; PR #71 open. |
| 12 | `docs/jules-delegation-skill` | NEXUS_OUT_OF_SCOPE / HISTORICAL | Do not activate in Lumenva; preserve frozen ref/bundle for Nexus review | Tip `0606b36`; Jules delegation belongs to the agent-orchestration project; SDK-specific content is versioned and unverified. |
| 13 | `f7-j6-adapter-matrix-18043191461025142301` | PARTIAL | Candidate contract docs/tests to I; skipped cases remain unvalidated | Tip `543b42d`; `docs/architecture/F7-ADAPTER-CONTRACTS.md`, `tests/invariants/f7-adapter-matrix.test.ts` with `it.skip`. |
| 14 | `f8-j3-publish-workflow-2470113440388419535` | PARTIAL / EXPERIMENTAL | PRESERVE/UNRESOLVED; inspect active vs `.disabled` workflow | Tip `4ab5443`; restores E2E and alters GCP publish workflow; mixed active/disabled files, no PR evidence. |
| 15 | `f8-j4-gcp-logging-16419022131821244108` | PARTIAL | Candidate logging/redaction slice; verify against merged PR #52 and I | Tip `c47a92f`; `packages/observability/gcp-logging/` and logger/redaction tests. |
| 16 | `feat/f1-identity-mapping` | EXPERIMENTAL / PARTIAL | Preserve; compare migration against F1 v2 and current schema | Tip `4994efe`; F1–F8 plan and Firebase/Supabase mapping migration `20260922100000_0198_identity_user_mappings.sql`; dual-read off by default. |

## Branches 17–32

| # | Frozen branch | Classification | Preliminary decision / destination | Evidence and caveat |
|---:|---|---|---|---|
| 17 | `feat/f1-identity-mapping-v2` | PRODUCTION_READY | ALREADY represented in M/I | Tip `97fec93`; PR #19 merged; migration `0202_f1_identity_mapping_v2.sql`, invariant test `f1-identity-mapping.test.ts`. |
| 18 | `feat/f2-tenant-isolation` | PRODUCTION_READY | ALREADY represented in M/I | Tip `982993c`; PR #15 merged; migrations `0200`/`0201`, tenant modules and F2 tests. |
| 19 | `feat/f3-rbac` | PARTIAL | ALREADY represented where merged; preserve unresolved auth-authority conflict | Tip `a9bc8f0`; F3 roles/ACL; Firebase authority differs from older Supabase `auth.uid()` guards. |
| 20 | `feat/f3-rbac-14201095918533104138` | DUPLICATE | ALREADY represented in M/I | Tip `40043c9`; PR #23; central role gates and duplicate-gate test. |
| 21 | `feat/f3-rbac-17111202584489541287` | PARTIAL | ALREADY represented for role gates; exclude temp helper | Tip `3c2e7d0`; media/WhatsApp gates; `patch_session_req.ts` is temporary. |
| 22 | `feat/f3-rbac-acl-audit-17806325391317863887` | PARTIAL | ALREADY represented for ACL; no blanket replay | Tip `bdde65a`; PR #22; `0203_f3_rbac_platform_admin_acl.sql` and invariant tests. |
| 23 | `feat/f3-task4-human-role-separation` | DUPLICATE | ALREADY represented in M/I | Tip `e30281a`; PR #24; human/actor distinction in role guard/types/MCP auth. |
| 24 | `feat/f3-task6-final-matrix` | PRODUCTION_READY | ALREADY represented in M/I | Tip `12a78eb`; PR #27; role/route matrix invariant tests and security verification doc. |
| 25 | `feat/f3-task-1-platform-admin-api-12582833702745023097` | PARTIAL | ALREADY represented for admin guard; inspect unrelated cleanup deltas | Tip `9741a0e`; PR #21; API-compatible guard, later collateral test/logger/followup changes. |
| 26 | `feat/f4-firebase-auth` | PRODUCTION_READY | ALREADY represented in M/I | Tip `8927802`; PR #33; Firebase login/session, identity bridge, CRM actions/routes and tests. |
| 27 | `feat/f4-firebase-auth-6584745336670343089` | DUPLICATE | ALREADY represented in M/I | Tip `2977ea1`; PR #32; Firebase auth/MFA actions included in completed F4 line. |
| 28 | `feat/f4-firebase-auth-8431202958264026743` | DUPLICATE | ALREADY represented in M/I | Tip `e66b72a`; PR #30; session/logout/middleware paths present. |
| 29 | `feat/f4-firebase-auth-api-routes-2853622509282931784` | DUPLICATE | ALREADY represented in M/I | Tip `2e73793`; PR #31; Firebase-backed API routes and route tests present. |
| 30 | `feat/f4-firebase-identity-bridge-5646239490154747231` | DUPLICATE | ALREADY represented in M/I | Tip `6e8856e`; PR #29; identity/admin bridge present in current auth modules. |
| 31 | `feat/f5-storage-realtime-7459603192977202492` | PRODUCTION_READY candidate | ALREADY represented; verify latest main tree | Tip `edac195`; GCS/SSE/realtime paths; F5 PRs #34–38 and later security fixes reported merged. |
| 32 | `feat/f5-task1-gcs-11165633749417281418` | DUPLICATE | ALREADY represented in M/I | Tip `8235b54`; PR #34; GCS adapter/tests. |

## Branches 33–48

| # | Frozen branch | Classification | Preliminary decision / destination | Evidence and caveat |
|---:|---|---|---|---|
| 33 | `feat/f5-task2-media-gcs-5082288770740349695` | PARTIAL | Candidate media-storage slice to I | Tip `1b93a35`; CRM contacts/conversations/cron/messages media paths; GCS commit `7ff1ff7` shared with other F5 refs. |
| 34 | `feat/f5-task4-sse-8705358404323605379` | PARTIAL | Candidate tenant-scoped SSE delta to I | Tip `6799470`; CRM realtime/token/event routes; overlapping but non-identical server implementation in F5 aggregate. |
| 35 | `feat/f5-task5-realtime-client-14073667979986859526` | PARTIAL | Candidate realtime client to I; dedupe shared server/GCS commits | Tip `195f689`; `apps/crm/hooks/realtime/`, realtime channel tests; shared GCS/SSE commit IDs. |
| 36 | `feat/f5-task-3-aux-storage-15945593050366616123` | PARTIAL | Candidate auxiliary-storage paths to I; dedupe shared commits | Tip `5cc7250`; agent-engine/AI/LGPD/MCP assets; shared GCS/SSE infrastructure commits. |
| 37 | `feat/f7-j4-nuvemshop-resend-adapters-17233514225075684717` | EXPERIMENTAL | PRESERVE/UNRESOLVED; do not port broad commit | Tip `f056c0f`; one 42-path/3,100-line commit mixes Nuvemshop/Resend/Stripe/Meta/GCP/Drizzle/workflows. |
| 38 | `feat/maestri-engineering-council` | NEXUS_OUT_OF_SCOPE | Exclude from Lumenva CRM; preserve frozen ref/bundle for Nexus | Tip `bb84cd0`; Maestri council roles/governance, not CRM feature code. |
| 39 | `feat/maestri-engineering-council-clean` | NEXUS_OUT_OF_SCOPE / DUPLICATE VARIANT | Exclude from Lumenva CRM; preserve frozen ref/bundle for Nexus | Tip `00b4405`; alternate council wording on the same Nexus-owned docs as #38. |
| 40 | `feat/meta-direct-social-login` | DUPLICATE | ALREADY represented; tip is ancestor of I/M | Tip `8bf5797`; zero commits exclusive to baseline. |
| 41 | `feature/f7-j3-meta-adapter-368541147442802420` | PARTIAL | Candidate Meta adapter fix; compare with broad F7 commit | Tip `4beaf07`; adapter/dependency/port modules and undefined-object regression test; equivalence unproven. |
| 42 | `fix/f4-j1-lint` | PARTIAL | Candidate Firebase test/mock fix; keep feature slice only if absent | Tip `2c52eb5`; login wrappers/components/dependency plus fetch mock fix; not lint-only. |
| 43 | `fix/f5-task5-lint` | PARTIAL | Candidate realtime mock-type fix; dedupe F5 shared commits | Tip `1dc7a3e`; GCS/SSE/realtime plus `f5-realtime-client.test.ts` mock safety fix. |
| 44 | `fix/f7-nuvemshop-webhook-fail-closed` | PARTIAL | Candidate security fix to I; validate tests in Actions | Tip `f21d50f`; four webhook routes reject missing tenant secrets; PR #66 open. |
| 45 | `fix/meta-provider-contracts` | PARTIAL | Candidate Meta contracts/dependency slice to I | Tip `82278f5`; `packages/integrations/meta/src/` and social-brain provider routing. |
| 46 | `fix/orphan-packages-workspace-11502432029800832518` | EXPERIMENTAL | PRESERVE/UNRESOLVED; do not accept skipped tests | Tip `0ca445d`; workspace/lock/test paths; commit message says skip known failing tests. |
| 47 | `fix/temp-test-cleanup` | PARTIAL | Candidate safe temp cleanup; preserve governance deltas pending review | Tip `a2f0fd1`; cleanup includes `engineering-core/src/test-temp.ts`; other commits alter governance/docs. |
| 48 | `implementation/unified` | PARTIAL | ALREADY represented for cleanup; candidate harness-guard delta | Tip `d6f36b0`; explicit revert `082baf95`, cleanup `84c87f73`, harness check test. |

## Branches 49–63

| # | Frozen branch | Classification | Preliminary decision / destination | Evidence and caveat |
|---:|---|---|---|---|
| 49 | `jules-auth-firebase-client-4940827573783815306` | DUPLICATE | ALREADY represented in M/I | Tip `a2705fa`; PR #28 merged; Firebase auth client/components/tests. |
| 50 | `jules-f7-waha-adapter-7831325555235237843` | PARTIAL | Candidate WAHA adapter to I; Actions failures mean not production-ready | Tip `7dd0a9f`; `apps/crm/lib/channels/adapters/waha/`; PR #50 open; verify and verify-and-build failed in reported checks. |
| 51 | `lumenva-command-center` | NEXUS_OUT_OF_SCOPE | Exclude from Lumenva integration; preserve frozen ref/bundle for Nexus | Tip `ec8b4e5`; plan defines an Agent OS with MCG kernel and Claude CEO/Codex CTO/Antigravity CIO; earlier candidate port was reverted in `675a2a00`. |
| 52 | `lumenva-command-center-blueprint-v2` | NEXUS_OUT_OF_SCOPE / EXPERIMENTAL | Exclude from Lumenva integration; preserve frozen ref/bundle for Nexus | Tip `eb56dcf`; Command Center blueprint is for the MCG/agent-orchestration product, not CRM. |
| 53 | `lumenva-local-runtime` | NEXUS_OUT_OF_SCOPE / EXPERIMENTAL | Exclude from Lumenva integration; preserve frozen ref/bundle for Nexus | Tip `339a19b`; Local Runtime contracts/daemon/executor are runtime infrastructure for the Command Center/MCG line. |
| 54 | `main` | PRODUCTION_READY baseline | ALREADY represented/ancestor of I | Frozen production SHA `3fbe74a`; verified by `git merge-base --is-ancestor origin/main integration/lumenva-complete`. |
| 55 | `mover-pro-nexus` | DUPLICATE | ALREADY represented; no delta | Tip `4dc7af2` is ancestor of I. |
| 56 | `recovery/lumenva-f7-j5-sentry-ratelimit-20260926` | OBSOLETE delta + preserved history | Do not port its deletion/reversal; retain ref/bundle | Tip `a762039`; removes 20 paths/1,506 net lines including F7 matrix, F6 shadow read and GCP scheduler. This is not deletion authorization. |
| 57 | `refactor/lumenva-clean-architecture` | DUPLICATE | ALREADY represented in M/I | Tip `6c2f606`; PR #72 merged; same tree across 1,230 touched paths per auditor. |
| 58 | `security/mcp-auth-rate-limit` | DUPLICATE | ALREADY represented in M/I | Tip `35a9436`; PR #17 merged; `apps/crm/lib/mcp/auth-rate-limit.ts` and tests; patch equivalent. |
| 59 | `v2.1` | DUPLICATE | ALREADY represented; zero delta | Tip `2e27b35` is ancestor of I. |
| 60 | `v2.2` | DUPLICATE | ALREADY represented; zero delta | Tip `6e18609` is ancestor of I. |
| 61 | `voz` | PARTIAL | Candidate CRM voice/notifications paths; exclude MCG-owned paths | Tip `c40cc4e`; `apps/crm/lib/voice/`, `apps/crm/lib/notifications/`, migrations; PR #13 open, verify failed in reported checks. Voice core represented, operational `ops/voice-asterisk/**` absent. |
| 62 | `vps` | NEXUS_OUT_OF_SCOPE | Preserve in bundle; do not port Maestri/MCG runtime to Lumenva | Tip `d04568d`; `apps/core/`, `packages/operating-core/`, Maestri workflows/scripts. |
| 63 | `vps-17455632840955604138` | NEXUS_OUT_OF_SCOPE | Preserve in bundle; do not port Maestri/MCG runtime to Lumenva | Tip `b43a5e0`; variant of `vps`, open PR #25; same ownership boundary. |

## Reconciliation caveats and next gate

- These are first-pass decisions, not final proof. Auditors used different local/API evidence levels; root must verify each destination and key content before changing manifest status from `PENDING`.
- “Commits exclusive” and differing patch IDs do not prove missing functionality: squash merges, cherry-picks, and reorganized trees can represent the same behavior.
- Preserve all unresolved and experimental source tips in the original bundle. A candidate marked “ALREADY represented” must be tied to a specific current integration commit/path before the final gate.
- Candidate operational voice settings may cause real phone activity; review credentials/defaults and disabled state before any port. Do not enable telephony.
- No tests were run for these audits. GitHub Actions remains the canonical validation environment for any integration wave.
