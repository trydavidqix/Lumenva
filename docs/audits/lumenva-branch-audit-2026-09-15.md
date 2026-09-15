---
title: Lumenva branch audit
audited_at: 2026-09-15T03:45:00+01:00
base: origin/main@fec2d25348d357e9091c2d5e11fbfd7ee7428
status: reconstructed-and-versioned
---

# Lumenva — branch audit (2026-09-15)

## Scope and evidence

This audit was recreated after the temporary worktree containing the previous copy was lost. GitHub is the versioned source of truth; `main` is read-only during implementation. The snapshot below was produced from the commands shown here and committed with this document.

Commands executed:

```bash
git ls-remote --heads origin
git for-each-ref --format='%(refname:short)\\t%(objectname)\\t%(committerdate:iso-strict)\\t%(subject)' refs/heads refs/remotes/origin
git rev-parse origin/main
git status --short --branch
```

Results:

- Remote heads observed: **153**.
- Local implementation branches in the isolated clone: **3**.
- `origin/main`: `fec2d25348d357e9091c2d5e11fbfd7ee7428`, merge commit dated 2026-09-15.
- Audit base SHA `fec2d253`: present and matches `origin/main`.
- Working tree note: `docs/Current-State.md` is pre-existing and modified outside this task; it is excluded from all implementation commits.

## Classification rules

- **M — mechanical:** documentation, configuration, inventory, wiring, or deterministic migration with no product-policy choice.
- **P — product:** customer-facing behavior, UX, pricing, copy, or owner policy.
- **F — foundation:** security, tenancy, persistence, runtime, CI, or deployment invariant.

A branch is not integrated merely because it exists. Each candidate must be compared against current `main`, tested in its own worktree, reviewed through the required `sr-*` chain, and only then presented for owner-controlled integration.

## Branch inventory and triage

| Group | Count | Default treatment |
|---|---:|---|
| `audit` | 1 | inventory only; classify by diff and acceptance evidence |
| `automation` | 1 | inventory only; classify by diff and acceptance evidence |
| `business-os` | 32 | inventory only; classify by diff and acceptance evidence |
| `ci` | 1 | inventory only; classify by diff and acceptance evidence |
| `design` | 1 | inventory only; classify by diff and acceptance evidence |
| `docs` | 3 | inventory only; classify by diff and acceptance evidence |
| `f5` | 34 | inventory only; classify by diff and acceptance evidence |
| `f6` | 11 | inventory only; classify by diff and acceptance evidence |
| `feat` | 5 | inventory only; classify by diff and acceptance evidence |
| `feature` | 1 | inventory only; classify by diff and acceptance evidence |
| `fix` | 3 | inventory only; classify by diff and acceptance evidence |
| `implementation` | 1 | inventory only; classify by diff and acceptance evidence |
| `integration` | 2 | inventory only; classify by diff and acceptance evidence |
| `knowledge-os` | 3 | inventory only; classify by diff and acceptance evidence |
| `memory-kernel` | 1 | inventory only; classify by diff and acceptance evidence |
| `migration` | 2 | inventory only; classify by diff and acceptance evidence |
| `mvp` | 2 | inventory only; classify by diff and acceptance evidence |
| `plan` | 4 | inventory only; classify by diff and acceptance evidence |
| `psycheos` | 1 | inventory only; classify by diff and acceptance evidence |
| `qa` | 7 | inventory only; classify by diff and acceptance evidence |
| `refactor` | 2 | inventory only; classify by diff and acceptance evidence |
| `rescue` | 3 | inventory only; classify by diff and acceptance evidence |
| `research` | 1 | inventory only; classify by diff and acceptance evidence |
| `root` | 11 | inventory only; classify by diff and acceptance evidence |
| `validation` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave1` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave10` | 5 | inventory only; classify by diff and acceptance evidence |
| `wave11` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave12` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave13` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave14-15` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave15` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave2` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave3` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave4` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave5` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave6` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave7-8` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave8` | 1 | inventory only; classify by diff and acceptance evidence |
| `wave9` | 1 | inventory only; classify by diff and acceptance evidence |

### Immediate triage

- **Keep as integration base:** `main` at `fec2d253`.
- **Documentation/planning candidates:** `plan/*`, `docs/*`, and `audit/*`; read-only inputs until their requirements are represented here.
- **Implementation candidates:** `wave*/*`, `f*/*`, `business-os/*`, `integration/*`, and `migration/*`; no automatic merge. Compare each to `main` and preserve only tested, non-overlapping slices.
- **Refactor candidates:** `refactor/*`; require rename compatibility checks and no breaking public identifiers.
- **Validation/QA candidates:** `qa/*`, `validation/*`, and `rescue/*`; use as evidence or tests, not as deployment bases.
- **Do not use:** `DO-NOT-USE-temp`, duplicate/copy branches, and WIP refs whose commit is a preservation snapshot; retain for forensic reference only.
- **Owner decision required:** production cutover, deleting stale remote branches, integrating any branch into `main`, provider/account choices, and public pricing/copy.

## Known baseline findings

1. The root is a pnpm workspace without a root `package.json`; CI commands must explicitly target `lumenva-crm`. Stage 1 corrected this in commit `1a5a54fb`.
2. Runtime and deployment files contain both legacy DeskcommCRM names and Lumenva-compatible files. Rename work must remain additive/compatible until the owner authorizes a breaking cutover.
3. The project has explicit multi-tenant, RLS, audit, API envelope, UUID, UTC, money, and idempotency conventions. They are acceptance gates, not optional cleanup.
4. Full TypeScript/lint/unit verification is delegated to Codex Cloud when this sandbox cannot resolve npm packages; every affected stage records the exact command.
5. The requested 2026-09-15 source audit/plan were absent from all refs before this commit; this document and the plan below remove that ephemeral dependency.

## Cross-cutting acceptance gates

Codex Cloud must run, from the repository root and the implementation branch:

```bash
pnpm install --frozen-lockfile
pnpm --filter lumenva-crm typecheck
pnpm --filter lumenva-crm lint
pnpm --filter lumenva-crm lint:channels
pnpm --filter lumenva-crm test:harness
pnpm --filter lumenva-crm harness:check
pnpm --filter lumenva-crm test:unit
pnpm --filter lumenva-crm test:shell
pnpm --filter lumenva-crm test:db
```

No stage is complete from static checks alone if its runtime or database acceptance command has not run successfully in Codex Cloud.

## Full remote snapshot

The following is the exact `git ls-remote --heads origin` snapshot used for this audit:

- `DO-NOT-USE-temp` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `audit/vps-rightsizing-2026-09-08` — `7ee9c968005aae3a6f68e1013db30a626bf20b7e`
- `automation/lumenva-identity-trigger-2026-09-14` — `73d1ed20c778ac9a27e7c47562f4e035d463de4b`
- `business-os/bronze-stripe-checkout-security-fix-2026-09-13` — `bc07b276d3c3d59896203a0b3a4888d708e79017`
- `business-os/phase-0-audit` — `cc660e3c05c216aecd3f53a5ada170d688a0751c`
- `business-os/phase-0-audit-docs-2026-09-11` — `636eb5249964f0cb9d62a2a58f64262ae11ca915`
- `business-os/phase-1-baseline-reconcile-2026-09-11` — `a668de6d67d0d503d76a6784bd4851583f164b1b`
- `business-os/phase-1-cli-2026-09-11` — `62681f15366a8702b515ebf833193ca67ba74399`
- `business-os/phase-1-cli-esm-2026-09-11` — `e7c8f207e5e8458a5a91cdeb1aa4b1aed9f22d27`
- `business-os/phase-1-entitlements` — `c1554172f84b7e73fad4818cfc7bed7d4c793a9a`
- `business-os/phase-1-entitlements-bigorna-2026-09-11` — `27a796451e8e2febd2b100838abd783ae1301d6e`
- `business-os/phase-1-entitlements-bronze-2026-09-11` — `53c30dbef0486a27f6acfb3cf838f40de13ceccf`
- `business-os/phase-1-entitlements-torno-2026-09-11` — `70ca77d1ea9f9ae485585fc8fc151029a0c81823`
- `business-os/phase-1-http-2026-09-11` — `96230c21b335fbc5e52d8d41d8014cc7979ab122`
- `business-os/phase-1-mcp-2026-09-11` — `985b0a3c88167f36ac2ca4352a620696577b9cfc`
- `business-os/phase-1-migrate-fix-2026-09-11` — `ad6a6191bed00a291dc437ffa430f70ab0c89987`
- `business-os/phase-1-reconcile-2026-09-11` — `d7cdca7bb0e25894cb349c55e9c62685efcb2369`
- `business-os/phase-3-contract-security-2026-09-12` — `02a9b806f322732213871755c50b434f0cfa191b`
- `business-os/phase-3-stripe-security-2026-09-12` — `babb6bfdba36d356c96bddb97b3c70e96a100332`
- `business-os/wave-1-acceptance-2026-09-11` — `341b51a0b118b0bcda1ed92785d143de5744df81`
- `business-os/wave-1-agent-contracts-2026-09-11` — `08ec4648cbd9f93327ba1ed0443430672222d4f4`
- `business-os/wave-1-event-adapter-2026-09-11` — `344d01110a32668d91e5ae9a65d24351d0e0b9ea`
- `business-os/wave-1-job-engine-events-2026-09-11` — `e046e0557abd4fb4cb222d6569e82dca1fdf70f6`
- `business-os/wave-1-mcp-surface-2026-09-11` — `86e71bda74a607b54e62799f5d93a8b368e40e5a`
- `business-os/wave-1-operating-core` — `e059f87fe30a35c2e223ff2a9be650f6a0ba79e0`
- `business-os/wave-1-operating-core-cli-2026-09-11` — `c8a79ff33e8d1f5f5602cd10153ba3cc8feaab3e`
- `business-os/wave-1-operating-core-equivalence-2026-09-11` — `0da8cfbb199a653ba40200ae70791100107a463d`
- `business-os/wave-1-operating-core-evidence-2026-09-11` — `ef243de4238294c377a3d4bf4f3d023e89263292`
- `business-os/wave-1-policy-edges-2026-09-11` — `217a5a64feaded24a5e48c5df2ff4b5768505221`
- `business-os/wave-2-agent-birth-2026-09-11` — `5d001358a14ccfa3e3a6a40a93422be9f0a58e72`
- `business-os/wave-2-agent-birth-prompt` — `6bcf4ae79777031d372f587cd64fb049618d5f3d`
- `business-os/wave-2-agent-migration-2026-09-11` — `79bdbfd2859755cce49cc8c4cb1c0a026fad61af`
- `business-os/wave-2-certification-2026-09-11` — `11a3f47c72776e9cc88cf31e33b2c10d97973312`
- `business-os/wave-3-session-runtime` — `12aee3bd24ba49d0aab1c4f3d78ab398139f58a3`
- `business-os/wave-3-session-runtime-mvp-2026-09-11` — `b72d8486eca03148e2d78500b39b8501ba645124`
- `ci/add-workflow-dispatch-2026-09-15` — `f442f6f8d2c75066dbe09ae1a8e4daf983bfa4c8`
- `design/hermes-unified-learning-os-2026-09-13` — `fcda37d63c70e372b1dfe6682e161fbfef8ad761`
- `docs/business-os-plan-2026-09-11` — `fc7389db7b7d39a66f19be75d09db172d1f73240`
- `docs/monorepo-plan-2026-09-09` — `f547a5c4358ad9ce0bfd4c487d36032811bbdd1b`
- `docs/veredito-autoridade-2026-09-14` — `bf2c345f6370485e7779c7b4f759f66e78e2f932`
- `f5/audit-admin-403-2026-09-10` — `8aa9a6e0fbdb7100bcbe44a55ca8eba9e1c5472b`
- `f5/audit-settings-gaps-2026-09-10` — `f0f51dba47425ff01ec2130f3d12b9a25a7ac61f`
- `f5/audit-settings-ui-api-2026-09-10` — `37df205f35146d9116f22a9a940b9c1105259b6e`
- `f5/autonomy-001-2026-09-10` — `b0b6cb69f57be91bac09db57e2b70985d8de4a17`
- `f5/customer-360-001-2026-09-10` — `9cbd130222b5f6ce17cf2ed65d6face66af585d2`
- `f5/customer-360-002-2026-09-10` — `cf44e2aad1ca07c3708e21ef0a3751a7b2f5339c`
- `f5/customer-360-002-v2-2026-09-10` — `929c6c7390b3c5ef3a7d6d74c0131b420d4c2038`
- `f5/customer-360-merge-001-2026-09-10` — `b32efedeb9021484a3887cc3c0ae8c8aa0f73d35`
- `f5/customer-360-merge-001-2026-09-10-v2` — `b7029aa9008b5f9e727a0d39298e198222f60675`
- `f5/customer-360-merge-2026-09-10` — `1507b1558c922a871d15f4ee6fb110be5ff7e0cf`
- `f5/customer360-contacts-ui-2026-09-10` — `9e9bb8c8dc7880a5891e70160acf7a6d97c2a4b8`
- `f5/customer360-export-undo-2026-09-10` — `b571c6a2a7d84b1fc35ce0824f61f9edf557d23c`
- `f5/customer360-integrity-tests-2026-09-10` — `b8f6b5781607f88734d046ae7158568445592a9f`
- `f5/customer360-lgpd-2026-09-10` — `f5d8c82451b535ec2683ab33d0763d3542984fc9`
- `f5/customer360-merge-followup-2026-09-10` — `14d4af1c9c556d2b4d63e74e4ebf5761360e0b0e`
- `f5/customer360-merge-hooks-2026-09-10` — `5b83f535c89a5cb75106fc7fa9bb4bdd2e3eea94`
- `f5/customer360-merge-qa-2026-09-10` — `0717a279bf2ce7f19cb107c614f7a97e5b68f85c`
- `f5/customer360-merge-queue-realtime-2026-09-10` — `09b407610abbbfd93871d30bafdc736f91b9f805`
- `f5/customer360-merge-queue-ui-2026-09-10` — `c3dc712f1031153ddf270f9f501c3a4bb32d7035`
- `f5/customer360-rls-atomicity-003-2026-09-10` — `af142363ac8044b208ee620a57854cd27edc75f5`
- `f5/customer360-rls-transaction-2026-09-10` — `b7f7f0d4d4b54c6203d2be85a8e12c1907317f26`
- `f5/customer360-security-2026-09-10` — `b32efedeb9021484a3887cc3c0ae8c8aa0f73d35`
- `f5/customer360-security-qa-2026-09-10` — `b9556ddc4dbc40f5e2680fb6c82c331f3c9c6231`
- `f5/customer360-security-v2-2026-09-10` — `96c2f9287d4ec0386214d37220fa44ac2ebb4bcc`
- `f5/customer360-timeline-2026-09-10` — `10f7412e848ab574f1533a8c8852e41e1c161fd8`
- `f5/customer360-timeline-ui-2026-09-10` — `fd0592c5fcd5574cd9b8de6989786fbb5abca194`
- `f5/gate-config-2026-09-10` — `c2e6c7bdf5cdc5198e79121f3db898ba2ea51e6a`
- `f5/gate-diagnosis-2026-09-10` — `fe71bde83b24004b28e972ae105fd5c8df2b7b14`
- `f5/sidebar-queryclient-testfix-2026-09-10` — `0e4bc55ae9f62e5facd3a43ef142d7a7b1e5a75b`
- `f5/task-02-2026-09-10` — `ce135901c652fb802415c21fc03fe0784796f0b4`
- `f5/team-audit-settings-004-2026-09-10` — `58e15dac55a4e2812218f39cef4afb7c898ad594`
- `f5/team-audit-settings-004-af142-2026-09-10` — `3d3ca57a0332f171c059ff3c2a4f46ac0969a06e`
- `f5/team-settings-role-revoke-2026-09-10` — `bc08cca88f7fee4a9e15de16d6c3f22d27f3a7c2`
- `f5/team-settings-role-revoke-be452-2026-09-10` — `df0fb166507d598b01df7fd4ebcceff7d0dadf93`
- `f6-lgpd-export-2026-09-10` — `e770c2e1a638fff60715d5fd79410af50586e06e`
- `f6/lgpd-audit-event-2026-09-10` — `32291b989fd7fff193f53868e237e7ecde376f45`
- `f6/lgpd-download-2026-09-10` — `160bf7608c59603d6b73eea08a4e1d4a9416c9cd`
- `f6/lgpd-e2e-final-2026-09-10` — `6e826adba2953d677a0de45cc44937e629c4af95`
- `f6/lgpd-export-zip-2026-09-10` — `96041e07af4cb66d341674169fda51aa1de96f00`
- `f6/lgpd-pades-verify-2026-09-10` — `ad767bfcac0fe5502bb8a36bb343126e20bdb0ff`
- `f6/lgpd-pdf-provenance-2026-09-10` — `0a6c9713b4cef8abc1ddf34f357de6f8733e6e72`
- `f6/lgpd-pii-retention-2026-09-10` — `9dde81dbeb516ebba82c64c4ac4a8d2c87d07bd2`
- `f6/lgpd-zip-manifest-2026-09-10` — `706caf3ef45d482165fb6fb0ca55c5ab35102a33`
- `f6/lgpd-zip-manifest-549-2026-09-10` — `3626d2555af46833f9206223a94ffe5c34d9fa98`
- `f6/pades-scaffold-2026-09-10` — `ed4a52522a68521b85980a4aa7fb3f9dba8e436a`
- `f6/pades-scaffold-v2-2026-09-10` — `ac1a809183e3178a2ad04fcd88b9c03665ee9ccb`
- `feat/stripe-catalog-2026-09-12` — `b7bc3bfab2997286eda7f0942d1e6bdc2941013a`
- `feat/stripe-checkout-2026-09-12` — `a96c18be5d13df06108eacf6e836e811046032f5`
- `feat/stripe-cli-harness-2026-09-12` — `acdfacc2b5ad60c8a2610cf131f4866ff26ddf50`
- `feat/stripe-webhook-2026-09-12` — `f85086159052d45d084865226c8ef78f7226fe2e`
- `feat/voice-personality-patter-inline` — `34137897ec08f07de5104d41a37b71320eaae872`
- `feature/scenario-lab-council-oasis-2026-09-13` — `ff665e76e650d16dfc510c3b530890a9a2a2110c`
- `fix/scratch-council-completo-2026-09-14` — `de4769bed0832e1097f58f033f68db79b1195bc4`
- `fix/scratchpad-wave13-15-2026-09-14` — `184cf95fde56733f335289911fce12ddedb27c32`
- `fix/wave9-require-persistent-state-2026-09-13` — `87d16c2569921497275bb8a7e17359b94f989cc5`
- `ignore-temp-2` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `ignore-temp-3` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `ignore-temp-4` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `ignore-temp-5` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `ignore-temp-6` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `ignore-temp-7` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `implementation/ai-creator-commerce-revenue-os-2026-09-13` — `8ca211d2ca13a9c308f019f6963ad57da9b9c6c5`
- `integration/mvp-crm-main-2026-09-12` — `8969cf47590ef04dcc89325b42a977052738bf84`
- `integration/stripe-into-main-2026-09-12` — `eafd3c2efc2cffe7e9b31ccf98d26fd84feacda6`
- `knowledge-os/component-registry-2026-09-12` — `0fc13088df1a40b0243e1b956f95ad441990921b`
- `knowledge-os/naming-registry-2026-09-12` — `d4aacf8fd6485f9560d813b84763033bc16107a0`
- `knowledge-os/retrieval-jit-2026-09-12` — `35e02fc8e9123126f311c38351450392dcdc6b17`
- `main` — `fec2d25348d357e9091c2d5e11fbfd7ee7427208`
- `main-merge-2026-09-12` — `17411bba65e737ce2ec6cc4bb4f338ebe92d29c9`
- `memory-kernel/context-compiler-2026-09-12` — `929658a0241bc0d14e139ef5e22c2684798eb085`
- `migration/consolidated-2026-09-14` — `d9618ec3f93ba7f7cfa2159335a641b4fcc2d0a0`
- `migration/linux-2026-09-14` — `577d30c1fca6cb8307d68c08caf2132b232e062d`
- `mvp/crm-completo` — `e45bdc4f1b18c063473e9bccdafd0d056329037a`
- `mvp/memory-os` — `41062df808f4709bd4a880e1830a460a487609ee`
- `plan/agent-personality-conversation-os-v1-2026-09-14` — `204b7a0f186774eee0f48159b283b8ec720637f0`
- `plan/ai-creator-commerce-revenue-os-2026-09-13` — `94880c7eb3c445a871975ec31151a243a78e2ead`
- `plan/lumenva-master-consolidation-v3-2026-09-14` — `542c9b6fea4cb2efef83321fc0ab7c43e287cb37`
- `plan/voice-personality-patter` — `4124d60dc13c20c34d080493461eb031903e755a`
- `psycheos/affect-ledger-2026-09-12` — `ea93b856cdbeec462c032d0f48dfc475d3bf05bc`
- `qa/bronze-6372baf1-2026-09-12` — `d3a44b17ba4a43efc43645150b9873f6d7021732`
- `qa/etapa3-entitlements-2026-09-12` — `fd31c818ee0e148387a2823911266347e055e6cc`
- `qa/stripe-08aa8985-2026-09-12` — `536767b309bbdd8e66233d182a5ffea6585425f8`
- `qa/wave10-delivery-real-proof-2026-09-13` — `d6a8e62076aa8d925af3abe3a8f81bc3b2eaf33c`
- `qa/wave11-consent-real-2026-09-13` — `10d83e68b347135d11670f3fa2f001cad8220f03`
- `qa/wave16-real-proof-2026-09-13` — `c02d160574e33ae3423dc564117b5e0deff71d8d`
- `qa/wave9-real-proof-2026-09-13` — `a1aff1ac017b6c920348802b3dc1883fb5a041a7`
- `refactor/lumenva-identity-purge-2026-09-14` — `f29d434d2d95010a3452dc7d7db60db1317bc5ce`
- `refactor/zero-deskcomm-to-lumenva-2026-09-14` — `baca494857f86fc337e0dd01d196a38fff09e206`
- `rescue/business-os-wave-1-gate-runner-2026-09-11` — `f678e6541897babae4b5afbfe207dcfc20e927ac`
- `rescue/business-os-wave-2-gate-runner-2026-09-11` — `6bcf4ae79777031d372f587cd64fb049618d5f3d`
- `rescue/f5-gate-runner-2026-09-10` — `e45bdc4f1b18c063473e9bccdafd0d056329037a`
- `research/agentes-vps-sizing-2026-09-08` — `e33249b4c4799e8d342c9a9aeb168aedab9d87f2`
- `temp-delete-me` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `validation/codex-cloud-2026-09-14` — `687b39f9b6c44aa03e11eb1eca07524781c11ad6`
- `wave1/job-engine-persistence-2026-09-13` — `96e364839ea69ba2385da2d70ff077ef1508bccd`
- `wave10/mobile-compliance-guardian-2026-09-13` — `34a5f8f82f6843be2c1e03ec9cd61cffc067f8a3`
- `wave10/mobile-compliance-guardian-2026-09-13-copy` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `wave10/mobile-compliance-guardian-api-tdd-2026-09-13` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `wave10/mobile-compliance-guardian-api-tdd-2026-09-13-v2` — `ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13`
- `wave10/mobile-delivery-2026-09-13` — `5c658836fda01911a4e2672095ffd895a4846784`
- `wave11/consent-registry-2026-09-12` — `ea70b0d0146384ce659f0c362a4747accac1b2a4`
- `wave12/marketing-content-2026-09-13` — `33396e8e6678fa1527fafca9e481df24163ddde8`
- `wave13/source-registry-rls-proof-2026-09-13` — `25b9d9e3e7c26a12a456bdccd2274930d45f5c8c`
- `wave14-15/evals-autonomy-2026-09-12` — `fe2a3ab3847a2f8382c11908df0cfe25c1ac04dd`
- `wave15/resource-router-2026-09-13` — `64a22267c4de591a58987fd7a0b33e3f36234e2e`
- `wave2/agent-birth-2026-09-12` — `1554937853d07b88d21582d3dc956f0df641e7ec`
- `wave3/session-runtime-skeleton-2026-09-12` — `8a4a2d0df4723e16b2870713dbe788b9262faf15`
- `wave4/browsermesh-wake-2026-09-12` — `86db2b78e112ffc72cfcf73abb3c7c052589b818`
- `wave5/command-center-2026-09-12` — `5f968a022ca892e990053149965a15fb8d855583`
- `wave6/studio-comercial-2026-09-12` — `74e15b9eaf9c53e1ea2dbb4ea45a9f92533e172d`
- `wave7-8/studio-editor-2026-09-12` — `ff370027b9139ec7b64387809d5a1cd8b11cd4fc`
- `wave8/asset-intelligence-2026-09-13` — `d71347e9c0c678604f3758d15c913294ddf2867d`
- `wave9/product-factory-2026-09-12` — `6f01b40a80cb4ab933c581f2d4bf58eb4129fd17`

