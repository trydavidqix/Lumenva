# Lumenva local/GitHub sync finalization — 2026-09-29

## Resultado terminal — 2026-09-29

- CI no HEAD sincronizado `076faaf3709a4e562ac87bb79fc4a1f7519a5c5d`: run `36599165338`, `verify` e `invariants` passaram.
- CI corrigido `36596747535` passou no SHA de código `a720df6d7cfe414db2aa46b234723e919fd5c10c`. Segurança report-only `36596747973` concluiu com sucesso; OSV/Semgrep passaram; 8 fingerprints históricos do Gitleaks continuam registrados.
- E2E `36599007496` terminou **failure**, mirando o código `a720df6d7cfe414db2aa46b234723e919fd5c10c`: validação visual das páginas de IA e parte 1 falharam; parte 2 teve 42 falhas e 8 aprovações, incluindo timeouts de navegação e seletor ambíguo para o título “Pipelines”. As rotas de IA produziram HTTP 500 por permissão negada em `fn_user_org_ids`. Nenhum teste foi enfraquecido. A comparação pareada anterior de main/candidate encontrou 0 falhas exclusivas do candidate em seus SHAs fixados; o E2E direto atual não é uma comparação de paridade.
- Prova local/remota: branch de integração igual ao remoto, árvore limpa, remoto com apenas `main` e `integration/lumenva-complete`, SHA da main inalterado, 21/21 worktrees Recovery limpas e bundles verificados. A suíte E2E segue vermelha e qualquer investigação/correção de comportamento do produto fica fora desta tarefa de sincronização.

## Scope and current Git state

- Target checkout: `C:\Users\David\Desktop\Projetos\Lumenva-Unification`.
- Remote: `https://github.com/trydavidqix/Lumenva.git`.
- Branch: `integration/lumenva-complete`.
- At audit start: local and remote both `96f5a5cdcd63883d3677fd04741fa6e0b68274ba`; working tree clean except this final evidence set.
- `main`: `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`; no changes or merge made.
- Remote heads at audit start: `main`, `integration/lumenva-complete`, and `vps-17455632840955604138`. The latter is not Lumenva product work and is scheduled for deletion only after its new tip is archived and this report is pushed.

## CRM checkout: 37 paths

The original checkout is `C:\Users\David\Desktop\Projetos\Lumenva`, branch `chore/orchestration-gate`, HEAD `cec5d7656fd341d29dfdf9de911cd2bb5564c6fd`.

| Class | Count | Treatment |
|---|---:|---|
| Agent rules/skills and Codex agent/hook proposals | 25 untracked files | Exact raw snapshots retained under `docs/archive/recovery-worktree-deltas/2026-09-29/untracked/Lumenva/`; selected useful guidance was separately published earlier. Incomplete governance hook proposals remain inert. |
| Modified `AGENTS.md` | 1 | Exact full file retained under `final-cleanup/tracked-working-tree/Lumenva/AGENTS.md`; SHA-256 `713318B7105865F5056C405D09493B395B012C8E7017FEBBA309C9C1CEBA187C`. |
| `.jules/cache` files | 11 | Not product code and not uploaded. Full external snapshot retained at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\local-cache-snapshot-2026-09-29\crm`; 301,772 bytes; inventory SHA-256 `47BE301D89B56E2A260FCF6F463688A3B5EBDC28D45020285036572E4C470093`. Index showed 20 completed sessions; no Jules process was found. |

The 25 non-cache files and the modified `AGENTS.md` are preserved before any local cleanup. The 37 count is file-level status, not 37 independent features.

## Recovery: 21 worktrees / 15 dirty

All 21 recovery worktrees remain registered and on their original recovery refs. Six were clean at audit. The 15 dirty ones classify as:

| Worktree(s) | Local delta | Decision/evidence |
|---|---|---|
| `lumenva-f1-identity-mapping-v2`, `lumenva-f3-task4`, `lumenva-f3-task6`, `lumenva-f5-task2-fix` | TypeScript `tsconfig.tsbuildinfo`; first also has generated Supabase `.temp/cli-latest` | Generated artifacts only; no product changes. |
| `lumenva-f3-rbac` | F3 plan plus Jules cache | Plan preserved in raw snapshots; cache copied outside repo. |
| `lumenva-f3-task1-lint` | Platform-admin guard, tests, route edits, F3 plan | Exact delta patch and new files preserved. Guard/test already exist in integration; do not apply duplicate patch. |
| `lumenva-f3-task3-lint` | Test edit and deleted temporary patch file | Exact patch preserved; temporary patch is not product code. |
| `lumenva-f4-auth-fix` | Deleted delegation skill plus build info | Exact tracked delta preserved; deletion not applied. |
| `lumenva-f4-j4-ci`, `lumenva-f4-j4-lint`, `lumenva-f5-task4-test-fix` | Competing auth-test edits; one staged deletion of `fix_test.sh` | Exact patches preserved; no blanket integration. |
| `lumenva-f4-j5-ci` | Firebase confirmation-route edit | Exact patch preserved; current integration was not overwritten. |
| `lumenva-f4-task6-review` | Broad auth edits/deletions, including tests and identity/redirect files | Preserved but rejected as incomplete/destructive; no deletion ported. |
| `lumenva-f5-task5-sidebar` | Two test edits | Exact patch preserved; no unproven behavior change ported. |
| `lumenva-f5-task6-final` | Route edits, event-visibility source/tests, several test changes/deletions | Exact patch/untracked snapshots preserved. Integration already has the event-visibility capability with stronger fail-closed handling. Proposed security test contradicts its own route delta (`createAdminClient` expectation vs route changed to `createClient`); not applied. |

The 11 patch-bearing worktrees have exact tracked-delta patches under `final-cleanup/patches/` (146,446 bytes total). Six untracked files from recovery worktrees were already captured separately; the F3 admin guard/test match integration, while F5 source/tests were not used to overwrite the stronger current implementation. Four cache/build-only trees are not useful source. No worktree branch/HEAD is deleted or rewritten.

The F3 Jules cache is preserved outside Git at `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\local-cache-snapshot-2026-09-29\recovery-lumenva-f3-rbac`; 16 files, 4,229,623 bytes, inventory SHA-256 `94E0E269347960218E090127676ED49694EBA9DED83E83F21BD698BA13A55AE4`. Its index includes completed, failed, and stale in-progress session records; these are historical cache data, not evidence of live work. No Jules process was found.

## VPS branch tip preservation

The frozen manifest records the original `vps-17455632840955604138` SHA `b43a5e0fc50f3a07645e80304c4174bd9f4d18fa`. Its currently observed remote tip is instead `c50375bdb0f633142f0136b3a3fe1aa3f7f74fb0`; the mismatch is explicitly recorded in the manifest addendum and the original frozen row is not rewritten. The supplemental bundle path, SHA-256, verify result, and content classification are recorded there. The later tip contains Nexus-owned work and unsafe Lumenva stubs; no useful CRM feature is missing because of it. Remote deletion is authorized by the Owner's stated target, but must occur only after the addendum is pushed and exact remote tip/bundle verification is repeated.

## CI and E2E evidence

- Existing CI run `36541103963`, parity run `36541107625`, and report-only security run `36541133755` succeeded at their recorded tested code SHA `db52970416dbc0118c51d8964e6c0ca9a93d8b43`.
- Paired E2E runs `36541111186` (main) and `36541115754` (candidate) both failed. Normalized failures: 51 main, 43 candidate, 8 main-only, **0 candidate-only**. E2E remains red and is not called green.
- The workflow `Lumenva Core gates` is not present at the integration ref, so `gh workflow view 363920726 --ref integration/lumenva-complete` failed with “could not find workflow file lumenva-core.yml”. An applicable check must be selected from workflows actually present on the final integration ref; no check result is claimed for the current docs/archive edits.
- Heavy suites are not run locally. Do not weaken tests or conceal the E2E result.

## Completion gates still required

1. **Published:** evidence/report/manifest commit `0f4e0b644693d851cd8bd1be76451d980439b13a` is on `origin/integration/lumenva-complete`.
2. **Reconciled:** all 25 CRM source files hash-match their Git snapshots; `AGENTS.md` is restored after the full changed file was archived. CRM caches were verified against external copies. All 21 Recovery worktrees now have clean Git status; the untracked originals were moved to `C:\Users\David\Documents\Recovery\Lumenva\pre-unification\local-cleanup-2026-09-29` (65 files, 16,817,338 bytes) and hash-compared with raw snapshots where available. No worktree/commit/ref was deleted.
3. **Branch cleanup:** the exact c503 VPS tip was reverified against its supplemental bundle and then deleted. `git ls-remote --heads origin` now returns exactly `main` and `integration/lumenva-complete`.
4. **Actions:** corrected CI `36596747535` passou em `a720df6d7cfe414db2aa46b234723e919fd5c10c`; CI no HEAD sincronizado `076faaf3709a4e562ac87bb79fc4a1f7519a5c5d` também passou (`36599165338`). Segurança report-only `36596747973` concluiu com sucesso; OSV/Semgrep passaram. Gitleaks registrou 8 fingerprints históricos (7 caminhos de fixtures e a constante `ACK_TOKEN_ALPHABET`); permanecem documentados, sem supressão. CI inicial `36594231222` revelou descoberta de teste arquivado; a correção mínima excluiu `docs/archive/**` da descoberta Vitest.
5. **E2E:** execução `36599007496` terminou failure no código `a720df6d7cfe414db2aa46b234723e919fd5c10c`. A validação das páginas IA e parte 1 falharam; parte 2 teve 42 falhas/8 aprovadas, com timeouts e seletor “Pipelines” ambíguo. As páginas IA incluem HTTP 500 por `permission denied for function fn_user_org_ids`. Falhas mantidas sem enfraquecer testes. A comparação pareada anterior encontrou 0 falhas exclusivas do candidate em seus SHAs fixados; esta execução direta não faz paridade com main.
6. **Prova final:** integração local = remoto em `076faaf3709a4e562ac87bb79fc4a1f7519a5c5d`; árvore limpa; 21/21 worktrees Recovery limpas; exatamente duas branches remotas; main inalterada; bundles verificados. A falha E2E está registrada sem ser chamada de verde.
