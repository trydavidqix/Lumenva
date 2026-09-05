# Auditoria real das branches `origin/*` — 2026-09-02 (v2)

## Escopo e estado confirmado

Auditoria somente leitura no checkout principal `/Users/david/Desktop/Projetos/CRM/DeskcommCRM`.
Foi executado `git fetch origin --prune` antes do inventário. Após o fetch, `main` e
`origin/main` apontam para o mesmo SHA `89c90510` (`Merge phase 2 kernel contract tests`).
O checkout principal está sujo por alterações do RelayBuilder e artefactos locais; não
foram alterados nem descartados. Os worktrees paralelos observados também foram
preservados.

Restaram **16 refs `origin/*` incluindo `origin/main`**, portanto **15 branches remotas
além de `origin/main`**. As quatro branches de benchmark/flywheel/autonomy/evals e as
branches `phase-2-kernel`/`phase-3-product-agents` já não aparecem após o prune.

## Causa raiz da contradição

Os dois relatórios anteriores compararam perguntas diferentes:

1. `git log --right-only --cherry-pick main...origin/<branch>` é uma comparação
   *patch-aware* de commits do lado da branch. Saída vazia significa que a branch não
   tem commits efetivamente exclusivos (ou que os patches são equivalentes); não prova
   que as árvores dos dois tips sejam iguais.
2. `git diff main origin/<branch> --stat` é uma comparação de dois pontos. Com `main`
   primeiro, as linhas negativas e os `D` descrevem conteúdo que **main tem e a branch
   antiga não tem**. Isso é o sentido oposto da pergunta de retenção (“o que existe na
   branch e não existe em main”). Em branches ancestrais/defasadas, o resultado pode ser
   enorme mesmo sem qualquer conteúdo exclusivo na branch.

O teste correto para conteúdo introduzido pela branch é `git diff main...origin/<branch>`
(merge-base até o tip da branch), complementado por `git diff --name-status
main origin/<branch>` com a direção explicitamente interpretada. Nesta auditoria, as
11 branches sem delta de três pontos têm `git diff main...branch` vazio e o tip é o
próprio merge-base (ou todos os commits são patch-equivalentes); o grande diff de dois
points é somente evolução posterior de `main`. Já quatro branches têm delta real de
três pontos com código/testes/configuração.

## Inventário e classificação

As contagens `behind/ahead` abaixo são `git rev-list --left-right --count main...branch`.
O “delta correto” é `git diff --shortstat main...branch`; zero significa nenhum
conteúdo exclusivo da branch desde o ponto comum.

| Branch remota (tip) | behind/ahead | Delta correto (main...branch) | Classificação final |
|---|---:|---|---|
| `origin/agent-os-implementation-plan` (`12a2bc32`) | 559/107 | 69 ficheiros, +8199/-348; 41 `lib`, 22 docs, migrations, testes e configs | **TRABALHO REAL — decisão do dono**. Apesar do nome “plan”, contém Agent OS executável, contratos/testes, migrations e governança de skills. Não apagar por heurística de nome. |
| `origin/agent-os-phase-4-shadow-evals-planning` (`7bb5c532`) | 559/195 | 112 ficheiros, +13130/-351; 70 `lib`, 28 docs, 9 testes, migrations/config | **TRABALHO REAL — decisão do dono**. Inclui kernel, contratos e implementação, não apenas plano de Phase 4. |
| `origin/agent-os-verification` (`78543784`) | 559/252 | 142 ficheiros, +16082/-655; app/components/hooks, 103 `lib`, docs, testes, migrations/config | **TRABALHO REAL — decisão do dono**. Inclui UI `Phase6LearningQueue`, autonomia/flywheel e contratos de verificação. |
| `origin/codex/crm-consolidated` (`ec47df9f`) | 137/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Tip é merge-base; não há caminho, teste, migration ou doc exclusivo da branch. |
| `origin/docs/complete-doc-sync` (`9ec117b0`) | 455/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Branch ancestral; o diff de dois pontos lista apenas evolução de `main`. |
| `origin/docs/dead-cache-doc-refs` (`2a113082`) | 457/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Sem delta próprio. |
| `origin/fix/inbox-item-severity-vocab` (`8e634961`) | 456/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Sem delta próprio. |
| `origin/fix/squad-e2e-handoff-continuity` (`510d91c9`) | 458/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Sem delta próprio. |
| `origin/gpt-lumenva-content-os` (`cda205c9`) | 675/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Tip é merge-base; nenhum conteúdo exclusivo. |
| `origin/implementacao-tokens` (`7018bc4e`) | 352/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Sem delta próprio. |
| `origin/implementacao-tokens-channel-gateway` (`76dda2b1`) | 408/5 | 19 ficheiros, +1574/-5; gateway, engines, identidade, segurança, tracing e testes em `lib/channels` | **TRABALHO REAL — decisão do dono**. Os ficheiros são código/testes de canal ausentes no delta de `main`; não é apenas documentação. |
| `origin/implementacao-tokens-copy` (`1daa09c7`) | 442/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Sem delta próprio. |
| `origin/implementacao-tokens-voice-core` (`d3c97cbd`) | 175/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Sem delta próprio. |
| `origin/implementacao-tokens-voice-core-e2e-final` (`eb9e35dc`) | 253/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Sem delta próprio. |
| `origin/sync/upstream-cherrypicks` (`160bd616`) | 454/0 | vazio | **DIFERENÇA HISTÓRICA IRRELEVANTE — segura para apagar com autorização**. Sem delta próprio. |

## Evidência de conteúdo nas quatro branches retidas

`git diff --name-status main...origin/agent-os-implementation-plan` lista, entre outros,
`lib/agent-engine/agent/skill-governance.ts`, contratos Agent OS, três migrations
`agent_os_*`, fixtures e `vitest.agent-os.config.ts`. A branch
`agent-os-phase-4-shadow-evals-planning` acrescenta `lib/agent-engine/kernel/*`,
contratos de kernel e de shadow evals. `agent-os-verification` acrescenta
`lib/agent-engine/autonomy/*`, flywheel/evals e `components/ai/Phase6LearningQueue.tsx`.
`implementacao-tokens-channel-gateway` acrescenta 18 ficheiros em
`lib/channels/{gateway,engines}` mais testes de contrato e altera o script de verificação.
São mudanças de implementação verificáveis, logo exigem decisão explícita antes de
qualquer remoção.

Para as 11 classificadas como históricas, `git diff --name-status main...branch` não
produz linhas. O `git diff --stat main branch` que motivou o relatório do ApagadorRemoto
mostra sobretudo `D` no sentido “branch não contém o que main ganhou depois”; não é
prova de trabalho perdido na branch.

## Resultado operacional

- Nenhuma branch foi apagada; nenhum `push --delete` foi executado.
- **15 branches `origin/*` além de `origin/main` permanecem.**
- **11** estão classificadas como históricas/seguras para apagar somente após autorização
  e checagens operacionais finais.
- **4** contêm trabalho real não integrado e ficam pendentes de decisão do dono.
