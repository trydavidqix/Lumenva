# Frozen Branch Reconciliation Manifest

**Repository:** `trydavidqix/Lumenva`  
**Captured:** 2026-09-29 via GitHub API `GET /repos/trydavidqix/Lumenva/branches` (paginated)  
**Source branches:** 63  
**Integration branch created after capture:** `integration/lumenva-complete` at `f46cdd4ddd2c4edc6ec57f266e97e8cb9f6a83ac`  
**Production main at capture:** `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`

This is the immutable audit baseline. If a remote branch moves later, preserve this original SHA and record its new SHA separately; do not silently replace the baseline. Per-branch classification/evidence fields remain pending until audited.

## Preliminary cross-branch archaeology — 2026-09-29

Not final branch classifications; four branch auditors still need to reconcile these leads commit by commit.

| Frozen source | Preliminary finding against integration start `f46cdd4` | Evidence / status |
|---|---|---|
| `voz` (`c40cc4e`), `vps` (`d04568d`), `vps-17455632840955604138` (`b43a5e0`) | Voice core is represented; candidate operational voice configs remain absent. The vps-174 branch includes vps content. | Core paths `apps/crm/lib/voice/**` and evidence doc exist in target. Candidate absent paths: `ops/voice-asterisk/**`. Core = likely DUPLICATE; ops config = candidate PARTIAL. Pending auditors/security review. |
| `TOKENS` (`3de6694`), `lumenva-local-runtime` (`339a19b`) | Same MCG workflow delta appears in both; workflow absent in target. | Candidate `.github/workflows/mcg.yml`; shared change identified as commit `2d801c66`. Candidate PARTIAL pending purpose/ownership check. |
| `lumenva-command-center` (`ec8b4e5`), `lumenva-command-center-blueprint-v2` (`eb56dcf`) | Dashboard/blueprint work has not been proven wholly integrated; do not infer from similar file paths. | Exact integration evidence pending branch auditors; retain unresolved until compared. |
| `feat/maestri-engineering-council` (`bb84cd0`) | Frozen object was unavailable in the archaeology checkout. | Preserve as unresolved; no equivalence inferred from `-clean`. |

No content from these preliminary leads has been ported. Do not use this table as archival/deletion authorization.

## Initial recovery bundle

- Bundle: `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\repository-branch-consolidation-final-2026-09-29-f46cdd4d.bundle`
- Verified with `git bundle verify`; every frozen branch had a matching `refs/remotes/origin/<branch>` name and SHA in the bundle (63/63, 0 missing, 0 SHA mismatches).
- Size: `81,262,385` bytes. SHA-256: `866652FD4D6BFDDAEEF6E7E5ADC27F6B96E3F98F75A6A63EDAFCF43BF783B447`.
- This is the pre-integration-content recovery checkpoint. A new final bundle must be made after all approved work is integrated; retain this baseline bundle.

| # | Remote branch | Frozen SHA | Status |
|---:|---|---|---|
| 1 | `TOKENS` | `3de66946d3d3555ef18f00abdf6c59ad1a16851d` | PENDING |
| 2 | `backup/lumenva-command-center-pre-cleanup-2026-09-22` | `34c6b398520f5a46a98edf0e1d74ad500cd104fb` | PENDING |
| 3 | `chore/claude-harness-architecture` | `b73f2c7a68b2c11e4f8ba9c3402efb70827f2288` | PENDING |
| 4 | `chore/orchestration-gate` | `cec5d7656fd341d29dfdf9de911cd2bb5564c6fd` | PENDING |
| 5 | `chore/package-ci-tests` | `2f2d937eb7583c3406ac9e64ff626955ccc7aa07` | PENDING |
| 6 | `chore/update-testing-doctrine` | `f3c9e9fcba4522930c71a3e9fe7102d466cc9f4c` | PENDING |
| 7 | `chore/upstream-migrations-0347-0380` | `433a18d6c6b4b477ad4914d7c8562c568af8baeb` | PENDING |
| 8 | `chore/upstream-pull-01` | `e12710f3b7583eefe86f7ee3a14ca9da4fbfb479` | PENDING |
| 9 | `codex/mcg-ci-integration` | `cd975c8d4a45a9d3d826393870896988d9029c0f` | PENDING |
| 10 | `consolidation/lumenva-main-2026-09-27` | `f46cdd4ddd2c4edc6ec57f266e97e8cb9f6a83ac` | PENDING |
| 11 | `docs/f6-f7-f8-handoff-2026-09-24` | `a68f337e9816aff7adb1ecfa47b459ad983f470f` | PENDING |
| 12 | `docs/jules-delegation-skill` | `0606b36b69c8c64f3ba97331e22a8fd83f6a0d15` | PENDING |
| 13 | `f7-j6-adapter-matrix-18043191461025142301` | `543b42df969df72731de9490fcb4b1478dd41854` | PENDING |
| 14 | `f8-j3-publish-workflow-2470113440388419535` | `4ab54434a6b1d3bbfe26b03e61b44be1e7fe4c81` | PENDING |
| 15 | `f8-j4-gcp-logging-16419022131821244108` | `c47a92fabce90777f9cabf76292f1ce449e59bc7` | PENDING |
| 16 | `feat/f1-identity-mapping` | `4994efe7a2280b3adec74d63f9ca997d56e4fe46` | PENDING |
| 17 | `feat/f1-identity-mapping-v2` | `97fec93f01d7826f1233a711ea402c69ec90589e` | PENDING |
| 18 | `feat/f2-tenant-isolation` | `982993c563470e824739995a8b5ab9133c16d2aa` | PENDING |
| 19 | `feat/f3-rbac` | `a9bc8f0b95a3debe20b314ab13379e62275e1efc` | PENDING |
| 20 | `feat/f3-rbac-14201095918533104138` | `40043c90e8d57f59e30a2dd8253c7818c80dc46f` | PENDING |
| 21 | `feat/f3-rbac-17111202584489541287` | `3c2e7d0e96f901928b955c46020248c286646f08` | PENDING |
| 22 | `feat/f3-rbac-acl-audit-17806325391317863887` | `bdde65a5ff10325fd14adba58c906e30fe745890` | PENDING |
| 23 | `feat/f3-task4-human-role-separation` | `e30281a5854464ee1392ae6d712e362f34d633bf` | PENDING |
| 24 | `feat/f3-task6-final-matrix` | `12a78eb59849446e3377aa600cf80381ebc510b5` | PENDING |
| 25 | `feat/f3-task-1-platform-admin-api-12582833702745023097` | `9741a0edc76455105612d97ec664aa1a1f7668f5` | PENDING |
| 26 | `feat/f4-firebase-auth` | `892780214517cb2a0a982be73e8f9eef7970c8bd` | PENDING |
| 27 | `feat/f4-firebase-auth-6584745336670343089` | `2977ea18fec99e4cf40e27ab81549c0e8961e752` | PENDING |
| 28 | `feat/f4-firebase-auth-8431202958264026743` | `e66b72a74a76cae3356ee744c3ae66ba0cedcc13` | PENDING |
| 29 | `feat/f4-firebase-auth-api-routes-2853622509282931784` | `2e7379313f2debf33b3750b51f97b2a3e484e335` | PENDING |
| 30 | `feat/f4-firebase-identity-bridge-5646239490154747231` | `6e8856eef51725a2c97eb9e8799d811029548cf7` | PENDING |
| 31 | `feat/f5-storage-realtime-7459603192977202492` | `edac195b5385d7e3d11e6d6d960b0266278686d5` | PENDING |
| 32 | `feat/f5-task1-gcs-11165633749417281418` | `8235b54853232e4fdaa2d1984ac93b56b2932f5b` | PENDING |
| 33 | `feat/f5-task2-media-gcs-5082288770740349695` | `1b93a359683ed84c6808e5371244e3dd0a56b786` | PENDING |
| 34 | `feat/f5-task4-sse-8705358404323605379` | `6799470d1cdb44ca09a0d45cae5f18be66e7debe` | PENDING |
| 35 | `feat/f5-task5-realtime-client-14073667979986859526` | `195f689722ab5a52a6c50e2cc1e0e3f862a827b3` | PENDING |
| 36 | `feat/f5-task-3-aux-storage-15945593050366616123` | `5cc7250a272c4aae2a3f2fc2c9e8bab61590b31b` | PENDING |
| 37 | `feat/f7-j4-nuvemshop-resend-adapters-17233514225075684717` | `f056c0f332ae571e4414a78347404cf7cf23f473` | PENDING |
| 38 | `feat/maestri-engineering-council` | `bb84cd0d3cb2d2b52c11371412354b8fed2e2c94` | PENDING |
| 39 | `feat/maestri-engineering-council-clean` | `00b44055a87e99a36ee1a5809ee8e9fda4361ff7` | PENDING |
| 40 | `feat/meta-direct-social-login` | `8bf5797f7c8f4b650011aa22c8bce9efa7e6b945` | PENDING |
| 41 | `feature/f7-j3-meta-adapter-368541147442802420` | `4beaf078a0621aa5e570e51ecf2213f5e1a414dd` | PENDING |
| 42 | `fix/f4-j1-lint` | `2c52eb5e7fb988b5126cb7ff1a611e7e9db3b514` | PENDING |
| 43 | `fix/f5-task5-lint` | `1dc7a3e9a804aec18d1198ce30e270369ed02538` | PENDING |
| 44 | `fix/f7-nuvemshop-webhook-fail-closed` | `f21d50f84928e18a0f30eded4ab4d4ed1491cd27` | PENDING |
| 45 | `fix/meta-provider-contracts` | `82278f5da24f452419b10dfa5cbfde530554aced` | PENDING |
| 46 | `fix/orphan-packages-workspace-11502432029800832518` | `0ca445d5110c174bd20713959f8d58d9d2d3000c` | PENDING |
| 47 | `fix/temp-test-cleanup` | `a2f0fd1f520c33447d94c568d0322e3345764491` | PENDING |
| 48 | `implementation/unified` | `d6f36b074b94d10238d106ed26591b54212178b3` | PENDING |
| 49 | `jules-auth-firebase-client-4940827573783815306` | `a2705fac048ee7bc05b287fee2202c651c19231a` | PENDING |
| 50 | `jules-f7-waha-adapter-7831325555235237843` | `7dd0a9f87420784dced2c1a40ded5133c6ac168c` | PENDING |
| 51 | `lumenva-command-center` | `ec8b4e5e886c06af9d6fd6fa764e57089ea61963` | PENDING |
| 52 | `lumenva-command-center-blueprint-v2` | `eb56dcf0a96203cb5d3e567ccdddcca5d69e2b05` | PENDING |
| 53 | `lumenva-local-runtime` | `339a19b49d1346bfb40fe09c8880b7b19513d04b` | PENDING |
| 54 | `main` | `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99` | PENDING |
| 55 | `mover-pro-nexus` | `4dc7af216c385dc429c85f203f4ffe75d642ef46` | PENDING |
| 56 | `recovery/lumenva-f7-j5-sentry-ratelimit-20260926` | `a7620393b9bb2b5b464d583fa0d7bfb9853f2a07` | PENDING |
| 57 | `refactor/lumenva-clean-architecture` | `6c2f606ffb5b2f89c22793a6943a3c237d7b2586` | PENDING |
| 58 | `security/mcp-auth-rate-limit` | `35a9436285ee17100c6d842ae08206f3a0ed8cc8` | PENDING |
| 59 | `v2.1` | `2e27b35db851c5e3d178e10d3e969d78d017a570` | PENDING |
| 60 | `v2.2` | `6e186096a2e2530bb1aa33f6f5a31b83a1dda899` | PENDING |
| 61 | `voz` | `c40cc4eca955384d504bcc710eec9cae7f77f76a` | PENDING |
| 62 | `vps` | `d04568d6db764dd60bb60bd6fefa6491997c2205` | PENDING |
| 63 | `vps-17455632840955604138` | `b43a5e0fc50f3a07645e80304c4174bd9f4d18fa` | PENDING |

## Snapshot controls

- All 63 rows are source refs that existed before creating the integration branch.
- No source ref has been deleted or rewritten.
- Final bundle and per-branch preservation proof will be appended after integration and before any cleanup request.

## Wave 1 — selected partial/experimental preservation

**Status:** locally integrated; candidate Actions still required. These are content decisions, not final branch dispositions.

| Frozen source(s) | Selected content in `integration/lumenva-complete` | Evidence | Boundary/status |
|---|---|---|---|
| `TOKENS` (`3de66946…`), `lumenva-command-center` (`ec8b4e5e…`), `lumenva-command-center-blueprint-v2` (`eb56dcf0…`), `lumenva-local-runtime` (`339a19b4…`) | Lumenva Core and Local Runtime prototypes, tests, READMEs and Command Center plans | `8a4d039844a02cf3c79c2159fe3203b9f810c831`; executable-path allowlist fix `a1b8360e72ae1f94849e0a262a62babdf922f836`; catalog/lockfile fix `fbcf2c2fd426f4c26064c263c78425982f387154` | `EXPERIMENTAL / PARTIAL`; not wired into apps; not a security boundary; all tests await Actions. MCG/Maestri runtime and Nexus-owned pieces remain excluded. |
| `jules-f7-waha-adapter-7831325555235237843` (`7dd0a9f8…`), `voz` (`c40cc4ec…`) | Standalone WAHA transport adapter and fake-based tests | `3154e781cae1380955964f1b8d9e4ad75349c754`; redirect denial and response-body redaction `eb532b8f36acfd2fbf3d6af33dd5961fd6fa21cb` | `EXPERIMENTAL / PARTIAL`; deliberately not wired as default and does not enable telephony. Existing voice core was already in the starting tree. Tests await Actions. |
| `lumenva-command-center` (`ec8b4e5e…`) | Exact frozen plan copy retained at `docs/archive/command-center/LUMENVA_COMMAND_CENTER_PLAN_SOURCE_2026-09-29.md` | Source blob `8df2f44512243a86851707b1f068e3e9d57261fa` equals archived file blob; README link added to the planning archive | Preserves omitted historical milestones; planning only, not an approved build specification. |

Baseline evidence: GitHub Actions run `36529426649` for starting candidate `f75d01210047a84f3da6f562cd9f8b5602dab504` completed with `verify=success` and `invariants=success`. This is not validation of Wave 1. No source refs were moved or deleted.
