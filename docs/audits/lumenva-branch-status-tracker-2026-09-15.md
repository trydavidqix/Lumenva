# Lumenva — branch status tracker (2026-09-15)

## Escopo e evidência

Fonte: snapshot exato de refs persistido em docs/audits/lumenva-branch-audit-2026-09-15.md. origin/main verificado em fec2d25348d357e9091c2d5e11fbfd7ee7427208.

A auditoria declara 102 branches divergentes, porém suas linhas exatas de implementação somam 103. A causa foi identificada: o quadro-resumo agrupa `f6/*` como 11 refs, mas o snapshot também contém a ref standalone `f6-lgpd-export-2026-09-10`; ela não é ancestral de `origin/main` (SHA `e770c2e1a638fff60715d5fd79410af50586e06e`) e portanto é uma divergência real, não erro de ancestry nem duplicata de árvore. As outras 11 refs `f6/*` incluem ancestrais de `origin/main` e não aumentam o conjunto divergente; a linha standalone foi corretamente classificada como M e tratada no grupo LGPD/PAdES. Assim, 102 é a contagem divergente pretendida pelo resumo somente se essa ref standalone for omitida; para o snapshot exato, a contagem auditável é 103. Pendência do dono: confirmar qual convenção de contagem será a oficial, sem omitir a ref.

Classificação determinística: F = SHA ancestral de origin/main, árvore duplicada no snapshot ou marcador explícito de cópia/v2/scratch; M = diff divergente com até 20 arquivos e ao menos um teste/spec; P = demais diffs divergentes. M não significa merge/teste aprovado: é apenas candidato a verificação e consolidação.

ahead e diff_files vêm de git rev-list --count origin/main..SHA e git diff --name-only origin/main...SHA. test_file indica presença de arquivo de teste/spec no diff. build_test permanece not_run_local para todas as refs nesta reconstrução; executar no Codex Cloud os gates documentados no handoff. covered_by_stage é sobreposição de caminhos com os diffs das etapas 03–19, não prova de equivalência semântica.

## Totais exatos

| Classe | Quantidade |
|---|---:|
| M | 33 |
| P | 26 |
| F | 44 |
| Total do snapshot divergente | 103 |

## Rastreamento individual

| # | Classe | Branch original | SHA snapshot | ahead | diff_files | test_file | build_test | covered_by_stage | Evidência / ação |
|---:|:---:|---|---|---:|---:|:---:|---|---|---|
| 1 | P | automation/lumenva-identity-trigger-2026-09-14 | 73d1ed20c778ac9a27e7c47562f4e035d463de4b | 11 | 8 | no | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 2 | M | business-os/bronze-stripe-checkout-security-fix-2026-09-13 | bc07b276d3c3d59896203a0b3a4888d708e79017 | 5 | 7 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 3 | P | business-os/phase-0-audit | cc660e3c05c216aecd3f53a5ada170d688a0751c | 6 | 9 | no | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 4 | P | business-os/phase-0-audit-docs-2026-09-11 | 636eb5249964f0cb9d62a2a58f64262ae11ca915 | 4 | 6 | no | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 5 | P | business-os/phase-1-baseline-reconcile-2026-09-11 | a668de6d67d0d503d76a6784bd4851583f164b1b | 31 | 27 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 6 | P | business-os/phase-1-cli-2026-09-11 | 62681f15366a8702b515ebf833193ca67ba74399 | 18 | 26 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 7 | P | business-os/phase-1-cli-esm-2026-09-11 | e7c8f207e5e8458a5a91cdeb1aa4b1aed9f22d27 | 32 | 27 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 8 | P | business-os/phase-1-entitlements | c1554172f84b7e73fad4818cfc7bed7d4c793a9a | 43 | 29 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 9 | M | business-os/phase-1-entitlements-bigorna-2026-09-11 | 27a796451e8e2febd2b100838abd783ae1301d6e | 2 | 4 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 10 | M | business-os/phase-1-entitlements-bronze-2026-09-11 | 53c30dbef0486a27f6acfb3cf838f40de13ceccf | 3 | 6 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 11 | M | business-os/phase-1-entitlements-torno-2026-09-11 | 70ca77d1ea9f9ae485585fc8fc151029a0c81823 | 2 | 2 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 12 | M | business-os/phase-1-http-2026-09-11 | 96230c21b335fbc5e52d8d41d8014cc7979ab122 | 28 | 19 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 13 | F | business-os/phase-1-mcp-2026-09-11 | 985b0a3c88167f36ac2ca4352a620696577b9cfc | 15 | 14 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | árvore duplicada entre refs do snapshot; manter uma ref canônica |
| 14 | F | business-os/phase-1-migrate-fix-2026-09-11 | ad6a6191bed00a291dc437ffa430f70ab0c89987 | 14 | 14 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | árvore duplicada entre refs do snapshot; manter uma ref canônica |
| 15 | M | business-os/phase-1-reconcile-2026-09-11 | d7cdca7bb0e25894cb349c55e9c62685efcb2369 | 11 | 11 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 16 | M | business-os/phase-3-contract-security-2026-09-12 | 02a9b806f322732213871755c50b434f0cfa191b | 1 | 5 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 17 | M | business-os/phase-3-stripe-security-2026-09-12 | babb6bfdba36d356c96bddb97b3c70e96a100332 | 2 | 7 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 18 | P | business-os/wave-1-acceptance-2026-09-11 | 341b51a0b118b0bcda1ed92785d143de5744df81 | 13 | 21 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 19 | M | business-os/wave-1-agent-contracts-2026-09-11 | 08ec4648cbd9f93327ba1ed0443430672222d4f4 | 7 | 11 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 20 | P | business-os/wave-1-event-adapter-2026-09-11 | 344d01110a32668d91e5ae9a65d24351d0e0b9ea | 25 | 33 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 21 | M | business-os/wave-1-job-engine-events-2026-09-11 | e046e0557abd4fb4cb222d6569e82dca1fdf70f6 | 7 | 16 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 22 | P | business-os/wave-1-mcp-surface-2026-09-11 | 86e71bda74a607b54e62799f5d93a8b368e40e5a | 14 | 25 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 23 | P | business-os/wave-1-operating-core | e059f87fe30a35c2e223ff2a9be650f6a0ba79e0 | 33 | 40 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 24 | P | business-os/wave-1-operating-core-cli-2026-09-11 | c8a79ff33e8d1f5f5602cd10153ba3cc8feaab3e | 14 | 24 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 25 | P | business-os/wave-1-operating-core-equivalence-2026-09-11 | 0da8cfbb199a653ba40200ae70791100107a463d | 25 | 40 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 26 | M | business-os/wave-1-operating-core-evidence-2026-09-11 | ef243de4238294c377a3d4bf4f3d023e89263292 | 7 | 11 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 27 | P | business-os/wave-1-policy-edges-2026-09-11 | 217a5a64feaded24a5e48c5df2ff4b5768505221 | 22 | 32 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 28 | P | business-os/wave-2-agent-birth-2026-09-11 | 5d001358a14ccfa3e3a6a40a93422be9f0a58e72 | 32 | 38 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 29 | P | business-os/wave-2-agent-birth-prompt | 6bcf4ae79777031d372f587cd64fb049618d5f3d | 41 | 63 | yes | not_run_local | 11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 30 | P | business-os/wave-2-agent-migration-2026-09-11 | 79bdbfd2859755cce49cc8c4cb1c0a026fad61af | 37 | 60 | yes | not_run_local | 11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 31 | P | business-os/wave-2-certification-2026-09-11 | 11a3f47c72776e9cc88cf31e33b2c10d97973312 | 37 | 61 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 32 | P | business-os/wave-3-session-runtime | 12aee3bd24ba49d0aab1c4f3d78ab398139f58a3 | 43 | 71 | yes | not_run_local | 11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 33 | P | business-os/wave-3-session-runtime-mvp-2026-09-11 | b72d8486eca03148e2d78500b39b8501ba645124 | 42 | 66 | yes | not_run_local | 11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 34 | F | f5/audit-admin-403-2026-09-10 | 8aa9a6e0fbdb7100bcbe44a55ca8eba9e1c5472b | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 35 | F | f5/audit-settings-gaps-2026-09-10 | f0f51dba47425ff01ec2130f3d12b9a25a7ac61f | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 36 | F | f5/audit-settings-ui-api-2026-09-10 | 37df205f35146d9116f22a9a940b9c1105259b6e | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 37 | M | f5/autonomy-001-2026-09-10 | b0b6cb69f57be91bac09db57e2b70985d8de4a17 | 1 | 4 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 38 | F | f5/customer-360-001-2026-09-10 | 9cbd130222b5f6ce17cf2ed65d6face66af585d2 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 39 | F | f5/customer-360-002-2026-09-10 | cf44e2aad1ca07c3708e21ef0a3751a7b2f5339c | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 40 | F | f5/customer-360-002-v2-2026-09-10 | 929c6c7390b3c5ef3a7d6d74c0131b420d4c2038 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 41 | F | f5/customer-360-merge-001-2026-09-10 | b32efedeb9021484a3887cc3c0ae8c8aa0f73d35 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 42 | F | f5/customer-360-merge-001-2026-09-10-v2 | b7029aa9008b5f9e727a0d39298e198222f60675 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 43 | F | f5/customer-360-merge-2026-09-10 | 1507b1558c922a871d15f4ee6fb110be5ff7e0cf | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 44 | M | f5/customer360-contacts-ui-2026-09-10 | 9e9bb8c8dc7880a5891e70160acf7a6d97c2a4b8 | 1 | 2 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 45 | F | f5/customer360-export-undo-2026-09-10 | b571c6a2a7d84b1fc35ce0824f61f9edf557d23c | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 46 | F | f5/customer360-integrity-tests-2026-09-10 | b8f6b5781607f88734d046ae7158568445592a9f | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 47 | F | f5/customer360-lgpd-2026-09-10 | f5d8c82451b535ec2683ab33d0763d3542984fc9 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 48 | M | f5/customer360-merge-followup-2026-09-10 | 14d4af1c9c556d2b4d63e74e4ebf5761360e0b0e | 1 | 4 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 49 | M | f5/customer360-merge-hooks-2026-09-10 | 5b83f535c89a5cb75106fc7fa9bb4bdd2e3eea94 | 1 | 4 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 50 | F | f5/customer360-merge-qa-2026-09-10 | 0717a279bf2ce7f19cb107c614f7a97e5b68f85c | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 51 | F | f5/customer360-merge-queue-realtime-2026-09-10 | 09b407610abbbfd93871d30bafdc736f91b9f805 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 52 | F | f5/customer360-merge-queue-ui-2026-09-10 | c3dc712f1031153ddf270f9f501c3a4bb32d7035 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 53 | F | f5/customer360-rls-atomicity-003-2026-09-10 | af142363ac8044b208ee620a57854cd27edc75f5 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 54 | F | f5/customer360-rls-transaction-2026-09-10 | b7f7f0d4d4b54c6203d2be85a8e12c1907317f26 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 55 | F | f5/customer360-security-2026-09-10 | b32efedeb9021484a3887cc3c0ae8c8aa0f73d35 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 56 | P | f5/customer360-security-qa-2026-09-10 | b9556ddc4dbc40f5e2680fb6c82c331f3c9c6231 | 1 | 1 | no | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 57 | F | f5/customer360-security-v2-2026-09-10 | 96c2f9287d4ec0386214d37220fa44ac2ebb4bcc | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 58 | F | f5/customer360-timeline-2026-09-10 | 10f7412e848ab574f1533a8c8852e41e1c161fd8 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 59 | F | f5/customer360-timeline-ui-2026-09-10 | fd0592c5fcd5574cd9b8de6989786fbb5abca194 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 60 | F | f5/gate-config-2026-09-10 | c2e6c7bdf5cdc5198e79121f3db898ba2ea51e6a | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 61 | F | f5/gate-diagnosis-2026-09-10 | fe71bde83b24004b28e972ae105fd5c8df2b7b14 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 62 | F | f5/sidebar-queryclient-testfix-2026-09-10 | 0e4bc55ae9f62e5facd3a43ef142d7a7b1e5a75b | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 63 | F | f5/task-02-2026-09-10 | ce135901c652fb802415c21fc03fe0784796f0b4 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 64 | M | f5/team-audit-settings-004-2026-09-10 | 58e15dac55a4e2812218f39cef4afb7c898ad594 | 2 | 3 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 65 | M | f5/team-audit-settings-004-af142-2026-09-10 | 3d3ca57a0332f171c059ff3c2a4f46ac0969a06e | 3 | 3 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 66 | F | f5/team-settings-role-revoke-2026-09-10 | bc08cca88f7fee4a9e15de16d6c3f22d27f3a7c2 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 67 | M | f5/team-settings-role-revoke-be452-2026-09-10 | df0fb166507d598b01df7fd4ebcceff7d0dadf93 | 1 | 4 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 68 | P | f6-lgpd-export-2026-09-10 | e770c2e1a638fff60715d5fd79410af50586e06e | 1 | 3 | no | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 69 | F | f6/lgpd-audit-event-2026-09-10 | 32291b989fd7fff193f53868e237e7ecde376f45 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 70 | F | f6/lgpd-download-2026-09-10 | 160bf7608c59603d6b73eea08a4e1d4a9416c9cd | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 71 | F | f6/lgpd-e2e-final-2026-09-10 | 6e826adba2953d677a0de45cc44937e629c4af95 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 72 | F | f6/lgpd-export-zip-2026-09-10 | 96041e07af4cb66d341674169fda51aa1de96f00 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 73 | F | f6/lgpd-pades-verify-2026-09-10 | ad767bfcac0fe5502bb8a36bb343126e20bdb0ff | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 74 | F | f6/lgpd-pdf-provenance-2026-09-10 | 0a6c9713b4cef8abc1ddf34f357de6f8733e6e72 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 75 | F | f6/lgpd-pii-retention-2026-09-10 | 9dde81dbeb516ebba82c64c4ac4a8d2c87d07bd2 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 76 | P | f6/lgpd-zip-manifest-2026-09-10 | 706caf3ef45d482165fb6fb0ca55c5ab35102a33 | 1 | 1 | no | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 77 | F | f6/lgpd-zip-manifest-549-2026-09-10 | 3626d2555af46833f9206223a94ffe5c34d9fa98 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 78 | M | f6/pades-scaffold-2026-09-10 | ed4a52522a68521b85980a4aa7fb3f9dba8e436a | 1 | 4 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 79 | F | f6/pades-scaffold-v2-2026-09-10 | ac1a809183e3178a2ad04fcd88b9c03665ee9ccb | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 80 | P | implementation/ai-creator-commerce-revenue-os-2026-09-13 | 8ca211d2ca13a9c308f019f6963ad57da9b9c6c5 | 60 | 62 | yes | not_run_local | none | diff não trivial; requer implementação e verificação específica |
| 81 | F | integration/mvp-crm-main-2026-09-12 | 8969cf47590ef04dcc89325b42a977052738bf84 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 82 | F | integration/stripe-into-main-2026-09-12 | eafd3c2efc2cffe7e9b31ccf98d26fd84feacda6 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 83 | F | migration/consolidated-2026-09-14 | d9618ec3f93ba7f7cfa2159335a641b4fcc2d0a0 | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 84 | F | migration/linux-2026-09-14 | 577d30c1fca6cb8307d68c08caf2132b232e062d | 0 | 0 | no | not_run_local | none | ancestral de origin/main; não há diff divergente |
| 85 | M | wave1/job-engine-persistence-2026-09-13 | 96e364839ea69ba2385da2d70ff077ef1508bccd | 6 | 16 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 86 | P | wave10/mobile-compliance-guardian-2026-09-13 | 34a5f8f82f6843be2c1e03ec9cd61cffc067f8a3 | 40 | 64 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 87 | F | wave10/mobile-compliance-guardian-2026-09-13-copy | ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13 | 32 | 56 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | árvore duplicada entre refs do snapshot; manter uma ref canônica |
| 88 | F | wave10/mobile-compliance-guardian-api-tdd-2026-09-13 | ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13 | 32 | 56 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | árvore duplicada entre refs do snapshot; manter uma ref canônica |
| 89 | F | wave10/mobile-compliance-guardian-api-tdd-2026-09-13-v2 | ef4ebf0a67777c2c3ac2c41cc0b491f29312ac13 | 32 | 56 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | árvore duplicada entre refs do snapshot; manter uma ref canônica |
| 90 | M | wave10/mobile-delivery-2026-09-13 | 5c658836fda01911a4e2672095ffd895a4846784 | 15 | 17 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 91 | M | wave11/consent-registry-2026-09-12 | ea70b0d0146384ce659f0c362a4747accac1b2a4 | 9 | 16 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 92 | M | wave12/marketing-content-2026-09-13 | 33396e8e6678fa1527fafca9e481df24163ddde8 | 18 | 20 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 93 | M | wave13/source-registry-rls-proof-2026-09-13 | 25b9d9e3e7c26a12a456bdccd2274930d45f5c8c | 11 | 16 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 94 | P | wave14-15/evals-autonomy-2026-09-12 | fe2a3ab3847a2f8382c11908df0cfe25c1ac04dd | 14 | 21 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff não trivial; requer implementação e verificação específica |
| 95 | M | wave15/resource-router-2026-09-13 | 64a22267c4de591a58987fd7a0b33e3f36234e2e | 16 | 18 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 96 | M | wave2/agent-birth-2026-09-12 | 1554937853d07b88d21582d3dc956f0df641e7ec | 15 | 14 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 97 | M | wave3/session-runtime-skeleton-2026-09-12 | 8a4a2d0df4723e16b2870713dbe788b9262faf15 | 17 | 16 | yes | not_run_local | 12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 98 | M | wave4/browsermesh-wake-2026-09-12 | 86db2b78e112ffc72cfcf73abb3c7c052589b818 | 14 | 13 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 99 | M | wave5/command-center-2026-09-12 | 5f968a022ca892e990053149965a15fb8d855583 | 11 | 9 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 100 | M | wave6/studio-comercial-2026-09-12 | 74e15b9eaf9c53e1ea2dbb4ea45a9f92533e172d | 6 | 10 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 101 | M | wave7-8/studio-editor-2026-09-12 | ff370027b9139ec7b64387809d5a1cd8b11cd4fc | 13 | 14 | yes | not_run_local | none | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 102 | M | wave8/asset-intelligence-2026-09-13 | d71347e9c0c678604f3758d15c913294ddf2867d | 10 | 15 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |
| 103 | M | wave9/product-factory-2026-09-12 | 6f01b40a80cb4ab933c581f2d4bf58eb4129fd17 | 9 | 10 | yes | not_run_local | 06,07,08,09,10,11,12,13,14,15,16,17,18,19 | diff pequeno com arquivo de teste/spec; gates ainda precisam ser executados |

## Gate real obrigatório para cada M/P

No ambiente Codex Cloud, por worktree/branch: pnpm install --frozen-lockfile; pnpm --filter lumenva-crm typecheck; pnpm --filter lumenva-crm lint; pnpm --filter lumenva-crm lint:channels; pnpm --filter lumenva-crm test:harness; pnpm --filter lumenva-crm harness:check; pnpm --filter lumenva-crm test:unit; pnpm --filter lumenva-crm test:shell; pnpm --filter lumenva-crm test:db; pnpm --filter lumenva-website typecheck; pnpm --filter lumenva-website lint; pnpm --filter lumenva-website test; pnpm --filter lumenva-website build.

Até a execução desses comandos, nenhuma linha M/P é considerada tratada ou consolidada.

## Ledger de remediação — Wave 10–15

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| wave10/mobile-delivery-2026-09-13 | Wave 10 Delivery | remediation/waves-10-15-2026-09-15 | aplicado, teste real pendente | commit 4d19b14d; delivery gate persistido e testes adicionados |
| wave11/consent-registry-2026-09-12 | Wave 11 Consent | remediation/waves-10-15-2026-09-15 | já coberto pelo baseline | cherry-pick vazio após comparação |
| wave12/marketing-content-2026-09-13 | Wave 12 Content | remediation/waves-10-15-2026-09-15 | aplicado, teste real pendente | commit c5ba644c; TOCTOU consent integration test adicionado |
| wave13/source-registry-rls-proof-2026-09-13 | Wave 13 Source Registry | remediation/waves-10-15-2026-09-15 | aplicado, teste real pendente | commit 8a365c90; RLS integration test adicionado |
| wave15/resource-router-2026-09-13 | Wave 15 Resource Router | remediation/waves-10-15-2026-09-15 | aplicado, teste real pendente | commit 48b56ddf; router e teste de input malformado adicionados |

O subgrupo permanece aberto até Vitest/typecheck no Codex Cloud. Validações locais: package_json=valid, conflict_markers=none e git diff --check=pass.

## Ledger de remediação — Business OS / Operating Core

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/wave-1-agent-contracts-2026-09-11 | Operating Core contracts | remediation/business-os-operating-core-2026-09-15 | aplicado, teste real pendente | commit eb4bce20; contratos e testes adicionados |
| business-os/wave-1-job-engine-events-2026-09-11 | Operating Core events | remediation/business-os-operating-core-2026-09-15 | aplicado, teste real pendente | commit d98c3b59; reconciliação manual preservou claim persistido e validação tenant |
| business-os/wave-1-operating-core-evidence-2026-09-11 | Evidence policy | remediation/business-os-operating-core-2026-09-15 | aplicado, teste real pendente | commit 7ed0ed20; evidence policy/approval foundations adicionados |

O subgrupo permanece aberto até os testes reais no Codex Cloud. Validações locais: package_json=valid, conflict_markers=none e git diff --check=pass.

## Ledger de remediação — Business OS audit/Stripe

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/phase-0-audit | Phase 0 audit | remediation/business-os-audit-stripe-2026-09-15 | aplicado, revisão/teste real pendente | commits b1f7ca9e, b2d2891f e de847d3c; nove mapas de arquitetura restaurados |
| business-os/phase-0-audit-docs-2026-09-11 | Phase 0 docs | remediation/business-os-audit-stripe-2026-09-15 | aplicado, revisão/teste real pendente | conteúdo documental incorporado em de847d3c |
| business-os/phase-3-contract-security-2026-09-12 | Stripe contract | remediation/business-os-audit-stripe-2026-09-15 | aplicado, teste real pendente | commit bc72da78; contratos e testes provider-free |
| business-os/phase-3-stripe-security-2026-09-12 | Stripe security | remediation/business-os-audit-stripe-2026-09-15 | aplicado, teste real pendente | commit bb3fc0fc; route/browser contracts e audit doc |

O grupo permanece aberto até typecheck/lint/testes no Codex Cloud. Conflitos foram comparados: o conflito Stripe era apenas formatação/comentário; os documentos ausentes foram recuperados por conteúdo do merge tree, sem descarte lógico.

## Ledger de remediação — Business OS CLI/Entitlements

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/phase-1-cli-2026-09-11 | CLI/Entitlements | remediation/business-os-cli-entitlements-2026-09-15 | aplicado, teste real pendente | commit 1f331dac; route, adapter, MCP entitlements, CLI e testes |
| business-os/phase-1-cli-esm-2026-09-11 | CLI ESM | remediation/business-os-cli-entitlements-2026-09-15 | aplicado, teste real pendente | commit 182620f7; script cli:lumenva com tsx/esm |
| business-os/phase-1-entitlements | Entitlements catalog | remediation/business-os-cli-entitlements-2026-09-15 | aplicado, teste real pendente | merge c155 recuperado via -m2 e arquivos de migration-policy adicionados |

O subgrupo permanece aberto até typecheck/lint/testes no Codex Cloud. Validações locais: package_json=valid, migration_policy_syntax=pass, conflict_markers=none e git diff --check=pass.

## Ledger de remediação — Automation/Identity

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| automation/lumenva-identity-trigger-2026-09-14 | Automation/Identity | remediation/automation-identity-2026-09-15 | aplicado, verificação externa pendente | commit ce05ffa4; trigger doc versionado |

O grupo depende de runner/credenciais externas para prova operacional; localmente package_json=valid, conflict_markers=none e git diff --check=pass.

## Ledger de remediação — AI Creator/Commerce

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| implementation/ai-creator-commerce-revenue-os-2026-09-13 | AI Creator/Commerce Connect | remediation/ai-creator-commerce-2026-09-15 | aplicado, teste real pendente | commit 11a6a79d; adapter Nuvemshop provider-neutral com capabilities comprovadas |

O grupo permanece aberto até typecheck/lint/testes no Codex Cloud; o conflito add/delete foi resolvido mantendo o adapter ausente no baseline, sem descarte de lógica existente.

## Ledger de remediação — Acceptance/Event Adapter/MCP

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/wave-1-acceptance-2026-09-11 | Acceptance proofs | remediation/business-os-acceptance-mcp-2026-09-15 | aplicado, teste real pendente | commit 84bbe0b5; acceptance tests adicionados |
| business-os/wave-1-event-adapter-2026-09-11 | Event Adapter | remediation/business-os-acceptance-mcp-2026-09-15 | aplicado, teste real pendente | commit 03ab1c8a; Postgres integration test e import corrigido |
| business-os/wave-1-mcp-surface-2026-09-11 | MCP surface | remediation/business-os-acceptance-mcp-2026-09-15 | aplicado, teste real pendente | commit ae9ac418; catálogo Operating Core em linguagem simples |
| business-os/wave-1-operating-core-2026-09-11 | Operating Core receipts | remediation/business-os-acceptance-mcp-2026-09-15 | aplicado, teste real pendente | commit a27b1815; receipt persistence test descartável |

Validações locais do grupo: package_json=valid, conflict_markers=none e git diff --check=pass. Os testes Postgres/Vitest precisam ser executados no Codex Cloud.

## Ledger de remediação — Wave 2 Agent Birth

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/wave-2-agent-birth-prompt | Agent Birth prompt | remediation/wave2-agent-birth-2026-09-15 | aplicado, teste real pendente | merge 5dee6046, prompt compiler 3861bf78; certification/prompt tests |
| business-os/wave-2-agent-migration-2026-09-11 | Agent Birth migration | remediation/wave2-agent-birth-2026-09-15 | aplicado, teste real pendente | commit d2bd8cb4; birth.ts/test.ts e definitions reconciliados |
| business-os/wave-2-certification-2026-09-11 | Agent Birth certification | remediation/wave2-agent-birth-2026-09-15 | aplicado, teste real pendente | commit d597cfbd; registries skill/tool/agent-runtime e guardrails |

Conflitos de definitions/index foram integrados manualmente, preservando exports existentes e adicionando os contratos novos. Validações locais: cinco package.json válidos, conflict_markers=none e git diff --check=pass; typecheck/Vitest reais pendentes no Codex Cloud.

## Ledger de remediação — Wave 3 Session Runtime

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/wave-3-session-runtime | Session Runtime core | remediation/wave3-session-runtime-2026-09-15 | aplicado, teste real pendente | commit 05467b15; context/model locks e testes |
| business-os/wave-3-session-runtime-mvp-2026-09-09 | Session Runtime service | remediation/wave3-session-runtime-2026-09-15 | aplicado, teste real pendente | commit 1d41987a; providers/service e testes |

Validações locais: package.json de agent-runtime, prompt-compiler e CRM válidos, conflict_markers=none e git diff --check=pass. Typecheck/Vitest reais pendentes no Codex Cloud.

## Ledger de remediação — Reconcile/Equivalence

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/phase-1-baseline-reconcile-2026-09-11 | Baseline reconcile | remediation/business-os-reconcile-equivalence-2026-09-15 | já coberto pelo baseline | cherry-pick a668 vazio; migration policy já presente |
| business-os/wave-1-operating-core-equivalence-2026-09-11 | Operating Core equivalence | remediation/business-os-reconcile-equivalence-2026-09-15 | já coberto pelo baseline | cherry-pick 0da vazio; MCP route test já presente |
| business-os/wave-1-operating-core-cli-2026-09-11 | Operating Core CLI | remediation/business-os-reconcile-equivalence-2026-09-15 | já coberto pelo baseline | cherry-pick c8 vazio; CLI coverage já incorporada |
| business-os/wave-1-policy-edges-2026-09-11 | Policy edges | remediation/business-os-reconcile-equivalence-2026-09-15 | aplicado, teste real pendente | commit d8e324d3; compare-and-set e teste concorrente de approval |

O grupo permanece aberto até Vitest/Postgres/typecheck no Codex Cloud; validações locais package_json=valid, conflict_markers=none e git diff --check=pass.

| wave10/mobile-compliance-guardian-2026-09-13 | Wave 10 Mobile Compliance | remediation/waves-10-15-2026-09-15 | aplicado, teste real pendente | commit 4d34220c; Mobile Releases registrado na navegação |
| wave14-15/evals-autonomy-2026-09-12 | Wave 14–15 Evals | remediation/waves-10-15-2026-09-15 | já coberto pelo baseline | cherry-pick vazio após comparação; não houve alteração descartada |

## Ledger de remediação — Wave 6–9

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| wave6/studio-comercial-2026-09-12 | Wave 6 Studio | remediation/waves-6-9-2026-09-15 | já coberto pelo baseline | cherry-pick vazio após reconciliação |
| wave7-8/studio-editor-2026-09-12 | Wave 7–8 Studio Editor | remediation/waves-6-9-2026-09-15 | aplicado, teste real pendente | commit 986a6230; testes de concorrência estabilizados |
| wave8/asset-intelligence-2026-09-13 | Wave 8 Asset Intelligence | remediation/waves-6-9-2026-09-15 | aplicado, teste real pendente | commit a1db6ba0; registry, migration, baseline, RLS e integration test |
| wave9/product-factory-2026-09-12 | Wave 9 Product Factory | remediation/waves-6-9-2026-09-15 | aplicado, teste real pendente | commit 4a817bbe; teste de concorrência do estado durável |

O grupo permanece aberto até os testes reais no Codex Cloud. Validações locais: package_json=valid, conflict_markers=none, registry SQL presente com estados quotados e git diff --check=pass.

## Ledger de remediação — Wave 1–5

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| wave1/job-engine-persistence-2026-09-13 | Wave 1 Job Engine | remediation/waves-1-9-2026-09-15 | aplicado, teste real pendente | commit ad2dc7df; job-engine.ts/test.ts adicionados |
| wave2/agent-birth-2026-09-12 | Wave 2 Agent Birth | remediation/waves-1-9-2026-09-15 | aplicado, teste real pendente | commit 1260125e; teste Postgres descartável adicionado |
| wave3/session-runtime-skeleton-2026-09-12 | Wave 3 Session Runtime | remediation/waves-1-9-2026-09-15 | já coberto pelo baseline | cherry-pick vazio após reconciliação |
| wave4/browsermesh-wake-2026-09-12 | Wave 4 BrowserMesh | remediation/waves-1-9-2026-09-15 | já coberto pelo baseline | cherry-pick vazio após reconciliação |
| wave5/command-center-2026-09-12 | Wave 5 Command Center | remediation/waves-1-9-2026-09-15 | aplicado, teste real pendente | commit 6f645e29; RLS integration test preservado |

O grupo permanece aberto até Vitest/Postgres/typecheck no Codex Cloud; validações locais package_json=valid, conflict_markers=none e git diff --check=pass.

## Ledger de remediação — LGPD/PAdES

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| f6-lgpd-export-2026-09-10 | LGPD export | remediation/lgpd-pades-2026-09-15 | já coberto pelo baseline, teste real pendente | cherry-pick e770c2e1 redundante; endpoint ZIP/JSON atual preservado |
| f6/lgpd-zip-manifest-2026-09-10 | LGPD manifest | remediation/lgpd-pades-2026-09-15 | já coberto pelo baseline, teste real pendente | cherry-pick 706caf3e redundante; export-package atual inclui verificação |
| f6/pades-scaffold-2026-09-10 | PAdES | remediation/lgpd-pades-2026-09-15 | já coberto pelo baseline, teste real pendente | cherry-pick ed4a5252 redundante; signer fail-closed e fixture já presentes |

O grupo não é fechado sem executar test:pades/typecheck no Codex Cloud. Validações locais package_json=valid, conflict_markers=none e git diff --check=pass.

## Ledger de remediação — Customer 360

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| f5/autonomy-001-2026-09-10 | Autonomy/Customer 360 | remediation/customer360-2026-09-15 | aplicado, teste real pendente | commit 99d02d8f; f5-promotion.test.ts incluído |
| f5/customer360-contacts-ui-2026-09-10 | Customer 360 UI | remediation/customer360-2026-09-15 | aplicado, teste real pendente | commit 8c38ef40; contrato de Contacts UI incluído |
| f5/customer360-merge-followup-2026-09-10 | Customer 360 merge | remediation/customer360-2026-09-15 | aplicado, teste real pendente | commit 26087144; merge queue já existente no baseline, gate mantido |
| f5/customer360-merge-hooks-2026-09-10 | Customer 360 merge | remediation/customer360-2026-09-15 | conteúdo redundante verificado | cherry-pick vazio após comparação; mesma implementação já presente |
| f5/team-audit-settings-004-2026-09-10 | Team audit | remediation/customer360-2026-09-15 | aplicado, teste real pendente | commit 6875de15; schemas/audit.test.ts no fast gate |
| f5/team-audit-settings-004-af142-2026-09-10 | Team audit | remediation/customer360-2026-09-15 | conteúdo redundante verificado | gate já continha audit.test.ts; cherry-pick vazio |
| f5/team-settings-role-revoke-be452-2026-09-10 | Team audit | remediation/customer360-2026-09-15 | já coberto pelo baseline, teste real pendente | arquivos de revogação e testes já presentes; cherry-pick vazio |
| f5/customer360-security-qa-2026-09-10 | Customer 360 security | remediation/customer360-2026-09-15 | documentação aplicada, teste real pendente | commit 62dd1db7; fronteira PII registrada |

O grupo permanece aberto até o Codex Cloud executar os testes e typecheck; as validações locais package_json=valid, conflict_markers=none e git diff --check=pass não substituem esses gates.

## Ledger de remediação

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/phase-1-entitlements-bigorna-2026-09-11 | Entitlements | remediation/entitlements-billing-migrations-2026-09-15 | aplicado, teste real pendente | commit 0f414b92; pnpm/vitest bloqueado por DNS do registry |
| business-os/phase-1-entitlements-torno-2026-09-11 | Entitlements | remediation/entitlements-billing-migrations-2026-09-15 | aplicado, teste real pendente | commit 7fcf4ab6; contrato risk_contract_invalid reconciliado |
| business-os/phase-1-reconcile-2026-09-11 | Entitlements | remediation/entitlements-billing-migrations-2026-09-15 | aplicado, teste real pendente | commit 1bf4a4e6; API decision preservada |
| business-os/bronze-stripe-checkout-security-fix-2026-09-13 | Billing | remediation/entitlements-billing-migrations-2026-09-15 | aplicado, teste real pendente | commit 43c1c239; teste Postgres adicionado |
| business-os/phase-1-http-2026-09-11 | Migrations | remediation/entitlements-billing-migrations-2026-09-15 | aplicado, teste real pendente | commit cf511bbc; declaração .mjs.d.ts restaurada |

O grupo não é considerado fechado: a execução local de pnpm tentou resolver pacotes em registry.npmjs.org e falhou repetidamente por DNS. Gate obrigatório no Codex Cloud: pnpm install --frozen-lockfile e, depois, os comandos completos desta página.

## Correção de rastreamento — referências exatas remanescentes

| Branch original | Grupo | Branch isolada | Estado | Evidência |
|---|---|---|---|---|
| business-os/phase-1-entitlements-bronze-2026-09-11 | Entitlements bronze | remediation/remaining-entitlements-operating-core-2026-09-15 | aplicado, teste real pendente | commit 5b098e30; gateway legado protegido por entitlement e teste preservado após conflito modify/delete |
| business-os/wave-1-operating-core | Operating Core receipts | remediation/business-os-acceptance-mcp-2026-09-15 | aplicado, teste real pendente | commit a27b1815; referência exata corrigida, receipt persistence test descartável |
| business-os/wave-2-agent-birth-2026-09-11 | Agent Birth factory | remediation/remaining-entitlements-operating-core-2026-09-15 | conteúdo equivalente verificado, teste real pendente | cherry-pick 5d001358 vazio após comparação manual; única divergência eram IDs support/claude_orchestrator, rejeitados por compatibilidade de identidade, já coberta em d2bd8cb4 |
| business-os/wave-3-session-runtime-mvp-2026-09-11 | Session Runtime service | remediation/wave3-session-runtime-2026-09-15 | aplicado, teste real pendente | referência exata corrigida; commit 1d41987a adicionou providers/service e testes |

A correção elimina aliases de data/nome que deixavam quatro referências M/P fora do ledger automatizado; nenhuma linha original foi removida.

## Execução consolidada no Codex Cloud — 16 branches de remediação

Executar cada linha a partir da raiz do worktree/branch indicado. Cada linha é um comando composto independente: instala exatamente o lockfile e em seguida executa o teste específico do grupo. O resultado deve ser anexado ao ledger correspondente; `not_run_local` não deve ser substituído por sucesso sem saída real do Codex Cloud.

| # | Branch de remediação | Comando exato Codex Cloud |
|---:|---|---|
| 1 | `remediation/automation-identity-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:unit` |
| 2 | `remediation/ai-creator-commerce-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:unit` |
| 3 | `remediation/business-os-audit-stripe-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm exec vitest run --config vitest.config.ts lib/billing/stripe-contract.test.ts lib/billing/stripe-route-contract.test.ts` |
| 4 | `remediation/business-os-cli-entitlements-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm exec vitest run --config vitest.config.ts lib/entitlements/boundary.test.ts lib/cli/lumenva.test.ts lib/mcp/tools/entitlements.test.ts` |
| 5 | `remediation/customer360-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:fast` |
| 6 | `remediation/entitlements-billing-migrations-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:db` |
| 7 | `remediation/lgpd-pades-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:pades` |
| 8 | `remediation/remaining-entitlements-operating-core-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm exec vitest run --config vitest.config.ts lib/agent-engine/tools/entitlement-dispatch.test.ts lib/agent-engine/product-agents/birth.test.ts` |
| 9 | `remediation/wave2-agent-birth-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm exec vitest run --config vitest.config.ts lib/agent-engine/agent-birth/agent-definition-registry-pg.integration.test.ts` |
| 10 | `remediation/wave3-session-runtime-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm exec vitest run --config vitest.config.ts lib/agent-engine/session-runtime/service.test.ts && pnpm --filter @lumenva/agent-runtime typecheck` |
| 11 | `remediation/waves-1-9-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:db` |
| 12 | `remediation/waves-6-9-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:db` |
| 13 | `remediation/waves-10-15-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm exec vitest run --config vitest.config.ts tests/unit/product-factory-delivery.test.ts lib/memory/resource-router.test.ts` |
| 14 | `remediation/business-os-operating-core-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:unit` |
| 15 | `remediation/business-os-reconcile-equivalence-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm exec vitest run --config vitest.config.ts lib/agent-engine/contracts/wave1-policy-edges.test.ts` |
| 16 | `remediation/business-os-acceptance-mcp-2026-09-15` | `pnpm install --frozen-lockfile && pnpm --filter lumenva-crm test:db` |

Observação: os grupos que adicionaram testes de integração Postgres usam `test:db` como comando específico porque o runner prepara o banco descartável e aplica as migrações; os testes unitários direcionados são complementares quando listados. Estes 16 comandos não substituem os gates transversais de typecheck/lint/harness do handoff.

### Resultados de execução Cloud — lote 1 (branches 1–4)

| Branch | Tarefa Codex Cloud | Resultado real | Saída relevante / diagnóstico |
|---|---|---|---|
| `remediation/automation-identity-2026-09-15` | `task_e_6aa900f4be008324b2ba515195ae59b7` | `ERROR` | `codex cloud status`: `[ERROR] Run pnpm install and tests`; `no diff`; `attempt_total=1`. Nenhum output de `pnpm install`/teste foi disponibilizado. |
| `remediation/ai-creator-commerce-2026-09-15` | `task_e_6aa90119580483249617e20ce1a98b6a` | `ERROR` | `codex cloud status`: `[ERROR] Run pnpm install and test commands`; `no diff`; `attempt_total=1`. Nenhum output de `pnpm install`/teste foi disponibilizado. |
| `remediation/business-os-audit-stripe-2026-09-15` | `task_e_6aa9012c2b00832496f3a8c55d1402b7` | `ERROR` | `codex cloud status`: `[ERROR] Run pnpm install and vitest tests`; `no diff`; `attempt_total=1`. Nenhum output de `pnpm install`/Vitest foi disponibilizado. |
| `remediation/business-os-cli-entitlements-2026-09-15` | `task_e_6aa90119fb6883248b444c9776a113f3` | `ERROR` | `codex cloud status`: `[ERROR] Run pnpm installation and tests`; `no diff`; `attempt_total=1`. Nenhum output de `pnpm install`/Vitest foi disponibilizado. |

Diagnóstico de causa raiz: as quatro tarefas falharam no serviço Cloud antes de iniciar o comando solicitado; a CLI não expôs log de execução, e a sessão local que submeteu as tarefas registrou `credits.has_credits=false`, `balance=0` e `spend_control_reached=null`. Isso caracteriza indisponibilidade de créditos/entitlement do executor, não falha confirmada do código. Não foram feitas tentativas variantes. Os quatro grupos permanecem `teste real pendente` até o Cloud aceitar uma execução e devolver stdout/stderr.

## Investigação de billing/autenticação do Codex Cloud — 2026-09-15

Objetivo: confirmar se há uma flag/configuração suportada que force `codex cloud exec` a consumir a assinatura ChatGPT Plus/sessão autenticada em vez de créditos separados. Nenhum dos 16 gates foi reenviado durante esta investigação.

| Evidência | Resultado real |
|---|---|
| `codex login status` | `Logged in using ChatGPT`; autenticação local configurada pelo arquivo `~/.codex/auth.json`, sem API key armazenada. |
| `codex cloud --help`, `codex cloud exec --help`, `codex cloud list --help`, `codex cloud status --help` | `cloud exec` aceita ambiente, branch, tentativas, features e `--config` genérico; não expõe `billing_mode`, `account_type`, `subscription`, `credits` nem opção “use ChatGPT plan”. Os demais subcomandos também não expõem essa seleção. |
| `~/.codex/config.toml` | Contém `model`, `model_reasoning_effort`, `approvals_reviewer`, confiança de projetos e estado de UI; não contém chave de billing/account/subscription. `model_reasoning_effort` controla somente esforço de raciocínio. |
| `codex doctor` | Confirma `stored auth mode: chatgpt`, `stored API key: false` e `reachability mode: ChatGPT auth`; também reporta DNS/WebSocket/HTTP indisponíveis neste sandbox e estado de banco de memórias inválido. Isto não cria nem seleciona um modo de cobrança. |
| Variáveis `OPENAI_API_KEY`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID` | Nenhuma estava definida no processo; não há indicação local de fallback para billing da API. |
| Documentação oficial Codex Cloud/CLI/config/env | A configuração do Cloud orienta entrar com a conta ChatGPT, conectar GitHub/GitLab e criar ambiente; não documenta flag de billing ou conversão de créditos. A referência oficial de configuração lista `model_reasoning_effort`, autenticação e ambientes, mas não `billing_mode`, `account_type` ou `use_experimental_reasoning_effort`. |

Conclusão operacional: não foi encontrada uma flag/configuração pública suportada para “forçar cobrança pela assinatura Plus”. A sessão local está corretamente autenticada via ChatGPT, mas os quatro erros Cloud anteriores registraram `plan_type=plus` junto de `credits.has_credits=false`/`balance=0`; portanto o problema observado é compatível com entitlement/limite do serviço Cloud, e não com uma chave local ausente. Não é seguro inventar `-c billing_mode=...`, pois o CLI não documenta essa chave e ela não alteraria a autorização server-side.

Pendência do dono: verificar no produto Codex web, com a mesma conta Plus, se o ambiente/repositório está habilitado para tarefas Cloud e se existe aviso de plano/limite; se a UI também recusar a tarefa, abrir suporte OpenAI com os IDs das quatro tasks já registradas. Só após uma execução Cloud retornar stdout/stderr real deve-se retomar os 16 gates. Referências: [Codex cloud — documentação oficial](https://developers.openai.com/codex/cloud), [Codex CLI — documentação oficial](https://developers.openai.com/codex/cli), [referência oficial de configuração](https://learn.chatgpt.com/docs/config-file/config-reference), [variáveis de ambiente oficiais](https://learn.chatgpt.com/docs/config-file/environment-variables).

## PRs GitHub para execução dos 16 gates — estado real 2026-09-15

Com autorização do dono, cada branch foi enviada com `git push origin HEAD:refs/heads/<branch>` e recebeu um PR aberto contra `main`. Não houve merge, aprovação, squash ou rebase. Os PRs foram criados sequencialmente:

| # | Branch | PR | `ci.yml` | Checks observados |
|---:|---|---|---|---|
| 1 | `remediation/automation-identity-2026-09-15` | [#46](https://github.com/trydavidqix/Lumenva/pull/46) | não criado | Vercel CRM `fail` — deployment blocked; website `fail` — GitHub não verificou conta; Preview Comments `pass`. |
| 2 | `remediation/ai-creator-commerce-2026-09-15` | [#47](https://github.com/trydavidqix/Lumenva/pull/47) | não criado | Vercel CRM `fail` — deployment blocked; website `fail` — GitHub não verificou conta; Preview Comments `pass`. |
| 3 | `remediation/business-os-audit-stripe-2026-09-15` | [#48](https://github.com/trydavidqix/Lumenva/pull/48) | não criado | Vercel website `fail` — GitHub não verificou conta. |
| 4 | `remediation/business-os-cli-entitlements-2026-09-15` | [#49](https://github.com/trydavidqix/Lumenva/pull/49) | não criado | Vercel CRM `fail` — deployment blocked; website `fail` — GitHub não verificou conta; Preview Comments `pass`. |
| 5 | `remediation/customer360-2026-09-15` | [#50](https://github.com/trydavidqix/Lumenva/pull/50) | não criado | Vercel website `fail` — GitHub não verificou conta. |
| 6 | `remediation/entitlements-billing-migrations-2026-09-15` | [#51](https://github.com/trydavidqix/Lumenva/pull/51) | não criado | Vercel website `fail` — GitHub não verificou conta. |
| 7 | `remediation/lgpd-pades-2026-09-15` | [#52](https://github.com/trydavidqix/Lumenva/pull/52) | não criado | Vercel website `fail` — GitHub não verificou conta. |
| 8 | `remediation/remaining-entitlements-operating-core-2026-09-15` | [#53](https://github.com/trydavidqix/Lumenva/pull/53) | não criado | Vercel CRM `fail` — deployment blocked; website `fail` — GitHub não verificou conta; Preview Comments `pass`. |
| 9 | `remediation/wave2-agent-birth-2026-09-15` | [#54](https://github.com/trydavidqix/Lumenva/pull/54) | não criado | Vercel website `fail` — GitHub não verificou conta. |
| 10 | `remediation/wave3-session-runtime-2026-09-15` | [#55](https://github.com/trydavidqix/Lumenva/pull/55) | não criado | Vercel website `fail` — GitHub não verificou conta. |
| 11 | `remediation/waves-1-9-2026-09-15` | [#56](https://github.com/trydavidqix/Lumenva/pull/56) | não criado | Vercel website `fail` — GitHub não verificou conta; nenhum run `ci.yml`. |
| 12 | `remediation/waves-6-9-2026-09-15` | [#57](https://github.com/trydavidqix/Lumenva/pull/57) | não criado | Vercel website `fail` — GitHub não verificou conta; nenhum run `ci.yml`. |
| 13 | `remediation/waves-10-15-2026-09-15` | [#58](https://github.com/trydavidqix/Lumenva/pull/58) | não criado | Vercel website `fail` — GitHub não verificou conta; nenhum run `ci.yml`. |
| 14 | `remediation/business-os-operating-core-2026-09-15` | [#59](https://github.com/trydavidqix/Lumenva/pull/59) | não criado | Vercel website `fail` — GitHub não verificou conta; nenhum run `ci.yml`. |
| 15 | `remediation/business-os-reconcile-equivalence-2026-09-15` | [#60](https://github.com/trydavidqix/Lumenva/pull/60) | não criado | Vercel website `fail` — GitHub não verificou conta; nenhum run `ci.yml`. |
| 16 | `remediation/business-os-acceptance-mcp-2026-09-15` | [#61](https://github.com/trydavidqix/Lumenva/pull/61) | não criado | Vercel website `fail` — GitHub não verificou conta; nenhum run `ci.yml`. |

Diagnóstico objetivo: `gh api repos/trydavidqix/Lumenva/actions/permissions` retornou `enabled=false`, enquanto `gh api repos/trydavidqix/Lumenva/actions/workflows/ci.yml` retornou o workflow `ci` em estado `active`. Portanto o workflow existe e está ativo como definição, mas a execução de GitHub Actions está desabilitada no repositório. `gh run list --workflow ci.yml` não encontrou nenhum run novo após a abertura dos 16 PRs. Os checks Vercel são integrações externas e não substituem os gates de `ci.yml`; nenhum resultado Vercel foi usado para marcar testes do projeto como passados.

Pendência administrativa do dono: habilitar GitHub Actions nas configurações do repositório (Settings → Actions → General) ou delegar essa ação a um administrador. Depois disso, os PRs já abertos deverão ser reexecutados/atualizados pelo GitHub; somente então registrar no ledger o URL e o resultado real de cada run. Nenhuma tentativa de habilitar Actions ou rerun foi feita.

## Auditoria manual extra de segurança — 16 branches — 2026-09-15

Escopo revisado manualmente contra `origin/main`: `supabase/baseline.sql`, migrations 0161/0164/0170/0171, `authorize-module.ts`, `adapter.ts`, rotas de entitlement e o diff manual de `approval.ts`. Não foi usado resultado de CI inexistente como evidência; `node_modules`/`tsc` também não estão disponíveis localmente, então os itens de compilação abaixo são análise estática.

### Achados reais

1. **Alto — hardening de entitlements amplia indevidamente a autoridade de membros do tenant.** A migration 0161 define `organization_plan_platform_write` como `for all` somente para `fn_is_platform_admin()` (linhas 51–52) e `entitlement_events` somente com leitura/inserção para membros (linhas 53–56). A migration 0170 adiciona `organization_plan_tenant_all` e `entitlement_events_tenant_all`, ambos `for all to authenticated`, com `using/with check` apenas no pertencimento à organização (linhas 10–20). Como as policies permissivas anteriores não são removidas, policies são combinadas por OR: qualquer usuário autenticado da organização pode inserir/alterar/remover sua atribuição de plano e editar/apagar eventos de entitlement. Isso permite autoelevação de módulos e adulteração do ledger de auditoria. Evidência: `nl -ba supabase/migrations/20260911100000_0161_entitlements_catalog.sql | sed -n '49,56p'` e `nl -ba supabase/migrations/20260915090000_0170_tenant_rls_hardening.sql | sed -n '10,20p'`. **Corrigido no commit `4f0552da`**, com migration nova `20260915110000_0172_tenant_rls_entitlement_policy_fix.sql`, que remove as policies amplas e recria leitura/insert tenant-scoped e escrita de `organization_plan` apenas para `fn_is_platform_admin()`; a migration 0170 não foi editada.

2. **Alto — `approval.ts` usa `compareAndSet` que não existe em `ApprovalStore`.** A interface declarava somente `save` e `load`, mas três caminhos acessavam `store.compareAndSet`. A única implementação estava num test fake; não foi encontrada implementação de produção desse contrato por `rg`. **Contrato corrigido no commit separado desta remediação**, adicionando `compareAndSet(id, expectedStatus, next): Promise<boolean>` e atualizando todos os fakes do contrato com semântica atômica. O store de produção concreto desse port ainda não existe no repositório; isso permanece pendência real para wiring de persistência durável, sem adapter inventado. O teste Vitest não pôde iniciar neste sandbox por DNS/cache npm; requer execução no Codex Cloud após `pnpm install`.

3. **Alto — decisão de approval continua load-then-save e pode perder a primeira decisão concorrente.** `decideApprovalRequest` lia o status, aceitava qualquer `pending` e gravava a decisão sem `compareAndSet`. O lock em memória de `enforceApprovalDecision` não protege `decideApprovalRequest` nem processos distintos. **Corrigido no terceiro commit separado desta remediação**: a transição `pending → approved|denied` agora usa `store.compareAndSet`; quando perde, retorna o vencedor persistido sem sobrescrevê-lo. O teste concorrente existente em `wave1-policy-edges.test.ts` cobre duas decisões simultâneas e exige uma única vencedora. A validação Vitest depende do gate Cloud porque o runner não está instalado localmente; verificação estática confirmou ausência de `save(next)` no caminho.

4. **Médio/probabilidade alta — tabelas de tenant usam `organization_id text` sem restrição UUID, enquanto policies comparam contra `fn_user_org_ids()` (`uuid`).** `asset_license_records` e `browsermesh_event_idempotency` declaram `organization_id text` (migration 0164 linhas 1–10; baseline linhas 10753–10761). Suas policies iniciais comparam diretamente esse texto ao conjunto UUID (0164 linhas 14–16; baseline linhas 10765–10768), e o hardening faz cast direto `organization_id::uuid` para BrowserMesh (0170 linhas 34–38). Há teste/documentação para proteger linhas text legadas em `hermes_tool_loop_locks`, mas não há a mesma guarda regex nessas duas tabelas. O risco é erro de resolução de operador ou erro de cast quando houver dado não-UUID, em vez de isolamento fail-closed; requer confirmação no Postgres real. Evidência: `rg -n -C 2 'organization_id text|organization_id::uuid|fn_user_org_ids' supabase/baseline.sql supabase/migrations/20260913170000_0164_asset_license_records.sql supabase/migrations/20260915090000_0170_tenant_rls_hardening.sql`. **Não classificado como falha de execução sem o gate Postgres**, mas mantido como achado para o teste de migração/RLS.

### Resultado da auditoria

A causa do Vercel ficou comprovada separadamente: todos os 16 heads usam autor/committer `david@MacBookAir.lan`; a API GitHub retorna `author=null`, `committer=null` e `verification.reason=unsigned`, enquanto o usuário autenticado é `trydavidqix`. Isso explica diretamente o check `GitHub couldn't verify an account for the commit`; não é evidência de bug de código. Nenhum commit foi reescrito porque isso exigiria alterar histórico/forçar push e não foi solicitado.

Não foram encontrados, nesta revisão estática, outros bugs confirmados de RLS cross-tenant além da ampliação de privilégios de entitlements. A confirmação final dos itens SQL depende de Postgres real; Actions e Codex Cloud continuam bloqueados e nenhum teste automatizado foi falsamente marcado como verde.

## Verificação local sem DNS — evidência adicional

Foi investigada a possibilidade de executar testes reais sem baixar dependências. Resultado objetivo:

| Comando | Resultado real |
|---|---|
| `pnpm install --offline --frozen-lockfile --ignore-scripts` (antes da correção) | `rc=1`; abortava porque faltavam os importers de `packages/skill-registry` e `packages/tool-registry`. Correção aplicada em `f6e4400d`. |
| `bash apps/crm/tests/shell/update-guard.test.sh` | Primeira execução: `rc=1`, 18 asserções falharam porque a fixture não copiava `_env-alias.sh`; correção da fixture em `dda862f9`. Segunda execução: `rc=0`, zero falhas, `OK — todas as provas passaram`. |
| `node --test apps/crm/scripts/check-harness-consistency.test.mjs` | `rc=0`; 12 testes, 12 pass, 0 fail. Este é o único teste real executado com sucesso nesta sondagem, sem dependências externas. |
| `pg_isready` | `rc=2`; `/tmp:5432 - no response`; não há Postgres local pronto. |
| `supabase status` | `rc=1`; falhou ao gravar `/Users/david/.supabase/telemetry.json.tmp...` com `EPERM`; não é prova de serviço ativo. Docker também não está instalado (`docker=absent`). |

Conclusão: existem duas provas locais úteis e aprovadas (harness Node 12/12 e update-guard completo); não há runner Vitest nem banco local disponível. O lockfile agora está estruturalmente consistente, mas o cache offline não contém metadata de terceiros; nenhum resultado Cloud foi marcado como sucesso com base nesta sondagem.

### Atualização do lockfile e pré-condição Cloud

Comparação dos cinco manifests de packages com `pnpm-lock.yaml`: `packages/agent-runtime`, `packages/prompt-compiler` e `packages/operating-core` já tinham importer; `packages/skill-registry` e `packages/tool-registry` estavam ausentes e foram adicionados em `f6e4400d`. Foram adicionados somente estes dois importers vazios, porque ambos declaram apenas `typecheck` e nenhuma dependência:

```yaml
  packages/skill-registry: {}
  packages/tool-registry: {}
```

Evidência após a correção: `pnpm install --offline --frozen-lockfile --ignore-scripts` passou da validação de lockfile (`Lockfile is up to date, resolution step is skipped`) e falhou depois com `ERR_PNPM_NO_OFFLINE_META` para `@babel/helpers` no cache local. Não houve alteração de dependências de terceiros. O comando exato a executar no Codex Cloud antes dos 16 gates é:

```bash
pnpm install
```

Depois que esse install sem `--frozen-lockfile` concluir com sucesso e persistir qualquer metadata/ajuste necessário, executar os 16 comandos consolidados acima. O `pnpm install --offline --frozen-lockfile` não pode ser reportado como sucesso local enquanto o metadata de `@babel/helpers` não estiver no cache.

## Diagnóstico de segurança — round-trip de senha com aspa simples

O caso foi reproduzido sem rede e sem alterar produção. `install.sh:412` serializa valores com `envq`, produzindo para `se'nha` a linha válida de shell `SENHA='se'\''nha'`. Na releitura, `load_env` em `_common.sh:253-264` remove as aspas externas e tenta desfazer o escape na substituição da linha 263, mas o padrão não é a inversa byte-a-byte do formato emitido. A reprodução real devolveu:

```text
serialized: 53 45 4e 48 41 3d 27 73 65 27 5c 27 27 6e 68 61 27
expected:   se'nha
loaded:     se"'"nha
loaded_bytes: 73 65 22 27 22 6e 68 61
```

Causa raiz: o encoder usa o escape POSIX `'''`, enquanto o decoder antigo transformava a sequência em artefatos de aspas duplas (`"'"`) em vez de remover somente a camada sintática. Impacto confirmado: corrupção silenciosa de segredos com aspa simples, podendo causar falha de autenticação/connection string depois, longe do parser. O caminho `load_env` não usa `eval`/`source`, então esta reprodução não demonstrou execução de código; ainda assim era uma vulnerabilidade de integridade/secreto. Correção aplicada em `3d8b07bf`: decoder por varredura byte a byte que reconhece exatamente `\\'` na forma POSIX emitida por `envq`. TDD real: RED `rc=1` com `expected=[se'nha] actual=[se"'"nha]`; GREEN `rc=0` com `round_trip=[se'nha]`. A suíte ampla posterior também confirmou `com aspa simples` verde.

## Verificação das 44 refs F após remediação

Checagem independente executada sem reprocessar F: `F_rows=44`, `sha_missing=0`, `ancestor_of_main=39`, `distinct_trees=37`, `duplicate_tree_groups=5`, `non_ancestor_F=5`, `non_ancestor_covered_by_duplicate_tree=5`, `non_ancestor_unexplained=0`. As 39 refs ancestrais não possuem divergência contra `origin/main`; as 5 restantes são integralmente cobertas por cinco grupos de árvores duplicadas já identificados. A classificação F permanece consistente e nenhuma F foi convertida em M/P.

## Verificação de limpeza sem alteração de conteúdo

Em 2026-09-15 foi executado `git worktree list --porcelain`: todos os 16 worktrees de remediação e os 20 worktrees de etapas estão registrados; não há diretório `.worktree-*` órfão no workspace. A varredura de `git status --porcelain` em todos os worktrees encontrou somente a modificação preexistente `docs/Current-State.md`. Os diretórios `scratchpad-*` presentes em branches de Wave são arquivos versionados e foram preservados. A árvore `main` possui `.DS_Store`, `.obsidian/` e `Lumenva-Knowledge/` não versionados, fora do escopo desta tarefa; não foram tocados. Nenhum cleanup destrutivo foi executado.
