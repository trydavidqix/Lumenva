# Frozen Branch Reconciliation Manifest

**Repository:** `trydavidqix/Lumenva`  
**Captured:** 2026-09-29 via GitHub API `GET /repos/trydavidqix/Lumenva/branches` (paginated)  
**Source branches:** 63  
**Integration branch created after capture:** `integration/lumenva-complete` at `f46cdd4ddd2c4edc6ec57f266e97e8cb9f6a83ac`  
**Production main at capture:** `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`

This is the immutable audit baseline. If a remote branch moves later, preserve this original SHA and record its new SHA separately; do not silently replace the baseline. The frozen SHAs below remain unchanged. Final classifications and destinations are being reconciled against integration HEAD `c1f9c2dbfbdfc3ef166c9b8e2de3030b41095bef`; `PENDING` does not authorize deletion.

## Historical preliminary cross-branch archaeology — 2026-09-29 (superseded by current matrix)

Not final branch classifications; four branch auditors still need to reconcile these leads commit by commit.

| Frozen source | Preliminary finding against integration start `f46cdd4` | Evidence / status |
|---|---|---|
| `voz` (`c40cc4e`), `vps` (`d04568d`), `vps-17455632840955604138` (`b43a5e0`) | Voice core is represented; candidate operational voice configs remain absent. The vps-174 branch includes vps content. | Core paths `apps/crm/lib/voice/**` and evidence doc exist in target. Candidate absent paths: `ops/voice-asterisk/**`. Core = likely DUPLICATE; ops config = candidate PARTIAL. Pending auditors/security review. |
| `TOKENS` (`3de6694`), `lumenva-local-runtime` (`339a19b`) | Same MCG workflow delta appears in both; workflow absent in target. | Candidate `.github/workflows/mcg.yml`; shared change identified as commit `2d801c66`. Candidate PARTIAL pending purpose/ownership check. |
| `lumenva-command-center` (`ec8b4e5`), `lumenva-command-center-blueprint-v2` (`eb56dcf`) | Dashboard/blueprint work has not been proven wholly integrated; do not infer from similar file paths. | Exact integration evidence pending branch auditors; retain unresolved until compared. |
| `feat/maestri-engineering-council` (`bb84cd0`) | Frozen object was unavailable in the archaeology checkout. | Preserve as unresolved; no equivalence inferred from `-clean`. |

This was a lead list captured against the initial tree, not a final decision. Later root review determined that the voice core has stronger equivalents, Maestri/MCG runtime and workflow material is Nexus-owned, and Command Center runtime content is out of scope. The separate Asterisk review found two outbound templates and two useful planning docs not yet represented; they are now preserved as experimental templates and archived historical docs. See the numbered frozen-ref matrix below for current dispositions. Do not use this historical table as archival/deletion authorization.

## Initial recovery bundle

- Bundle: `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-final-2026-09-29-f46cdd4d.bundle`
- Verified with `git bundle verify`; every frozen branch had a matching `refs/remotes/origin/<branch>` name and SHA in the bundle (63/63, 0 missing, 0 SHA mismatches).
- Size: `81,262,385` bytes. SHA-256: `866652FD4D6BFDDAEEF6E7E5ADC27F6B96E3F98F75A6A63EDAFCF43BF783B447`.
- This is the pre-integration-content recovery checkpoint. A new final bundle must be made after all approved work is integrated; retain this baseline bundle.

| # | Remote branch | Frozen SHA | Decision / preservation destination |
|---:|---|---|---|
| 1 | `TOKENS` | `3de66946d3d3555ef18f00abdf6c59ad1a16851d` | NEXUS_OUT_OF_SCOPE — frozen ref + baseline bundle; no Lumenva CRM delta confirmed. |
| 2 | `backup/lumenva-command-center-pre-cleanup-2026-09-22` | `34c6b398520f5a46a98edf0e1d74ad500cd104fb` | PARTIAL — source/bundle preserve Meta OAuth + social accounts; not activated due token-schema and tenant-RLS defects. Evidence in `BRANCH_AUDIT_SUMMARY.md`. |
| 3 | `chore/claude-harness-architecture` | `b73f2c7a68b2c11e4f8ba9c3402efb70827f2288` | DUPLICATE — PR #73 merged into main; repo harness/rules are inherited by integration. Source ref retained. |
| 4 | `chore/orchestration-gate` | `cec5d7656fd341d29dfdf9de911cd2bb5564c6fd` | PARTIAL/EXPERIMENTAL — preserve governance gate, schema, tests and policy docs in frozen source/bundle; do not activate because it can mutate Git/call Jules and PR #74 is blocked. |
| 5 | `chore/package-ci-tests` | `2f2d937eb7583c3406ac9e64ff626955ccc7aa07` | DUPLICATE — semantic behavior in root `package.json` and reorganized workspace paths; source/bundle retained. |
| 6 | `chore/update-testing-doctrine` | `f3c9e9fcba4522930c71a3e9fe7102d466cc9f4c` | DUPLICATE — testing doctrine is represented in current repo rules; PR #16 merged. Source ref retained. |
| 7 | `chore/upstream-migrations-0347-0380` | `433a18d6c6b4b477ad4914d7c8562c568af8baeb` | DUPLICATE — migration audit report is already part of repo history; PR #18 merged. Source ref retained. |
| 8 | `chore/upstream-pull-01` | `e12710f3b7583eefe86f7ee3a14ca9da4fbfb479` | DUPLICATE — baseline idempotency migration/test represented in current tree; PR #14 merged. Source ref retained. |
| 9 | `codex/mcg-ci-integration` | `cd975c8d4a45a9d3d826393870896988d9029c0f` | NEXUS_OUT_OF_SCOPE — MCG/Command Center integration; source/bundle retained. |
| 10 | `consolidation/lumenva-main-2026-09-27` | `f46cdd4ddd2c4edc6ec57f266e97e8cb9f6a83ac` | DUPLICATE — exact starting commit of integration; destination is this branch history. |
| 11 | `docs/f6-f7-f8-handoff-2026-09-24` | `a68f337e9816aff7adb1ecfa47b459ad983f470f` | PARTIAL/HISTORICAL — preserve dated handoff as non-normative source in bundle; active statuses are stale. |
| 12 | `docs/jules-delegation-skill` | `0606b36b69c8c64f3ba97331e22a8fd83f6a0d15` | NEXUS_OUT_OF_SCOPE/HISTORICAL — SDK/session delegation guidance belongs to Nexus; preserve source/bundle. |
| 13 | `f7-j6-adapter-matrix-18043191461025142301` | `543b42df969df72731de9490fcb4b1478dd41854` | DUPLICATE — contract doc blob `e2f4326a` and typed test behavior represented; source/bundle retained. |
| 14 | `f8-j3-publish-workflow-2470113440388419535` | `4ab54434a6b1d3bbfe26b03e61b44be1e7fe4c81` | DUPLICATE/OBSOLETE — current E2E/publish workflow supersedes; source/bundle retained. |
| 15 | `f8-j4-gcp-logging-16419022131821244108` | `c47a92fabce90777f9cabf76292f1ce449e59bc7` | DUPLICATE — current `packages/observability/gcp-logging`; source/bundle retained. |
| 16 | `feat/f1-identity-mapping` | `4994efe7a2280b3adec74d63f9ca997d56e4fe46` | SUPERSEDED — v1 migration `0198` replaced by F1 v2 migration `0202`; preserve old plan/ref in bundle. |
| 17 | `feat/f1-identity-mapping-v2` | `97fec93f01d7826f1233a711ea402c69ec90589e` | DUPLICATE/PRODUCTION_READY — migration `0202` and `f1-identity-mapping.test.ts` are inherited from main. |
| 18 | `feat/f2-tenant-isolation` | `982993c563470e824739995a8b5ab9133c16d2aa` | DUPLICATE/PRODUCTION_READY — migrations `0200`/`0201`, tenant modules and F2 tests are inherited from main. |
| 19 | `feat/f3-rbac` | `a9bc8f0b95a3debe20b314ab13379e62275e1efc` | PARTIAL — preserve source/bundle; older `auth.uid()` guards conflict with current Firebase identity authority. Do not port that conflicting variant. |
| 20 | `feat/f3-rbac-14201095918533104138` | `40043c90e8d57f59e30a2dd8253c7818c80dc46f` | DUPLICATE — central role gates and duplicate-gate test represented in main; source retained. |
| 21 | `feat/f3-rbac-17111202584489541287` | `3c2e7d0e96f901928b955c46020248c286646f08` | PARTIAL/DUPLICATE — CRM media/WhatsApp role gates represented; temporary `patch_session_req.ts` not promoted; source retained. |
| 22 | `feat/f3-rbac-acl-audit-17806325391317863887` | `bdde65a5ff10325fd14adba58c906e30fe745890` | DUPLICATE — migration `0203_f3_rbac_platform_admin_acl.sql` and invariant tests represented in main. |
| 23 | `feat/f3-task4-human-role-separation` | `e30281a5854464ee1392ae6d712e362f34d633bf` | DUPLICATE — human/actor distinction is present in role guards, types, and MCP auth. |
| 24 | `feat/f3-task6-final-matrix` | `12a78eb59849446e3377aa600cf80381ebc510b5` | DUPLICATE/PRODUCTION_READY — route/role matrix invariant tests and security evidence inherited from main. |
| 25 | `feat/f3-task-1-platform-admin-api-12582833702745023097` | `9741a0edc76455105612d97ec664aa1a1f7668f5` | PARTIAL/DUPLICATE — admin guard represented; unrelated cleanup/follow-up commits preserved in source bundle, not replayed wholesale. |
| 26 | `feat/f4-firebase-auth` | `892780214517cb2a0a982be73e8f9eef7970c8bd` | DUPLICATE/PRODUCTION_READY — Firebase login/session, identity bridge, actions, routes and tests inherited from main. |
| 27 | `feat/f4-firebase-auth-6584745336670343089` | `2977ea18fec99e4cf40e27ab81549c0e8961e752` | DUPLICATE — Firebase auth/MFA actions represented in main. |
| 28 | `feat/f4-firebase-auth-8431202958264026743` | `e66b72a74a76cae3356ee744c3ae66ba0cedcc13` | DUPLICATE — session/logout/middleware paths represented in main. |
| 29 | `feat/f4-firebase-auth-api-routes-2853622509282931784` | `2e7379313f2debf33b3750b51f97b2a3e484e335` | DUPLICATE — Firebase-backed API routes and route tests represented in main. |
| 30 | `feat/f4-firebase-identity-bridge-5646239490154747231` | `6e8856eef51725a2c97eb9e8799d811029548cf7` | DUPLICATE — identity/admin bridge represented by current auth modules. |
| 31 | `feat/f5-storage-realtime-7459603192977202492` | `edac195b5385d7e3d11e6d6d960b0266278686d5` | DUPLICATE/PRODUCTION_READY — GCS/media/SSE/realtime paths are represented in main; source/bundle retained. |
| 32 | `feat/f5-task1-gcs-11165633749417281418` | `8235b54853232e4fdaa2d1984ac93b56b2932f5b` | DUPLICATE — GCS adapter and tests represented in main. |
| 33 | `feat/f5-task2-media-gcs-5082288770740349695` | `1b93a359683ed84c6808e5371244e3dd0a56b786` | DUPLICATE — CRM media storage paths and shared GCS commit represented in main. |
| 34 | `feat/f5-task4-sse-8705358404323605379` | `6799470d1cdb44ca09a0d45cae5f18be66e7debe` | DUPLICATE/SUPERSEDED — tenant-scoped realtime route is represented with stronger current auth argument handling. |
| 35 | `feat/f5-task5-realtime-client-14073667979986859526` | `195f689722ab5a52a6c50e2cc1e0e3f862a827b3` | DUPLICATE — realtime client and tests represented; source mock-type delta is not a confirmed behavior fix. |
| 36 | `feat/f5-task-3-aux-storage-15945593050366616123` | `5cc7250a272c4aae2a3f2fc2c9e8bab61590b31b` | DUPLICATE — auxiliary storage/AI/LGPD/MCP shared changes are represented in main. |
| 37 | `feat/f7-j4-nuvemshop-resend-adapters-17233514225075684717` | `f056c0f332ae571e4414a78347404cf7cf23f473` | DUPLICATE / OBSOLETE — Resend adapter + tests represented (`packages/integrations/resend/src/index.ts`, blob `d68928c26bf2`); Nuvemshop source adapter is superseded by stricter current URL/redirect validation (`packages/integrations/nuvemshop/src/index.ts`, source/current blobs `97d8f9ffa53a` / `9af39bc67d32`). No missing useful behavior identified. Source SHA preserved in bundle. |
| 38 | `feat/maestri-engineering-council` | `bb84cd0d3cb2d2b52c11371412354b8fed2e2c94` | NEXUS_OUT_OF_SCOPE — Maestri council governance, not CRM; source/bundle retained. |
| 39 | `feat/maestri-engineering-council-clean` | `00b44055a87e99a36ee1a5809ee8e9fda4361ff7` | NEXUS_OUT_OF_SCOPE/DUPLICATE VARIANT — alternate council wording; source/bundle retained. |
| 40 | `feat/meta-direct-social-login` | `8bf5797f7c8f4b650011aa22c8bce9efa7e6b945` | DUPLICATE — tip is ancestor of integration/main; no unique tree delta. |
| 41 | `feature/f7-j3-meta-adapter-368541147442802420` | `4beaf078a0621aa5e570e51ecf2213f5e1a414dd` | OBSOLETE / DUPLICATE — Meta adapter and tests are represented at the same paths, but the source weakens fail-closed token handling (`adapter.ts`, source/current blobs `8c25844541e8` / `8c46d726460b`; test blobs `599d49dcc1ad` / `5cc905dfc4a7`). Port/DI contracts are represented with matching blobs. No source change imported. Source SHA preserved in bundle. |
| 42 | `fix/f4-j1-lint` | `2c52eb5e7fb988b5126cb7ff1a611e7e9db3b514` | DUPLICATE — Firebase component/auth fixes and mock behavior represented; source/bundle retained. |
| 43 | `fix/f5-task5-lint` | `1dc7a3e9a804aec18d1198ce30e270369ed02538` | DUPLICATE — realtime mock safety change not confirmed as missing behavior; F5 implementation represented. |
| 44 | `fix/f7-nuvemshop-webhook-fail-closed` | `f21d50f84928e18a0f30eded4ab4d4ed1491cd27` | DUPLICATE / REPRESENTED — missing-secret rejection before RPC/side effects and absent-tenant rejection are present in all four current Nuvemshop webhook handlers; PR #66 test blob matches source (`393d89efba21`). Current decryption failure returns 500 rather than source 401 but still rejects. Paths: `apps/crm/app/api/webhooks/nuvemshop/[event]/route.ts`, `customer-data-request`, `customer-redact`, `store-redact`. Source SHA preserved in bundle. |
| 45 | `fix/meta-provider-contracts` | `82278f5da24f452419b10dfa5cbfde530554aced` | DUPLICATE — Meta provider contracts/routing represented in current packages. |
| 46 | `fix/orphan-packages-workspace-11502432029800832518` | `0ca445d5110c174bd20713959f8d58d9d2d3000c` | EXPERIMENTAL/OBSOLETE — workspace cleanup comes with skipped known-failing tests; preserve source/bundle, do not accept test suppression. |
| 47 | `fix/temp-test-cleanup` | `a2f0fd1f520c33447d94c568d0322e3345764491` | DUPLICATE for cleanup; one gate test is coupled to unintegrated experimental governance; source/bundle retained. |
| 48 | `implementation/unified` | `d6f36b074b94d10238d106ed26591b54212178b3` | DUPLICATE / OBSOLETE — helper `withTempDir` and cleanup tests are already represented with matching blobs (`test-temp.ts` `1c54425b92d7`, `test-temp.test.ts` `40efa570871f`). Harness cleanup guard is superseded by the candidate's broader `t.after(...)` support (source `c5a319925404`, candidate `8be887cbdf84`). Commit `082baf95` is a broad 99-path reversal, not additive useful work; do not replay it. Source SHA preserved in bundle. |
| 49 | `jules-auth-firebase-client-4940827573783815306` | `a2705fac048ee7bc05b287fee2202c651c19231a` | DUPLICATE — Firebase client/components/tests represented in main; PR #28 merged. |
| 50 | `jules-f7-waha-adapter-7831325555235237843` | `7dd0a9f87420784dced2c1a40ded5133c6ac168c` | EXPERIMENTAL/PARTIAL — represented by commits `3154e781`/`eb532b8f` at `apps/crm/lib/channels/adapters/waha/`; standalone, not enabled as default. CI `36538511186` found six unit failures caused by test setup attempting to assign read-only getters; a test-only env mock fix is queued for remote validation. Not production-ready until corrected-head Actions pass. |
| 51 | `lumenva-command-center` | `ec8b4e5e886c06af9d6fd6fa764e57089ea61963` | PARTIAL / DUPLICATE / NEXUS_OUT_OF_SCOPE — CRM overview is represented at `apps/crm/lib/command-center/overview-state*`; Agent OS/MCG runtime is Nexus-owned; Meta webhook alias is duplicate. Source SHA preserved in bundle. |
| 52 | `lumenva-command-center-blueprint-v2` | `eb56dcf0a96203cb5d3e567ccdddcca5d69e2b05` | NEXUS_OUT_OF_SCOPE — standalone Agent OS blueprint; source/bundle retained. |
| 53 | `lumenva-local-runtime` | `339a19b49d1346bfb40fe09c8880b7b19513d04b` | NEXUS_OUT_OF_SCOPE — Maestri/MCG runtime; source/bundle retained. |
| 54 | `main` | `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` | PRODUCTION_READY — canonical base; `origin/main` is ancestor of integration. |
| 55 | `mover-pro-nexus` | `4dc7af216c385dc429c85f203f4ffe75d642ef46` | DUPLICATE/NEXUS_OUT_OF_SCOPE — no independent Lumenva delta; source/bundle retained. |
| 56 | `recovery/lumenva-f7-j5-sentry-ratelimit-20260926` | `a7620393b9bb2b5b464d583fa0d7bfb9853f2a07` | OBSOLETE DELTA/HISTORY PRESERVED — tip reverses 20 earlier files; do not replay deletion. Keep exact source tip in bundle. |
| 57 | `refactor/lumenva-clean-architecture` | `6c2f606ffb5b2f89c22793a6943a3c237d7b2586` | DUPLICATE — PR #72 merged; reorganized tree is already in main/integration. |
| 58 | `security/mcp-auth-rate-limit` | `35a9436285ee17100c6d842ae08206f3a0ed8cc8` | DUPLICATE/PRODUCTION_READY — auth rate-limit module and tests inherited from main; PR #17 merged. |
| 59 | `v2.1` | `2e27b35db851c5e3d178e10d3e969d78d017a570` | DUPLICATE — ancestor of integration; no unique tree delta. |
| 60 | `v2.2` | `6e186096a2e2530bb1aa33f6f5a31b83a1dda899` | DUPLICATE — ancestor of integration; no unique tree delta. |
| 61 | `voz` | `c40cc4eca955384d504bcc710eec9cae7f77f76a` | PARTIAL / EXPERIMENTAL / DUPLICATE — voice core and 18 Asterisk deployment blobs are represented; two inbound templates are superseded. Two outbound disabled templates are preserved under `infra/deployment/voice-asterisk/experimental/`; the source plan and runbook are preserved under `docs/archive/voice/voz/` with historical/no-deploy warnings. Nothing is live-enabled or production-validated. Source commits `b929b5b6`, `19b7f74d`, `5473f97e`, and `245f937b`; source ref retained. |
| 62 | `vps` | `d04568d6db764dd60bb60bd6fefa6491997c2205` | NEXUS_OUT_OF_SCOPE — Maestri/MCG runtime; source/bundle retained. |
| 63 | `vps-17455632840955604138` | `b43a5e0fc50f3a07645e80304c4174bd9f4d18fa` | NEXUS_OUT_OF_SCOPE — vps execution variant; source/bundle retained. |

## Snapshot controls

- All 63 rows are source refs that existed before creating the integration branch.
- No source ref has been deleted or rewritten.
- Remote verification on 2026-09-29: all 63 frozen branch names still exist at their exact frozen SHAs (0 missing, 0 mismatches). `origin` currently has 64 heads because it also contains `integration/lumenva-complete`; production `main` remains `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`.
- Final bundle and per-branch preservation proof will be appended after integration and before any cleanup request.

## Current selected content — provisional, as of integration HEAD `c1f9c2dbfbdfc3ef166c9b8e2de3030b41095bef`

**Status:** WAHA adapter is present but remains isolated and not enabled by default; Command Center/Local Runtime prototype has been reverted as Nexus-owned. Current-SHA CI/parity/E2E runs are in progress. These are content decisions, not final branch dispositions.

| Frozen source(s) | Selected content in `integration/lumenva-complete` | Evidence | Boundary/status |
|---|---|---|---|
| `lumenva-command-center` (`ec8b4e5e…`), `lumenva-command-center-blueprint-v2` (`eb56dcf0…`), `lumenva-local-runtime` (`339a19b4…`), `TOKENS` (`3de66946…`) | No prototype/runtime code retained in Lumenva integration. Source refs and baseline bundle preserve it. | Source plan `docs/LUMENVA_COMMAND_CENTER_PLAN.md` identifies Agent OS, MCG context kernel, Claude CEO, Codex CTO, Antigravity CIO; reversal commit `675a2a00` removes the candidate port. | `NEXUS_OUT_OF_SCOPE`; no migration into Nexus is performed by this Lumenva task. |
| `jules-f7-waha-adapter-7831325555235237843` (`7dd0a9f8…`) | Standalone WAHA adapter, types, README and fake-based tests | Commits `3154e781` and `eb532b8f`; current paths `apps/crm/lib/channels/adapters/waha/{adapter.ts,types.ts,adapter.test.ts,README.md}`. CI found a test fixture bug; test now mocks env instead of assigning readonly getters. | `EXPERIMENTAL / PARTIAL`; not wired as default; does not enable telephony. Corrected-head GitHub Actions validation is still required before production classification. |
| `voz` (`c40cc4ec…`) | 18 Asterisk deployment blobs duplicate canonical files; two disabled outbound examples plus plan/runbook have unique useful content | Outbound config source commits `b929b5b6`, `19b7f74d`; docs `5473f97e`, `245f937b`; preserved under `infra/deployment/voice-asterisk/experimental/` and `docs/archive/voice/voz/` | `PARTIAL / EXPERIMENTAL`; templates remain disabled; archived docs are explicitly non-canonical. No live call validation or production activation. |

Baseline evidence: GitHub Actions run `36529426649` for starting candidate `f75d01210047a84f3da6f562cd9f8b5602dab504` completed with `verify=success` and `invariants=success`. It does not validate current HEAD. No source refs were moved or deleted.
