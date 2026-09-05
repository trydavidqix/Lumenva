# Auditoria de branches — DeskcommCRM

**Data:** 2026-08-31  
**Repositório auditado:** `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`  
**Ponta de integração usada:** `main` em `56260cea`  
**Remoto observado:** `origin/main` também em `56260cea`

## Refinamento acionável — inventário e candidatos de limpeza

Esta seção refina o relatório sem alterar a auditoria original. Inventário continua atual para as refs presentes localmente em 2026-08-31: **130 refs** — 18 locais, 42 `origin/*`, 70 `upstream/*`. Nenhuma remoção, merge, push, fetch ou alteração de worktree foi feita.

### Lista final: PODE APAGAR JÁ (somente após autorização do orquestrador)

“Pode apagar já” abaixo significa segurança de conteúdo/histórico com base nas provas desta auditoria. Ainda exige autorização para a operação de apagar a ref.

#### (a) Branches locais ancestrais de `main`, sem commit único e sem worktree ativo — 4

Para cada branch, `git rev-list --count BRANCH --not main` retornou `0` e:

```bash
git merge-base --is-ancestor BRANCH main
# exit 0
```

Nenhuma das quatro aparece como branch ativa em `git worktree list`:

```text
codex/agent-os-crm-integration-plan
codex/crm-consolidated
implementacao-tokens-voice-core
sync/upstream-cherrypicks
```

`main` fica preservada. Branches ancestrais ligadas a worktree (`codex/voice-architecture-audit`, `codex/voice-media-integration`, `codex/voice-migration-fix`, `codex/voice-unify-media-2026-08-29` e `worktree-agent-a39b36ce7ff4128ec`) ficam fora desta lista.

#### (b) Refs `origin/*` com duplicata exata e outra ref preservada — 18

Estes nomes têm SHA idêntico a outra ref do mesmo grupo. Preservar os nomes canônicos indicados; conteúdo permanece disponível no SHA preservado:

```text
# Preservar origin/implementacao-tokens (7018bc4e)
origin/implementacao-tokens-voice-core-baseline
origin/implementacao-tokens-voice-core-red-task1
origin/implementacao-tokens-voice-core-red-task1-base
origin/implementacao-tokens-voice-core-red-task1-ci
origin/implementacao-tokens-voice-core-red-task1-run
origin/voice-core-implementation
origin/voice-core-red-task5

# Preservar origin/implementacao-tokens-voice-core-e2e-final (eb9e35dc)
origin/implementacao-tokens-voice-core-e2e-final2
origin/implementacao-tokens-voice-core-e2e-final3
origin/implementacao-tokens-voice-core-e2e-final4
origin/implementacao-tokens-voice-core-e2e-red
origin/implementacao-tokens-voice-core-e2e-red-base
origin/implementacao-tokens-voice-core-e2e-red-ci
origin/implementacao-tokens-voice-core-e2e-red-run
origin/implementacao-tokens-voice-core-e2e-sim
origin/implementacao-tokens-voice-core-e2e-tests
origin/implementacao-tokens-voice-core-e2e-work
origin/implementacao-tokens-voice-core-safety-snapshot
```

Não incluir `origin/main`: é ref canônica de produção. As refs `origin/*` que têm apenas uma ocorrência remota, embora dupliquem uma branch local (`origin/codex/crm-consolidated`, `origin/sync/upstream-cherrypicks`, `origin/gpt-lumenva-content-os`, `origin/implementacao-tokens-voice-core`), ficam fora desta lista conservadora; apagar o nome remoto ainda pode ter efeito operacional apesar do SHA igual.

**Contagem final “pode apagar já”: 22 refs (4 locais + 18 `origin/*`).**

### Duplicatas — grupos completos, nomes exatos

Verificação por SHA final:

```text
54e86839
  codex/agent-os-crm-integration-plan
  worktree-agent-a39b36ce7ff4128ec

ec47df9f
  codex/crm-consolidated
  codex/voice-unify-media-2026-08-29
  origin/codex/crm-consolidated

160bd616
  sync/upstream-cherrypicks
  origin/sync/upstream-cherrypicks

cda205c9
  gpt-lumenva-content-os
  origin/gpt-lumenva-content-os

d3c97cbd
  codex/voice-architecture-audit
  origin/implementacao-tokens-voice-core

7018bc4e
  origin/implementacao-tokens
  origin/implementacao-tokens-voice-core-baseline
  origin/implementacao-tokens-voice-core-red-task1
  origin/implementacao-tokens-voice-core-red-task1-base
  origin/implementacao-tokens-voice-core-red-task1-ci
  origin/implementacao-tokens-voice-core-red-task1-run
  origin/voice-core-implementation
  origin/voice-core-red-task5

eb9e35dc
  origin/implementacao-tokens-voice-core-e2e-final
  origin/implementacao-tokens-voice-core-e2e-final2
  origin/implementacao-tokens-voice-core-e2e-final3
  origin/implementacao-tokens-voice-core-e2e-final4
  origin/implementacao-tokens-voice-core-e2e-red
  origin/implementacao-tokens-voice-core-e2e-red-base
  origin/implementacao-tokens-voice-core-e2e-red-ci
  origin/implementacao-tokens-voice-core-e2e-red-run
  origin/implementacao-tokens-voice-core-e2e-sim
  origin/implementacao-tokens-voice-core-e2e-tests
  origin/implementacao-tokens-voice-core-e2e-work
  origin/implementacao-tokens-voice-core-safety-snapshot

56260cea
  main
  origin/main
```

São **8 grupos de SHA idêntico**. Patch-id também confirmou relações de subset/superset nas linhas Agent OS e equivalência semântica entre as fatias de voz e `codex/voice-media-integration`; essas relações não são usadas para a lista “pode apagar já” quando o SHA não é idêntico.

### Lixo candidato — nomes exatos; não apagar nesta fase

“Lixo” significa temporário, triagem, snapshot ou Dependabot provavelmente obsoleto. É candidato de limpeza, não autorização de remoção. Primeiro preservar patches necessários e confirmar PR/worktree.

#### `origin/*`

```text
origin/implementacao-tokens-voice-core-e2e-final
origin/implementacao-tokens-voice-core-e2e-final2
origin/implementacao-tokens-voice-core-e2e-final3
origin/implementacao-tokens-voice-core-e2e-final4
origin/implementacao-tokens-voice-core-e2e-red
origin/implementacao-tokens-voice-core-e2e-red-base
origin/implementacao-tokens-voice-core-e2e-red-ci
origin/implementacao-tokens-voice-core-e2e-red-run
origin/implementacao-tokens-voice-core-e2e-sim
origin/implementacao-tokens-voice-core-e2e-tests
origin/implementacao-tokens-voice-core-e2e-work
origin/implementacao-tokens-voice-core-safety-snapshot
origin/implementacao-tokens-voice-core-red-task1
origin/implementacao-tokens-voice-core-red-task1-base
origin/implementacao-tokens-voice-core-red-task1-ci
origin/implementacao-tokens-voice-core-red-task1-run
origin/voice-core-red-task5
origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0
origin/dependabot/npm_and_yarn/minor-and-patch-9d1c807f9a
```

Contagem `origin` lixo candidato: **19**. Os 18 primeiros são duplicatas exatas cobertas acima; os dois Dependabot têm 1 commit único cada e precisam de decisão de merge/fecho antes de remoção. `voice-core-red-task5` também é duplicata exata do grupo `7018bc4e`.

#### `upstream/*`

```text
upstream/tmp-api
upstream/tmp-g2
upstream/tmp-sch
upstream/tmp-ui
upstream/tmp-ui2
upstream/tmp-verify
upstream/triagem/275
upstream/triagem/322
upstream/triagem/326
upstream/triagem/327
upstream/triagem/327b
upstream/triagem/c202-demandas
upstream/triagem/pr198-testes-de-borda
upstream/triagem/pr201-reprodutor
upstream/triagem/wconf-194-200
upstream/triagem/wconf-194-201
upstream/rebase-52
upstream/resolve-51
upstream/ci/e2e-serial
upstream/debug/mfa-reset
upstream/pr121
upstream/pr126
upstream/pr127
upstream/release/v1.1.0
```

Contagem `upstream` lixo candidato: **24**. Essas refs pertencem a espelho histórico divergente (`upstream/main` em `2674611d`); não usar apenas contagem relativa à `main` local para decidir descarte.

**Total lixo candidato: 43 refs.** Há sobreposição intencional com duplicatas; não somar essa categoria à lista “pode apagar já”.

## Aprofundamento das 43 refs lixo candidato

### Mudança de inventário desde a auditoria anterior

O estado local mudou depois do inventário de 2026-08-31. Das 19 refs `origin/*` originalmente marcadas, somente estas ainda existem com esses nomes/SHA:

```text
origin/implementacao-tokens-voice-core-e2e-final  eb9e35dc
origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0 775b1f3e
```

`origin/dependabot/npm_and_yarn/minor-and-patch-9d1c807f9a` não existe mais; há ref substituta `origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167` em `8113eedc`, criada em 2026-08-30 com bump de 33 atualizações. As outras 16 refs `origin/*` do conjunto original também não estão presentes. Não foi feito `fetch`; portanto não se presume se foram apagadas no servidor ou apenas deixaram de estar nas refs locais.

Para refs ausentes, os quatro testes atuais são **não executáveis**. Elas não entram em “pode apagar já”; exigem decisão humana ou confirmação remota.

### Critério aplicado

- **Ancestral:** `git merge-base --is-ancestor REF main` com código `0`.
- **Trabalho único:** `git rev-list REF --not --all-outras-refs`; a contagem abaixo mede commits não alcançáveis por qualquer outra ref atualmente presente.
- **Worktree:** comparação exata com branches exibidas por `git worktree list --porcelain`.
- **Valor:** temporário/obsoleto só quando histórico e ausência de dependência dão suporte; divergência de `upstream/main` impede conclusão automática.

### (a) PODE APAGAR JÁ — 1 ref

```text
origin/implementacao-tokens-voice-core-e2e-final
  tipo: origin/*
  ancestral de main: SIM (exit 0)
  trabalho único: NÃO (0 commits fora de outras refs)
  worktree ativo: NÃO
  valor: snapshot canônico já ancestral; sem duplicata atual, mas conteúdo já está em main
```

Esta é a única ref das 43 com prova atual suficiente para o critério rígido. Remoção ainda depende da autorização operacional já concedida para este refinamento.

### (b) PRECISA DE DECISÃO HUMANA — 42 refs

#### Refs `origin/*` ausentes no inventário atual — 16

Todas tinham sido classificadas como duplicatas/snapshots na auditoria anterior, mas não existem mais localmente. Status: ancestral/trabalho/worktree **não verificáveis agora**; valor histórico **ambíguo**. Não apagar com base em ausência local.

```text
origin/implementacao-tokens-voice-core-e2e-final2
origin/implementacao-tokens-voice-core-e2e-final3
origin/implementacao-tokens-voice-core-e2e-final4
origin/implementacao-tokens-voice-core-e2e-red
origin/implementacao-tokens-voice-core-e2e-red-base
origin/implementacao-tokens-voice-core-e2e-red-ci
origin/implementacao-tokens-voice-core-e2e-red-run
origin/implementacao-tokens-voice-core-e2e-sim
origin/implementacao-tokens-voice-core-e2e-tests
origin/implementacao-tokens-voice-core-e2e-work
origin/implementacao-tokens-voice-core-safety-snapshot
origin/implementacao-tokens-voice-core-red-task1
origin/implementacao-tokens-voice-core-red-task1-base
origin/implementacao-tokens-voice-core-red-task1-ci
origin/implementacao-tokens-voice-core-red-task1-run
origin/voice-core-red-task5
```

#### Dependabot — 2 refs

```text
origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0
  ancestral de main: NÃO
  trabalho único: SIM, 1 commit (`775b1f3e`)
  worktree ativo: NÃO
  valor: decisão humana; bump ainda não provado como integrado

origin/dependabot/npm_and_yarn/minor-and-patch-9d1c807f9a
  ancestral/trabalho/worktree: não verificáveis; ref ausente
  valor: substituída localmente por `origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167`

Ref substituta observada:
origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167
  ancestral de main: NÃO
  trabalho único: SIM, 1 commit (`8113eedc`)
  worktree ativo: NÃO
  valor: recomendo manter até revisão/merge/fecho; é mais nova que a ref antiga
```

#### `upstream/*` — 24 refs

Todas têm `ancestral de main: NÃO` e `worktree ativo: NÃO`. O espelho `upstream/main` está em história divergente; portanto nenhuma pode ser promovida a “segura” só por parecer temporária. A coluna “únicos” é commits não alcançáveis por qualquer outra ref atualmente presente.

```text
upstream/tmp-api                         únicos 0   valor: temporária, mas precisa decisão
upstream/tmp-g2                          únicos 0   valor: temporária, mas precisa decisão
upstream/tmp-sch                         únicos 0   valor: temporária, mas precisa decisão
upstream/tmp-ui                          únicos 0   valor: temporária, mas precisa decisão
upstream/tmp-ui2                         únicos 0   valor: temporária, mas precisa decisão
upstream/tmp-verify                      únicos 0   valor: temporária, mas precisa decisão
upstream/triagem/275                     únicos 634 valor: trabalho histórico; revisar
upstream/triagem/322                     únicos 1   valor: patch único; revisar
upstream/triagem/326                     únicos 2   valor: patches únicos; revisar
upstream/triagem/327                     únicos 1   valor: patch único; revisar
upstream/triagem/327b                    únicos 1   valor: variante de triagem; revisar
upstream/triagem/c202-demandas            únicos 1   valor: patch único; revisar
upstream/triagem/pr198-testes-de-borda    únicos 2   valor: patches únicos; revisar
upstream/triagem/pr201-reprodutor         únicos 3   valor: patches únicos; revisar
upstream/triagem/wconf-194-200            únicos 1   valor: patch único; revisar
upstream/triagem/wconf-194-201            únicos 1   valor: patch único; revisar
upstream/rebase-52                       únicos 1   valor: ref de rebase; revisar
upstream/resolve-51                      únicos 2   valor: ref de resolução; revisar
upstream/ci/e2e-serial                    únicos 2   valor: patch/merge de CI; revisar
upstream/debug/mfa-reset                  únicos 3   valor: patches de debug; revisar
upstream/pr121                           únicos 43  valor: trabalho real de PR; manter até decisão
upstream/pr126                           únicos 1   valor: patch de PR; revisar
upstream/pr127                           únicos 2   valor: patches de PR; revisar
upstream/release/v1.1.0                  únicos 1   valor: release; manter até confirmar histórico
```

### (c) RECOMENDO MANTER — 1 ref

```text
origin/dependabot/npm_and_yarn/minor-and-patch-cc63521167
```

É a ref Dependabot mais nova observada (`8113eedc`, 2026-08-30), possui 1 commit único e não está mergeada em `main`. Manter até revisão explícita.

As 41 refs restantes da categoria (b) — 16 `origin/*` ausentes, a ref Dependabot antiga, o outro Dependabot e 24 `upstream/*` — precisam de decisão humana; nenhuma tem prova rígida suficiente para apagar agora.

### Contagem final desta análise

```text
(a) pode apagar já:       1
(b) decisão humana:      42
(c) recomendo manter:     1 (subconjunto sinalizado dentro de b)
```

As categorias (b) e (c) se sobrepõem por desenho: “recomendo manter” é recomendação forte dentro do conjunto que ainda exige decisão humana. Não executar remoção com base nesta seção sem confirmar refs atuais e aprovação do orquestrador.

## Escopo, limites e estado inicial

A auditoria foi iniciada no repositório correto, confirmado por:

```text
git rev-parse --show-toplevel
/Users/david/Desktop/Projetos/CRM/DeskcommCRM
```

Estado inicial preservado:

```text
## main...origin/main
?? .infisical.json
```

Há múltiplos worktrees, incluindo branches de voz e Agent OS. Nenhuma branch foi apagada, nenhum merge foi feito, e não foram executados `reset --hard`, `clean`, rebase destrutivo, force-push ou checkout forçado.

Os resultados refletem as refs já existentes localmente. `git fetch --all` não foi executado, porque isso baixaria objetos e atualizaria refs; essa ação requer autorização explícita.

## Método de classificação

Para cada ref em `refs/heads` e `refs/remotes` (excluindo o ponteiro simbólico `upstream/HEAD`), foram calculados:

- `git rev-list --count main..BRANCH`: commits à frente de `main`;
- `git rev-list --count BRANCH..main`: commits atrás de `main`;
- `git rev-list --count BRANCH --not main`: commits únicos ausentes de `main`;
- `git merge-base --is-ancestor BRANCH main`: prova de que a branch já está incorporada;
- `git diff --shortstat main...BRANCH`: tamanho do delta;
- `git log --graph --all`: topologia;
- `git cherry` e patch-id: equivalência de patches, subsets e supersets;
- SHA final: duplicatas exatas de referência.

Resultado global: **130 refs auditadas** — 18 locais, 42 `origin/*` e 70 `upstream/*`.

## 1. Branches 100% seguras para apagar após aprovação

“100% segura” aqui significa apenas que a branch não possui commit único em relação a `main` e que `git merge-base --is-ancestor BRANCH main` retorna sucesso. Isso prova incorporação no histórico local; não substitui a confirmação de worktree ativo, retenção operacional ou política de proteção do servidor.

Prova reproduzível:

```bash
git merge-base --is-ancestor BRANCH main
echo $?
# 0
```

### Branches locais — 10 refs

Todas retornam código `0` no comando acima e têm `0` commits únicos:

```text
codex/agent-os-crm-integration-plan
codex/crm-consolidated
codex/voice-architecture-audit
codex/voice-media-integration
codex/voice-migration-fix
codex/voice-unify-media-2026-08-29
implementacao-tokens-voice-core
main
sync/upstream-cherrypicks
worktree-agent-a39b36ce7ff4128ec
```

`main` não é candidata a remoção. `worktree-agent-a39b36ce7ff4128ec` está vinculada ao worktree `.claude/worktrees/agent-a39b36ce7ff4128ec`; não remover enquanto o worktree estiver ativo.

### Refs `origin/*` — 29 refs

Todas retornam código `0`, têm `0` commits únicos e já são ancestrais de `main`:

```text
origin/codex/crm-consolidated
origin/docs/complete-doc-sync
origin/docs/dead-cache-doc-refs
origin/fix/inbox-item-severity-vocab
origin/fix/squad-e2e-handoff-continuity
origin/implementacao-tokens
origin/implementacao-tokens-copy
origin/implementacao-tokens-voice-core
origin/implementacao-tokens-voice-core-baseline
origin/implementacao-tokens-voice-core-e2e-final
origin/implementacao-tokens-voice-core-e2e-final2
origin/implementacao-tokens-voice-core-e2e-final3
origin/implementacao-tokens-voice-core-e2e-final4
origin/implementacao-tokens-voice-core-e2e-red
origin/implementacao-tokens-voice-core-e2e-red-base
origin/implementacao-tokens-voice-core-e2e-red-ci
origin/implementacao-tokens-voice-core-e2e-red-run
origin/implementacao-tokens-voice-core-e2e-sim
origin/implementacao-tokens-voice-core-e2e-tests
origin/implementacao-tokens-voice-core-e2e-work
origin/implementacao-tokens-voice-core-safety-snapshot
origin/implementacao-tokens-voice-core-red-task1
origin/implementacao-tokens-voice-core-red-task1-base
origin/implementacao-tokens-voice-core-red-task1-ci
origin/implementacao-tokens-voice-core-red-task1-run
origin/main
origin/sync/upstream-cherrypicks
origin/voice-core-implementation
origin/voice-core-red-task5
```

O total seguro em `origin` é **29**.

### Refs `upstream/*` já ancestrais de `main` — 6 refs

Estas também passam `--is-ancestor` e têm `0` commits únicos relativos à `main` local:

```text
upstream/ecc-tools/DeskcommCRM-1783368833211
upstream/feat/crm-vivo
upstream/feat/ia-360-w2-reter
upstream/feat/ia-360-w3-escalar
upstream/feat/inbox-multimodal
upstream/feat/whatsapp-connections
```

Mesmo quando o commit é ancestral, a remoção de refs `upstream/*` deve ser tratada como limpeza do espelho remoto original, não como operação local automática.

**Total operacional recomendado para limpeza após confirmação:** 45 refs ancestrais identificadas no inventário bruto; excluir `main` e qualquer ref/worktree que o dono queira manter resulta nas listas acima para remoção efetiva.

## 2. Grupos de duplicatas exatas

Duplicata exata significa mesmo SHA final, não apenas nome parecido.

### SHA `54e86839`

```text
codex/agent-os-crm-integration-plan
worktree-agent-a39b36ce7ff4128ec
```

### SHA `ec47df9f`

```text
codex/crm-consolidated
codex/voice-unify-media-2026-08-29
origin/codex/crm-consolidated
```

### SHA `160bd616`

```text
sync/upstream-cherrypicks
origin/sync/upstream-cherrypicks
```

### SHA `cda205c9`

```text
gpt-lumenva-content-os
origin/gpt-lumenva-content-os
```

### SHA `d3c97cbd`

```text
codex/voice-architecture-audit
origin/implementacao-tokens-voice-core
```

### SHA `7018bc4e`

```text
origin/implementacao-tokens
origin/implementacao-tokens-voice-core-baseline
origin/implementacao-tokens-voice-core-red-task1
origin/implementacao-tokens-voice-core-red-task1-base
origin/implementacao-tokens-voice-core-red-task1-ci
origin/implementacao-tokens-voice-core-red-task1-run
origin/voice-core-implementation
origin/voice-core-red-task5
```

### SHA `eb9e35dc`

```text
origin/implementacao-tokens-voice-core-e2e-final
origin/implementacao-tokens-voice-core-e2e-final2
origin/implementacao-tokens-voice-core-e2e-final3
origin/implementacao-tokens-voice-core-e2e-final4
origin/implementacao-tokens-voice-core-e2e-red
origin/implementacao-tokens-voice-core-e2e-red-base
origin/implementacao-tokens-voice-core-e2e-red-ci
origin/implementacao-tokens-voice-core-e2e-red-run
origin/implementacao-tokens-voice-core-e2e-sim
origin/implementacao-tokens-voice-core-e2e-tests
origin/implementacao-tokens-voice-core-e2e-work
origin/implementacao-tokens-voice-core-safety-snapshot
```

### SHA `56260cea`

```text
main
origin/main
```

Não apagar `main` nem `origin/main`.

## 3. Branches com trabalho real não mergeado

### Trabalho local ativo

```text
agent-os-phase-7-durable-benchmark
  SHA: 1c75f7e1
  únicos vs main: 235
  à frente/atrás: 235/435
  delta: 188 arquivos, 40.214 inserções, 6.952 remoções
  worktree: .worktrees/agent-os-phase-7-durable-benchmark
  observação: 1 commit à frente de origin/agent-os-phase-7-durable-benchmark
```

```text
gpt-lumenva-content-os
  SHA: cda205c9
  únicos vs main: 24
  à frente/atrás: 24/575
  delta: 42 arquivos, 7.181 inserções
  worktree: .worktrees/gpt-lumenva-content-os
```

Essas branches devem ser preservadas.

### Fatias locais de voz ainda não presentes por SHA em `main`

```text
codex/voice-crm-config       1 commit, 10 arquivos, +69/-10
codex/voice-media-bridge     2 commits, 4 arquivos, +196/-1
codex/voice-pipecat-runtime  1 commit, 4 arquivos, +232
codex/voice-qa-ops           1 commit, 5 arquivos, +177
codex/voice-security-tests   1 commit, 6 arquivos, +94/-3
codex/voice-stt-tts          1 commit, 7 arquivos, +181/-27
```

Essas fatias foram incorporadas em `codex/voice-media-integration` por commits equivalentes, porém com SHAs diferentes (`6c005ad4`, `e6163804`, `30a01051`, `7189ec9c`, `d8eb943b`, `44a8e74e`, `c6fffbc1`), e essa branch de integração já está em `main`. São candidatas a remoção depois de confirmar que nenhum worktree, revisão ou recuperação ainda depende delas.

### Trabalho remoto `origin/*`

```text
origin/agent-os-implementation-plan       107 commits, 69 arquivos
origin/agent-os-phase-2-kernel             164 commits, 88 arquivos
origin/agent-os-phase-3-product-agents    194 commits, 110 arquivos
origin/agent-os-phase-4-shadow-evals      233 commits, 139 arquivos
origin/agent-os-phase-4-shadow-evals-planning 195 commits, 112 arquivos
origin/agent-os-phase-5-assisted-autonomy 203 commits, 103 arquivos
origin/agent-os-phase-6-learning-flywheel 278 commits, 147 arquivos
origin/agent-os-verification               252 commits, 142 arquivos
origin/agent-os-phase-7-durable-benchmark  234 commits, 180 arquivos
origin/gpt-lumenva-content-os               24 commits, 42 arquivos
origin/implementacao-tokens-channel-gateway  5 commits, 19 arquivos, +1.574/-5
origin/dependabot/npm_and_yarn/gpt-tokenizer-4.0.0 1 commit, 2 arquivos, +29/-23
origin/dependabot/npm_and_yarn/minor-and-patch-9d1c807f9a 1 commit, 2 arquivos, +641/-670
```

Nenhuma dessas refs deve ser apagada automaticamente.

### Relações de subset/superset verificadas por patch-id

- `origin/agent-os-implementation-plan` é subset de patches de `origin/agent-os-phase-2-kernel`;
- `origin/agent-os-implementation-plan` é subset das linhas posteriores do Agent OS;
- `origin/agent-os-phase-4-shadow-evals-planning` é subset de `origin/agent-os-phase-4-shadow-evals`;
- `origin/agent-os-phase-2-kernel` é subset de `origin/agent-os-phase-5-assisted-autonomy`;
- as fases 5, 6, verification e 7 são linhas acumulativas, não duplicatas exatas;
- a branch local `agent-os-phase-7-durable-benchmark` diverge da ref remota equivalente e tem um commit local adicional.

Recomendação: escolher uma única linha Agent OS canônica, preservar os SHAs das fases anteriores e só então arquivar/remover as fases redundantes.

### Trabalho remoto `upstream/*`

As 70 refs `upstream/*` apontam para uma história cujo `upstream/main` está em `2674611d`, 1.333 commits divergente da `main` local. Por isso, o contador relativo à `main` local não representa sozinho trabalho novo.

Branches com trabalho substancial que não devem ser tratadas como lixo sem revisão:

```text
upstream/feat/agenda-grade-interativa
upstream/feat/i18n-espanhol
upstream/fix/agenda-producao
upstream/fix/oauth-callback-alcancavel
upstream/fix/grade-contaminacao-entre-specs
upstream/fix/192-ddl-separado-do-runtime
upstream/fix/218-fiacao-da-central
upstream/fix/237-zod-nos-webhooks-de-canal
upstream/fix/265-tipo-de-fonte-de-conhecimento
upstream/fix/274-marca-logo-instavel
upstream/release/consolida-1.5.0
upstream/qa/w2-fontes-defasadas-cego
upstream/test/179-onboarding-fresco-no-ci
upstream/test/239-rede-visual-antes-do-tailwind4
upstream/feat/inbox-multimodal
upstream/feat/whatsapp-connections
```

Famílias que precisam de escolha por conteúdo, não por nome:

```text
upstream/cal/w0-schema
upstream/cal/w1-api
upstream/cal/w1-google
upstream/cal/w1-ui
upstream/cal/w2-agendas
upstream/cal/w2-mcp
upstream/feat/calendario-vivo
upstream/tmp-api
upstream/tmp-g2
upstream/tmp-sch
upstream/tmp-ui
upstream/tmp-ui2
upstream/tmp-verify
```

Branches temporárias ou de triagem que são candidatas a arquivamento, depois de preservar patches necessários:

```text
upstream/rebase-52
upstream/resolve-51
upstream/ci/e2e-serial
upstream/debug/mfa-reset
upstream/release/v1.1.0
upstream/pr121
upstream/pr126
upstream/pr127
upstream/triagem/275
upstream/triagem/322
upstream/triagem/326
upstream/triagem/327
upstream/triagem/327b
upstream/triagem/c202-demandas
upstream/triagem/pr198-testes-de-borda
upstream/triagem/pr201-reprodutor
upstream/triagem/wconf-194-200
upstream/triagem/wconf-194-201
upstream/ecc-tools/DeskcommCRM-1783368833211
```

## 4. Plano final de redução

1. **Congelar o inventário.** Guardar os SHAs e confirmar o estado remoto antes de qualquer limpeza. Fazer fetch somente após autorização.
2. **Resolver worktrees.** Confirmar com os responsáveis se os worktrees de voz, Agent OS e Content OS continuam ativos. Não apagar branch ligada a worktree em uso.
3. **Limpar duplicatas locais ancestrais.** Após aprovação, remover apenas as refs locais sem trabalho único, mantendo `main`.
4. **Limpar grupos remotos de SHA idêntico.** Escolher um nome canônico para os grupos `7018bc4e` e `eb9e35dc`; remover os demais somente com autorização para alteração no remoto.
5. **Escolher a linha Agent OS canônica.** Preservar commits únicos e documentar o SHA final; não apagar fases antes dessa decisão.
6. **Reaproveitar trabalho pequeno.** Triar `implementacao-tokens-channel-gateway` e os dois Dependabot; integrar, fechar ou arquivar conscientemente.
7. **Separar upstream histórico de trabalho atual.** Para Agenda, triagem e `tmp-*`, comparar patches contra o ancestral `upstream/main`, registrar o que já foi incorporado e só depois remover refs obsoletas.
8. **Executar remoções em lotes pequenos.** Depois de cada lote: `git branch -vv`, `git worktree list`, `git fsck --no-reflogs` (somente leitura primeiro) e confirmação dos SHAs preservados.

### Ações explicitamente não autorizadas nesta fase

- apagar branches locais ou remotas;
- remover worktrees;
- fazer merge em `main`;
- fazer push ou force-push;
- fazer fetch/download de objetos;
- descartar `.infisical.json` ou qualquer alteração não rastreada.

## Resumo de contagens

| Categoria | Quantidade | Decisão |
|---|---:|---|
| Refs auditadas | 130 | inventário completo das refs locais existentes |
| Branches locais | 18 | 10 ancestrais; 8 com atenção/trabalho |
| `origin/*` | 42 | 29 ancestrais; 13 com trabalho único ou análise pendente |
| `upstream/*` | 70 | história divergente; limpeza depende de revisão de conteúdo |
| Ancestrais de `main` no inventário bruto | 45 | candidatas somente após worktree/política/uso confirmados |
| Duplicatas exatas por SHA | 8 grupos | escolher um sobrevivente por grupo, exceto `main` |
| Trabalho real local não mergeado | 2 branches principais | Agent OS Fase 7 e Content OS |
| Fatias locais de voz já absorvidas por integração | 6 | candidatas após confirmar worktrees |
| Trabalho remoto `origin` não mergeado | 13 refs destacadas | preservar e decidir reaproveitamento |

**Conclusão:** há um núcleo pequeno de branches ativas e muito lixo histórico/duplicado. A maior redução segura virá das duplicatas exatas de `origin`, das branches locais ancestrais sem worktree ativo e das fases Agent OS somente depois de escolher uma linha canônica. Nenhuma remoção foi executada.
