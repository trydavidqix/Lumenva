# Auditoria aprofundada — Agent OS / Fase 2 no contexto da Fase 7

**Data:** 2026-09-01  
**Checkout:** `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
**Regra aplicada:** somente leitura de Git; nenhum fetch, merge, rebase, cherry-pick, checkout ou remoção executado.

## Conclusão

`agent-os-phase-7-durable-benchmark` local (`1c75f7e1`) está um commit à frente de `origin/agent-os-phase-7-durable-benchmark` (`f40725a3`). A diferença é exclusivamente o commit `1c75f7e1`, que torna `test:db`/`test:invariants` compatíveis com Docker e Postgres nativo.

Esse commit **não deve ser cherry-picked para `main`**: o estado final desses oito arquivos já está presente em `main` por uma implementação equivalente (`7fe2929c`) e correções posteriores (`e91f2401`, `3865ae34`, `f3acf706`). O patch-id não é igual porque a implementação evoluiu em commits distintos, mas a comparação da árvore final e o histórico dos caminhos confirmam que a capacidade já foi absorvida. Reaplicá-lo criaria regressão/duplicação, não uma integração da Fase 2.

A Fase 7 contém a linha acumulativa anterior por conteúdo/histórico (incluindo o plano da Fase 2 em `12a2bc32`), mas os tips das refs de Fases 2–6 não são ancestrais diretos do tip da Fase 7; portanto, não usar ancestry simples como prova de integração. A decisão correta é tratar a Fase 7 como candidata de linha acumulativa e selecionar apenas patches cujo conteúdo ainda não exista no `main` atual.

## Estado observado

- `main`: `5336a6a8f7ebda373938fdb7148206b624a2de61`, árvore suja preexistente.
- `agent-os-phase-7-durable-benchmark`: `1c75f7e1d5fd6de7f0a9c9b5d7b47716ef9e53f5`.
- `origin/agent-os-phase-7-durable-benchmark`: `f40725a38c372383be300215c90e5b122f7d9410`.
- Base comum local/remota da Fase 7: `f40725a3`; divergência: 1 commit local.
- `main` já contém a cadeia Docker/native em `7fe2929c` e os fixes posteriores de harness.
- O worktree da Fase 7 está ativo em `.worktrees/agent-os-phase-7-durable-benchmark`; preservar.

## Delta local contra `origin/agent-os-phase-7-durable-benchmark`

Commit único:

`1c75f7e1 fix(test-db): make test:db/test:invariants Docker-agnostic`

Arquivos alterados (8):

- `scripts/test-db.sh`
- `tests/invariants/ai-platform-foundation.test.ts`
- `tests/invariants/gov-helpers.ts`
- `tests/invariants/lead-activities-barramento.test.ts`
- `tests/invariants/lead-owner-kind.test.ts`
- `tests/invariants/pg-exec.ts` (novo)
- `tests/invariants/retorno-anti-morte.test.ts`
- `tests/invariants/rls-isolation.test.ts`

Delta medido: **8 arquivos, +155/-155 linhas**. O commit declara fallback para Postgres nativo via `initdb/pg_ctl`, transporte único em `pg-exec.ts`, timezone UTC e verificação local de 73/73 arquivos e 498/499 testes. Essa alegação é apenas metadado do commit; não foi reexecutado teste nesta auditoria.

## Duplicação já absorvida em `main`

Histórico dos mesmos caminhos em `main`:

1. `7fe2929c fix(test-db): make test:db/test:invariants Docker-agnostic on main`.
2. `e91f2401 fix(test-db): cada rodada vazava 2 volumes do Docker — 24 GB até o disco encher`.
3. `3865ae34 fix(test-db): o test:db brigava por porta fixa e confiava numa árvore que se mexia`.
4. `f3acf706 fix(harness): mktemp sem X não existe no Linux — o CI caiu em 22 segundos`.

A árvore de `main` e a árvore da Fase 7 local não apresentam delta nos oito caminhos do commit `1c75f7e1`; logo, o efeito funcional já está no `main`, com correções adicionais. O `git patch-id --stable` de `1c75f7e1` (`5a716fb1…`) difere do de `7fe2929c` (`4b4969b5…`) por serem patches escritos contra bases/estados diferentes; isso não invalida a comparação de conteúdo final.

## Histórico acumulativo das Fases 2–6 e planning/verification

Refs observadas:

- implementação/planning: `origin/agent-os-implementation-plan` = `12a2bc32`;
- Fase 2 Kernel: `origin/agent-os-phase-2-kernel` = `8ff7c402`;
- Fase 3 Product Agents: `origin/agent-os-phase-3-product-agents` = `fee44013`;
- Fase 4 planning: `origin/agent-os-phase-4-shadow-evals-planning` = `7bb5c532`;
- Fase 4 execução: `origin/agent-os-phase-4-shadow-evals` = `63181a16`;
- Fase 5: `origin/agent-os-phase-5-assisted-autonomy` = `7ca817c2`;
- Fase 6: `origin/agent-os-phase-6-learning-flywheel` = `c89260f2`;
- verification: `origin/agent-os-verification` = `78543784`.

O tip da Fase 7 local tem como ancestral comum com essas linhas o commit de planejamento `12a2bc32`, não os tips de Fases 2–6. A cadeia de Fase 7, contudo, inclui commits de Agent OS das fases anteriores no seu histórico acumulativo e introduz o benchmark da Fase 7 em diante. Os comandos `git cherry` contra cada ref histórica exibem os commits da Fase 7 como novos nessa comparação; isso ocorre porque as refs são linhas paralelas/refotografias e não deve ser interpretado como autorização para reaplicar todos os commits.

Regra de integração resultante: comparar patch completo/árvore e dependências; não usar apenas nome, contagem ou ancestry. `agent-os-implementation-plan`/`phase-4-shadow-evals-planning` são documentos/subsets históricos; Fases 5–6 e `verification` carregam contratos e gates acumulativos. Cherry-pick indiscriminado da Fase 2, das fases posteriores e da Fase 7 duplicaria tipos, migrations, testes e documentação.

## Estado de verificação da Fase 7

Os documentos versionados em `docs/architecture/agent-os/phase-7-verification.md` e `phase-7-execution-status.md` mantêm decisão **INCOMPLETE**:

- current: 208/208, hard gates PASS;
- Inngest: 208/208, hard gates PASS;
- Vercel Workflow: 208/208, hard gates FAIL;
- o rerun pós-fix ainda está pendente;
- a tentativa mais recente parou no `pnpm typecheck` por artefato gerado inválido em `.next/dev/types/routes.d.ts`;
- não há autorização para adoção/migração de provider.

Portanto, nem a presença do benchmark nem a documentação histórica GO das fases anteriores prova uma Fase 7 verde ou uma integração funcional em `main`.

## Recomendação ao orquestrador

1. Não integrar `1c75f7e1`; registrar como duplicata funcional já absorvida em `main`.
2. Preservar o worktree/branch da Fase 7 para revisão, sem apagar refs.
3. Para eventual consolidação, comparar os commits da Fase 7 contra `main` por patch e arquivos, excluindo o harness Docker/native já presente.
4. Exigir nova execução da cadeia `pnpm phase7:benchmark:all` em SHA exato, com `typecheck` limpo e os três engines reportados, antes de qualquer decisão de adoção.
5. Manter a decisão da Fase 7 como `INCOMPLETE`; não promover o estado histórico das Fases 2–6 para prova de runtime atual.

**Resultado da auditoria:** análise concluída; nenhuma operação Git de consolidação executada.
