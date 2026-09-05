# Plano de integração completa do Agent OS — auditoria 2026-09-01

## Escopo e estado do checkout

Auditoria somente leitura. Nenhum merge, push, checkout de `main` ou alteração de código foi executado. Checkout auditado: `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`; `main` em `f638ce8fc91f8cb6089aed875d34b66c5e1579cb`. O worktree já estava sujo apenas com `.maestri/` não rastreado; foi preservado.

As referências remotas estavam disponíveis localmente no momento da auditoria. Todas as sete referências têm `merge-base main <branch> = bdbd76703ea319dc84c85348c7a04dcf07799baf`; portanto `main` não é ancestral direto de nenhuma delas.

## Dependência real entre fases

| referência | tip | commits `main..tip` | merge-base com `main` | merge-base com a fase anterior | anterior é ancestral? |
|---|---:|---:|---:|---:|---|
| phase-2-kernel | `8ff7c402` | 164 | `bdbd7670` | — | — |
| phase-3-product-agents | `fee44013` | 194 | `bdbd7670` | `14f3da9c` | não |
| phase-4-shadow-evals | `63181a16` | 233 | `bdbd7670` | `c1fae5b9` | não |
| phase-5-assisted-autonomy | `7ca817c2` | 203 | `bdbd7670` | `14f3da9c` | não |
| phase-6-learning-flywheel | `c89260f2` | 278 | `bdbd7670` | `b6ebc94b` | não |
| phase-7-durable-benchmark | `f40725a3` | 234 | `bdbd7670` | `12a2bc32` | não |
| verification | `78543784` | 252 | `bdbd7670` | `12a2bc32` | não |

Conclusão: a ordem conceitual 2→3→4→5→6→7→verification é coerente com os nomes e com os commits de cada tema, mas as branches não são uma cadeia empilhada. Cada uma divergiu de snapshots diferentes e algumas removem o conteúdo da fase anterior. Não é seguro integrar os sete heads com sete merges sequenciais.

Evidência especialmente forte:

- phase-5 em relação a phase-4: `79 files changed, 2364 insertions(+), 5867 deletions(-)`; remove os módulos `lib/agent-engine/evals/*` e `product-agents/*`.
- phase-6 em relação a phase-5: `51 files changed, 4557 insertions(+), 460 deletions(-)`; acrescenta flywheel e a migration da Fase 6.
- phase-7 em relação a phase-6: `203 files changed, 32264 insertions(+), 14926 deletions(-)`; remove contratos de kernel, autonomia e flywheel e a migration da Fase 6.
- verification em relação a phase-7: `194 files changed, 17524 insertions(+), 35359 deletions(-)`; remove as rotas/durable benchmark e volta a adicionar contratos de kernel/autonomia/flywheel.

Essas remoções são incompatíveis com a interpretação “cada fase constrói em cima da anterior”. Devem ser tratadas como snapshots/linhas de trabalho, não como manifests de integração.

## Tamanho dos diffs contra `main`

Resultado de `git diff --stat main origin/<branch>` resumido pelo `--shortstat`:

- phase-2-kernel: **692 files changed, 11,193 insertions, 61,699 deletions**.
- phase-3-product-agents: **689 files changed, 11,675 insertions, 61,074 deletions**.
- phase-4-shadow-evals: **708 files changed, 15,079 insertions, 60,521 deletions**.
- phase-5-assisted-autonomy: **706 files changed, 12,647 insertions, 61,592 deletions**.
- phase-6-learning-flywheel: **748 files changed, 17,074 insertions, 61,922 deletions**.
- phase-7-durable-benchmark: **717 files changed, 32,000 insertions, 59,510 deletions**.
- verification: **744 files changed, 16,551 insertions, 61,896 deletions**.

Os números são grandes porque os heads estão ancorados no snapshot comum antigo e carregam renomes/remoções de outras linhas do produto. Não representam o delta limpo que deve entrar em `main`.

## Banco, tipos e superfícies compartilhadas

Migrations novas efetivamente adicionadas pelos snapshots:

- phase-2 (e repetidas nos snapshots 3–5 e verification):
  - `20260817003000_0086_agent_os_function_search_path_hardening.sql`
  - `20260817154000_agent_os_security_fix_trigger_search_path.sql`
  - `20260817163500_agent_os_lead_notes_idempotency.sql`
- phase-6: `20260818140000_agent_os_phase6_flywheel_proposal_types.sql`.
- phase-7: `20260819120000_0122_followup_enrollment_stats_rpc.sql`, `20260819130000_0123_agent_memory_tables.sql`, `20260819140000_0124_multi_model_catalog.sql`.
- verification: nenhuma migration nova; o snapshot remove as três migrations 0122–0124 quando comparado ao head de phase-7.

Todos os snapshots também modificam `supabase/baseline.sql`, `supabase/migrations/MANIFEST.md` e `lib/database.types.ts`. Portanto, a integração precisa reconciliar a tripla migration/baseline/manifest e regenerar tipos, nunca aceitar cegamente a versão de um head.

Rotas/API com sobreposição concreta:

- phase-6 altera `app/api/v1/ai/agents/[id]/proposals/[pid]/apply/route.ts`, `app/api/v1/ai/agents/[id]/proposals/route.ts` e `app/api/v1/ai/evolution/route.ts`.
- phase-7 altera essas mesmas três rotas e acrescenta `app/api/v1/ai/agents/context/route.ts`, `app/api/v1/cron/agent-memory-worker/route.ts`, `app/api/inngest/route.ts` e as três rotas `app/api/phase7/vercel-workflow/**`.
- phase-7 também altera `lib/database.types.ts`, `lib/agent-engine/contracts/deskcomm-execution-adapter.test.ts` e o manifesto de migrations.
- phase-2/3/4/5/verification carregam mudanças comuns em `lib/agent-engine/kernel/*`, `lib/agent-engine/contracts/agent-os.ts`, `lib/agent-engine/tools/gateway.ts`, `package.json`, `pnpm-lock.yaml`, `vitest.config.ts`/`vitest.agent-os.config.ts` e nos handlers de evolução. São conflitos prováveis, não arquivos independentes por fase.

## Duplicação da Fase 7 com a correção já em `main`

A branch local `fix/phase7-vercel-workflow-idempotency` está incorporada em `main` pelo commit `5bb299570c62a0a42eac5c30998a80c3d114b3c1`. A Fase 7 remota contém a versão anterior do mesmo arquivo:

`app/api/phase7/vercel-workflow/route.ts` — `git diff --numstat main origin/agent-os-phase-7-durable-benchmark`: **5 linhas adicionadas / 25 removidas** contra o estado atual de `main`.

O diff é exatamente a remoção do `Map<string, Promise<string>> deliveryRuns` e do tratamento de chave/erro, ou seja, reintroduz a duplicação de workflow que a correção eliminou. As demais 37 superfícies do commit de correção já estão presentes em `main`; não devem ser reaplicadas a partir do head remoto. Quantificação: **1 arquivo e 30 linhas de divergência**, com risco funcional de regressão de idempotência.

## Verificação isolada

Foi criada uma worktree detached temporária para phase-2, reutilizando o `node_modules` já existente (sem download). `pnpm typecheck` terminou com **RC=0**; apenas emitiu o aviso existente de `pnpm.overrides` no campo `package.json`.

As execuções isoladas seguintes começaram a consumir tempo excessivo no `tsc` compartilhando o `node_modules` por symlink; foram interrompidas para não manter processos e não há resultado confiável para phase-3 a verification. Estado correto: **phase-2 PASS; phase-3/4/5/6/7/verification NOT_PROVEN**, não “verde”. Não foi executado `pnpm install`, pois isso baixaria dependências sem autorização adicional; não foram executados `test:unit`, `lint`, `test:db` ou `build` nas branches remotas.

## Plano de integração recomendado

### Estratégia

1. **Não fazer merge dos heads diretamente.** Primeiro congelar os SHAs acima e produzir um manifest de commits/paths por fase a partir dos merge-bases temáticos. O alvo deve ser uma branch de integração nova baseada no `main` atual, nunca `main` diretamente.
2. Construir um baseline de phase-2 selecionando apenas commits e arquivos do kernel que ainda não existem em `main`; preservar o código de voz, RGPD, Content OS e migrations atuais de `main` que os snapshots antigos marcam como `D`.
3. Aplicar phase-3 (product agents), depois phase-4 (shadow evals), phase-5 (assisted autonomy), phase-6 (flywheel), phase-7 (durable benchmark) e verification como **cherry-picks/patches revisados**, resolvendo cada arquivo compartilhado manualmente. Em cada etapa, manter os módulos das fases anteriores; rejeitar deleções que só resultam do snapshot antigo.
4. Para phase-7, importar somente o delta durable benchmark que não está em `main` e manter a implementação idempotente atual de `app/api/phase7/vercel-workflow/route.ts`; não cherry-pickar a versão antiga de `f40725a3` sobre o fix `5bb29957`.
5. Incorporar a migration 20260818140000 da Fase 6 e as 0122–0124 da Fase 7 somente após verificar colisões de timestamp/semântica no baseline e manifest. Aplicar a regra da tripla e regenerar `lib/database.types.ts`.
6. Incorporar verification por último, preservando os componentes de revisão da Fase 6 e revalidando que não remove durable benchmark, autonomy ou flywheel.

### Gates por etapa

Após cada fase: `pnpm typecheck && pnpm lint && pnpm test:unit`. Após phase-6/phase-7 e qualquer mudança de schema: `pnpm test:db` (fresh baseline, update/idempotência e isolamento tenant). Após rotas/UI: `pnpm test:e2e` e evidência visual quando a jornada exigir. No fim: `pnpm lint:channels`, `pnpm lint:tenant-filter`, `pnpm gov:verify`, `pnpm build` e inspeção final do diff/estado Git.

Não usar Preview a cada fase; a regra do repositório reserva a validação de Preview para a etapa final, se ainda for necessária. GitHub Actions está desabilitado e não é gate disponível.

### Estimativa de esforço/risco

- Reconciliação inicial de manifests e phase-2: **4–8 h, risco alto** (692 arquivos no snapshot e conflitos de kernel/tipos).
- phase-3: **1–2 h, risco médio-alto** (13 módulos de product agents e contratos de wiring).
- phase-4: **1–2 h, risco médio** (11 módulos de evals e integração com kernel).
- phase-5: **3–5 h, risco alto** (autonomy toca kernel/policy/gateway e o snapshot contém deleções destrutivas).
- phase-6: **3–5 h, risco alto** (17 módulos flywheel, três handlers API, migration/baseline/tipos).
- phase-7: **5–8 h, risco muito alto** (203 arquivos de delta incremental, três migrations, Inngest/Vercel e conflito de idempotência já corrigido).
- verification: **2–4 h, risco médio-alto** (UI/hook/contratos de revisão e reconciliação para não reverter fases 5–7).
- gates finais e correções: **4–8 h**.

Estimativa total realista: **23–42 horas de engenharia**, em várias sessões/etapas com gates; não é uma integração segura de uma única sessão. O primeiro passo autorizado deve ser a criação da branch de integração e do manifest de commits/paths. Até essa reconciliação e os gates, estado de release: **NO-GO**.

## Comandos de evidência executados

`git merge-base main origin/<branch>`; `git merge-base origin/<phase-anterior> origin/<phase-atual>`; `git diff --stat main origin/<branch>`; `git diff --shortstat`; `git diff --name-status` para migrations, APIs e contratos; `git merge-tree --write-tree main origin/<branch>` (retorno `rc=1` em todos os sete heads, confirmando que não há merge limpo); `pnpm typecheck` isolado em phase-2.
