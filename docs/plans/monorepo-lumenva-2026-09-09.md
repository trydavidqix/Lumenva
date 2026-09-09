# Plano executável — monorepo Lumenva

**Data:** 2026-09-09
**Base confirmada:** `main` em `712f3cfd6afe69d1e57d8112c13ef0bf79a51b76`
**Branch deste plano:** `docs/monorepo-plan-2026-09-09`
**Escopo:** DOC-ONLY. Este documento descreve a execução; não move ficheiros, altera configuração de fornecedor ou faz migração.

## Resultado decidido

Adotar `apps/crm` e `apps/site`. O blog permanece como rotas públicas dentro de `apps/site` (`/blog`, `/blog/[slug]`, categorias, RSS e sitemap). Não criar `apps/blog` nesta migração. O código mostra que o blog público é inseparável do site e que o Content OS é uma capacidade do CRM: `origin/blog` adiciona ambos os lados, enquanto não há imports cruzados que justifiquem uma terceira aplicação. `apps/blog` fica como evolução posterior somente se houver domínio, deploy, equipa ou ciclo de release independente comprovado.

Integrar `origin/blog` em uma branch de integração baseada em `main` **antes** de mover `app/`, `lib/`, `components/`, `workers/` e `website/`. O branch adiciona 152 ficheiros (+8.952/-10), incluindo três migrations Supabase, rotas do CRM, rotas do blog e workers; mover primeiro aumentaria o conflito e poderia separar uma migration da sua aplicação. A sequência é: validar e integrar o branch, fechar o SHA resultante, então executar a migração estrutural em branch própria.

## Evidência confirmada no clone

- Há dois Next.js independentes: o CRM na raiz e o site em `website/`; ambos usam Node `>=22`, pnpm `9.15.9`, React `19.2.8` e TypeScript `6.0.3`.
- O site é auto-contido: `website/app` e `website/lib` não importam da raiz; o CRM também não importa de `website/`.
- Existem dois lockfiles (`pnpm-lock.yaml` e `website/pnpm-lock.yaml`); o alvo é um único `pnpm-lock.yaml` na raiz e nenhum `website/pnpm-lock.yaml`.
- O único conflito de tipo relevante é `@types/node` (`^26.2.0` no CRM contra `^20.16.0` no site); o plano uniformiza em `^26.2.0`, compatível com o runtime Node `>=22`.
- A raiz tem overrides de `postcss` (`^8.5.26`) e `sharp` (`^0.35.0`); eles passam para `pnpm-workspace.yaml`.
- O branch `origin/blog` não altera os dois `package.json`; ele adiciona Content OS no CRM e o blog público no site.
- Há lixo/configuração operacional no top-level (sete `docker-compose*.yml`, Caddyfile, `hostgator-setup-kit`, vários `HANDOFF-*.md`); cada item será classificado antes de mover ou remover.
- `.gitignore` já está modificado no clone por trabalho alheio; não faz parte deste plano nem do commit deste ficheiro.

## Pesquisa-fundo e veredito

Pesquisa realizada em 2026-09-09 via documentação oficial e consultas de issues/discussões abertas criadas desde 2026-08-10. Links oficiais: [pnpm workspaces](https://pnpm.io/workspaces), [pnpm catalogs](https://pnpm.io/catalogs), [Vercel monorepos](https://vercel.com/docs/monorepos), [transferência de repositório GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository) e [desativar/ativar workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows).

- **pnpm workspace + lockfile partilhado — VEREDITO: ADOTAR.** A documentação confirma `pnpm-workspace.yaml`, `sharedWorkspaceLockfile: true`, um lockfile raiz e acesso estrito às dependências declaradas por cada pacote. Relatos recentes consultados em [issues de lockfile/workspace](https://github.com/pnpm/pnpm/issues?q=is%3Aissue+created%3A%3E%3D2026-08-10+workspace+lockfile) incluem dedupe de peers (#14697) e comportamento de lockfile em deploy (#14671); por isso a verificação congelará `pnpm install --frozen-lockfile` e builds filtrados antes de qualquer deploy.
- **pnpm catalogs — VEREDITO: ADOTAR EM MODO MANUAL.** O catálogo reduz drift sem esconder uma dependência não declarada; `catalogMode: manual` evita converter dependências não partilhadas por acidente. O catálogo completo abaixo cobre toda a interseção real entre CRM e site.
- **Turborepo — VEREDITO: NÃO ADOTAR AGORA.** Para duas aplicações Next sem pacote runtime partilhado, pnpm e o skip de builds não afetados da Vercel cobrem o caso. Reabrir apenas após medir build local ou introduzir packages runtime partilhados; não adicionar `turbo.json` como trabalho incidental.
- **Vercel monorepo — VEREDITO: ADOTAR COM PREVIEW PRIMEIRO.** A documentação confirma um projeto por subpasta, Root Directory por projeto e deteção do lockfile/workspace raiz. O risco operacional é externo: Root Directory errado ou ligação Git não reautorizada; os passos exigem preview verde antes de produção.
- **Transferência GitHub — VEREDITO: ADOTAR APENAS COM DONO.** A documentação confirma transferência de histórico, issues, PRs, webhooks, secrets e deploy keys, além de redirect automático; criar um fork/repositório novo no endereço antigo elimina o redirect. A transferência e a criação da organização são ações de proprietário e ficam marcadas `PRECISA DONO`.
- **GitHub Actions — VEREDITO: UM WORKFLOW, MANTER OFF ATÉ DECISÃO DE BILLING.** A doutrina do repositório regista Actions desativado desde 2026-08-20. O plano define um workflow único e deixa a ativação como decisão explícita do dono; não ligar Actions implicitamente durante a migração.

## Topologia alvo

```text
.
├── apps/
│   ├── crm/                 # antigo root app: app, components, lib, workers, hooks, scripts e configs próprios
│   └── site/                # antigo website/: app, components, content, lib, tests, public, styles
├── packages/
│   ├── eslint-config/       # só se ambos consumirem uma configuração comum real
│   └── tsconfig/             # só se ambos consumirem uma base comum real
├── .github/workflows/ci.yml
├── pnpm-workspace.yaml
├── pnpm-lock.yaml            # único lockfile
└── docs/                     # documentação e planos do monorepo
```

Não extrair `lib/`, `components/`, `content-os/` ou blog para packages nesta fase: não há imports cruzados e a extração criaria API pública sem consumidor. Depois da migração, um package runtime só pode nascer com dois consumidores confirmados, nome único, `workspace:*`, testes próprios e dono definido. Configuração organizacional que ainda for raiz (editorconfig, CI, documentação, `pnpm-workspace.yaml`) permanece raiz; configuração exclusivamente de uma aplicação acompanha a aplicação.

## Catálogo pnpm completo das dependências partilhadas

O inventário abaixo é a interseção exata de `package.json` e `website/package.json`. As versões escolhidas são a maior faixa já declarada quando há drift; `@types/node` é a exceção deliberada para `^26.2.0`. Dependências presentes numa única aplicação permanecem no respetivo `package.json` e não entram no catálogo.

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'

catalogMode: manual
catalog:
  '@phosphor-icons/react': ^2.1.10
  '@playwright/test': ^1.62.1
  '@testing-library/jest-dom': ^7.0.1
  '@testing-library/react': ^16.3.2
  '@testing-library/user-event': ^14.6.3
  '@types/node': ^26.2.0
  '@types/react': ^19.2.18
  '@types/react-dom': ^19.2.4
  '@upstash/redis': ^1.38.2
  eslint: ^9.12.0
  eslint-config-next: ^16.3.0
  jsdom: ^30.0.1
  next: ^16.3.0
  react: ^19.2.8
  react-dom: ^19.2.8
  resend: ^6.18.1
  typescript: ^6.0.3
  vitest: ^4.1.10
  zod: ^4.4.3

overrides:
  postcss: ^8.5.26
  sharp: ^0.35.0

sharedWorkspaceLockfile: true
```

Em cada `package.json` migrado, substituir somente as 20 versões acima por `catalog:` e manter as dependências exclusivas com a faixa atual. Antes de aceitar o resultado, comparar o inventário gerado por `node` contra os dois manifests e falhar se houver uma interseção sem entrada de catálogo.

## Passos executáveis

### 0. Preflight e integração de `origin/blog`

**Pre-check**

```bash
cd /Users/david/Desktop/CRM/Lumenva
git status --short --branch
git rev-parse HEAD
git fetch origin main blog
git diff --stat main...origin/blog
git diff --name-only main...origin/blog
pnpm --version
node --version
```

Confirmar que o trabalho alheio em `.gitignore` está presente e fora do escopo. Confirmar que `origin/blog` ainda parte do `main` esperado e que o branch adiciona as migrations e as duas superfícies descritas.

**Ação**

```bash
git switch -c integrate/blog-2026-09-09 origin/main
git merge --no-ff origin/blog -m "merge: integrate content os and blog"
```

Resolver conflitos preservando o contrato canónico de `CLAUDE.md`, a cadeia de migrations, `website/app/sitemap.ts`, `.env.example` e `docker-compose.prod.yml`. Não mover diretórios nesta branch.

**Verificação**

```bash
git diff --check
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:unit
pnpm --dir website typecheck
pnpm --dir website test
git status --short
git rev-parse HEAD
```

Guardar o SHA da integração e a lista de migrations. `origin/blog` fica considerado integrado somente com esses checks PASS; um green parcial deve ser marcado `NOT_PROVEN`.

**Rollback**

Se a integração não puder ser validada, abandonar a branch descartável sem tocar `main` e abrir uma decisão do dono sobre resolver conflitos; não fazer reset destrutivo no clone de trabalho.

**PRECISA DONO:** aprovar o merge de `origin/blog` e qualquer resolução que altere produto, schema ou deployment.

### 1. Criar a branch de migração e congelar o inventário

**Pre-check**

```bash
git switch -c migrate/monorepo-lumenva-2026-09-09 <SHA_DA_INTEGRACAO>
git status --short
find . -maxdepth 2 -name package.json -o -name pnpm-lock.yaml | sort
test -f pnpm-lock.yaml && test -f website/pnpm-lock.yaml
```

Gerar uma cópia externa do inventário de caminhos e dos manifests para auditoria; não adicionar essa cópia ao Git.

**Ação**

Classificar cada top-level como `raiz`, `apps/crm`, `apps/site`, `infra compartilhada`, `docs` ou `lixo candidato`. Mover apenas conteúdo app-específico com `git mv`; manter raiz `CLAUDE.md`, `AGENTS.md`, `docs/`, `.github/`, `supabase/`, `pnpm-workspace.yaml`, lockfile, políticas e scripts de governança. Para os sete compose, Caddyfile, Dockerfiles e `hostgator-setup-kit`, anexar a decisão de destino a cada ficheiro antes de apagar; não inferir “lixo” por nome.

**Verificação**

```bash
git diff --name-status
git ls-files apps/crm apps/site | wc -l
git ls-files website/pnpm-lock.yaml
```

O resultado deve mostrar todos os caminhos do antigo CRM sob `apps/crm/`, os do antigo `website/` sob `apps/site/`, nenhum lockfile em `apps/site/` e nenhum caminho app-específico órfão na raiz.

**Rollback**

Antes do commit, reverter somente os `git mv` da branch com `git mv` inverso a partir do diff; preservar alterações prévias em `.gitignore` e outros caminhos fora do escopo. Depois de commit, reverter por commit novo, nunca reescrever histórico partilhado.

**PRECISA DONO:** aprovar a classificação de cada compose, Dockerfile, Caddyfile, `hostgator-setup-kit`, `HANDOFF-*.md` e demais lixo candidato.

### 2. Wire do workspace e do catálogo

**Pre-check**

```bash
rg --files apps packages | sort
node -e 'for (const f of ["apps/crm/package.json","apps/site/package.json"]) { const p=require("./"+f); console.log(f,p.name) }'
```

Confirmar que os dois `name` são únicos e que não existem imports relativos atravessando a fronteira (`rg -n "\.\./\.\./|from ['\"]\.\./\.\./" apps`).

**Ação**

Criar `pnpm-workspace.yaml` com os globs e catálogo acima; atualizar os dois manifests para `catalog:` nas 20 dependências partilhadas; consolidar `packageManager: pnpm@9.15.9`, `engines.node >=22` e os overrides na raiz. Criar `packages/eslint-config` e `packages/tsconfig` somente se a extração for consumida pelos dois apps; caso contrário, manter os ficheiros de configuração em cada app e deixar `packages/` vazio/documentado.

**Verificação**

```bash
pnpm install
pnpm install --frozen-lockfile
test "$(find . -name pnpm-lock.yaml -not -path './node_modules/*' | wc -l | tr -d ' ')" -eq 1
pnpm list --depth -1 --recursive
pnpm --filter lumenva-crm typecheck
pnpm --filter lumenva-website typecheck
```

Comparar `pnpm-lock.yaml` no diff e verificar que todas as dependências permanecem declaradas no package que as usa; o lockfile único não autoriza imports de dependências transitivas.

**Rollback**

Se o lockfile não for determinístico ou uma aplicação perder uma dependência declarada, restaurar os manifests e `pnpm-workspace.yaml` por commit de correção e repetir a resolução; não manter `website/pnpm-lock.yaml` como “fallback”.

**PRECISA DONO:** aprovar a versão de `@types/node` 26 e a criação de packages de configuração.

### 3. Validação funcional da migração

**Pre-check**

```bash
pnpm --filter lumenva-crm exec next --version
pnpm --filter lumenva-website exec next --version
rg -n "website/|from ['\"][^'\"]*website" apps .github docs --glob '!docs/plans/**'
```

Resolver referências a caminhos antigos em scripts, Dockerfiles, Vercel config, Playwright, imports, documentação operacional e comandos de deploy.

**Ação**

Executar os checks por filtro, ajustar apenas referências de caminho necessárias e manter o comportamento. Não extrair lógica para packages durante este passo.

**Verificação**

```bash
pnpm --filter lumenva-crm lint
pnpm --filter lumenva-crm typecheck
pnpm --filter lumenva-crm test:unit
pnpm --filter lumenva-crm build
pnpm --filter lumenva-website lint
pnpm --filter lumenva-website typecheck
pnpm --filter lumenva-website test
pnpm --filter lumenva-website build
pnpm --filter lumenva-website test:e2e
```

Registar separadamente PASS/NOT_EXECUTED para cada comando. Confirmar rotas `/blog`, `/blog/[slug]`, RSS, sitemap, login do CRM, workers e migrations sem executar operações de produção.

**Rollback**

Parar antes de Vercel se qualquer build falhar; corrigir na branch de migração ou reverter o commit estrutural inteiro, mantendo a branch de integração do blog intacta.

**PRECISA DONO:** decidir se um e2e indisponível por ambiente pode ser aceito como `NOT_EXECUTED` ou bloqueia a promoção.

### 4. CI único e estado de GitHub Actions

**Pre-check**

```bash
find .github/workflows -maxdepth 1 -type f -print 2>/dev/null | sort
git log -1 --format='%H %s' -- .github/workflows
```

Inventariar workflows existentes, secrets referenciados e custo/billing da organização. A doutrina atual regista Actions desligado desde 2026-08-20.

**Ação**

Consolidar num único `.github/workflows/ci.yml` com `pnpm/action-setup@v4` (versão `9.15.9`), Node `22`, `pnpm install --frozen-lockfile`, lint/typecheck/test/build filtrados para `apps/crm` e `apps/site`, e `concurrency` por branch. Não incluir deploy nem secrets. Deixar o workflow desativado até decisão do dono; quando autorizado, ativar pela UI/CLI documentada do GitHub, nunca removendo o ficheiro.

Esqueleto pronto para colar:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  validate:
    if: ${{ !github.event.repository.is_archived }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter lumenva-crm lint && pnpm --filter lumenva-crm typecheck && pnpm --filter lumenva-crm test:unit
      - run: pnpm --filter lumenva-website lint && pnpm --filter lumenva-website typecheck && pnpm --filter lumenva-website test
      - run: pnpm --filter lumenva-crm build
      - run: pnpm --filter lumenva-website build
```

**Verificação**

```bash
actionlint .github/workflows/ci.yml
git diff --check
gh workflow list --all
```

Se Actions continuar off, a verificação externa esperada é `NOT_EXECUTED`, não PASS. Se o dono ativar, exigir um run de PR verde e guardar o URL do run antes de usar o status como gate.

**Rollback**

Desativar o workflow pela UI/CLI se consumir billing ou falhar repetidamente; manter o commit e o histórico do workflow para reativação auditável. Remover jobs de deploy, não secrets.

**PRECISA DONO:** decidir `Actions on/off`, billing e branch protection; autorização explícita é necessária para ativar Actions.

### 5. Vercel — Root Directory e promoção preview → produção

**Pre-check**

```bash
git status --short
git rev-parse HEAD
```

No painel Vercel, confirmar os dois projetos existentes (`crm` e `lumenva-website`), o repositório ligado, a branch de produção e todos os Environment Variables. Não alterar produção neste pre-check.

**Ação**

Para o projeto CRM, definir Root Directory `apps/crm`; para `lumenva-website`, definir Root Directory `apps/site`. Manter install command automático baseado no lockfile raiz; usar `pnpm install --filter <app>...` apenas se a instalação automática falhar e registar a alteração. Se for necessário relacionamento entre previews, usar `relatedProjects` em vez de URL hardcoded.

**Verificação**

1. Criar preview a partir da branch de migração para cada projeto.
2. Confirmar logs de install com o `pnpm-lock.yaml` raiz e build no Root Directory correto.
3. Testar `apps/site` (home, `/blog`, slug, RSS, sitemap) e `apps/crm` (login e uma rota autenticada permitida pelo ambiente de preview).
4. Guardar URLs, SHA e prova visual/log de cada preview.
5. Só depois do dono aprovar os dois previews, apontar a produção e executar smoke test pós-deploy.

**Rollback**

Antes da promoção, apagar/invalidar apenas os previews falhos. Depois da promoção, reverter o projeto Vercel para o último deployment verde conhecido e restaurar os Root Directories anteriores, sem apagar o repositório ou variáveis.

**PRECISA DONO:** acesso de proprietário aos dois projetos Vercel, aprovação dos previews, alteração de Root Directory e autorização explícita para promoção de produção.

### 6. Criar organização GitHub, transferir e reautorizar integrações

**Pre-check**

```bash
git remote -v
gh auth status
gh repo view trydavidqix/Lumenva --json nameWithOwner,defaultBranchRef,isArchived
```

Confirmar que `lumenva` ainda não existe como organização/repositório conflitante, que o dono tem permissão de criar organização e transferir o repositório e que não haverá fork no endereço antigo.

**Ação**

1. Criar a organização GitHub `lumenva` pela UI administrativa, com billing, owners, 2FA, teams e política de Actions definidos.
2. Transferir `trydavidqix/Lumenva` para `lumenva/Lumenva` em Settings → Danger Zone → Transfer; preservar o mesmo nome.
3. Após a transferência concluir, atualizar cada clone:

```bash
git remote set-url origin https://github.com/lumenva/Lumenva.git
git fetch origin --prune
git remote -v
```

4. Reautorizar a organização `lumenva` no GitHub App da Vercel e reconfirmar os dois projetos; não recriar o repositório antigo, pois isso destrói redirects.

**Verificação**

```bash
git ls-remote origin HEAD refs/heads/main
gh repo view lumenva/Lumenva --json nameWithOwner,defaultBranchRef
```

Abrir o URL antigo e confirmar redirect, abrir o URL novo e confirmar o repositório, executar um preview Vercel pós-reautorização e conferir webhooks/secrets/deploy keys transferidos sem exibir valores.

**Rollback**

Se a organização ou Vercel não estiver pronta, parar antes da transferência. Depois de transferido, corrigir permissões e remotes no destino; não criar fork/repositório substituto no endereço antigo. Qualquer nova transferência exige decisão do dono e verificação de impacto em redirects, webhooks, secrets e deploy keys.

**PRECISA DONO:** todos os passos de organização, transferência, billing, 2FA, permissões e reautorização Vercel.

### 7. Fecho, evidência e promoção

**Pre-check**

```bash
git status --short
git diff --check
git diff --name-only <SHA_BASE> HEAD
find . -name pnpm-lock.yaml -not -path './node_modules/*' -print
```

O diff da migração deve conter apenas os caminhos aprovados; este plano deve continuar sendo o único ficheiro alterado no commit DOC-ONLY desta entrega.

**Ação**

Publicar a branch de plano, não executar os passos operacionais neste clone:

```bash
git add docs/plans/monorepo-lumenva-2026-09-09.md
git commit -m "docs: add Lumenva monorepo migration plan"
git push -u origin docs/monorepo-plan-2026-09-09
```

**Verificação**

```bash
git show --stat --oneline HEAD
git show --name-only --format='' HEAD
git status --short --branch
git rev-parse HEAD
```

Esperado: o commit contém exclusivamente `docs/plans/monorepo-lumenva-2026-09-09.md`; `.gitignore` permanece fora do commit. Enviar ao Claude, via Maestri, o SHA, resumo de 10 linhas e os itens `PRECISA DONO`.

**Rollback**

Para corrigir este documento antes de ser consumido, fazer commit corretivo na mesma branch. Não fazer force-push e não alterar `main`.

**PRECISA DONO:** aceitar o plano e autorizar cada ação externa; o commit/push deste documento já foi solicitado pelo dono e é o único efeito externo desta entrega.

## Resumo de handoff ao Claude (10 linhas)

1. Plano DOC-ONLY criado para migrar o CRM e o site para `apps/crm` e `apps/site`.
2. Recomendação: blog como rotas de `apps/site`, sem `apps/blog` nesta fase.
3. Razão: blog público vive no site e Content OS vive no CRM; não há imports cruzados.
4. Integrar `origin/blog` antes da mudança estrutural, pois o branch toca as duas superfícies e migrations.
5. Workspace alvo usa `pnpm-workspace.yaml`, um lockfile raiz e catálogo manual.
6. Catálogo cobre todas as 20 dependências partilhadas; `@types/node` uniformiza em 26.
7. Packages ficam limitados a configurações realmente partilhadas; sem extração runtime prematura.
8. Vercel: Root Directory `apps/crm` e `apps/site`; preview verde antes de produção.
9. GitHub: criar org `lumenva`, transferir repo, atualizar remotes e reautorizar Vercel.
10. CI: um workflow; Actions mantém-se off até decisão de billing e do dono.


## Emenda 2026-09-09

- O catálogo pnpm abrange apenas a interseção dos manifests raiz e website: os 20 pacotes partilhados. `@types/node` fica em `^26.2.0`; nos restantes drifts menores usa-se a faixa mais alta já declarada.
- `scripts/voice-sip-test/` é um harness isolado: permanece fora do workspace e do catálogo, com `package.json` e `pnpm-lock.yaml` próprios. O workspace não usa glob em `scripts/*`.
- A migração remove apenas `website/pnpm-lock.yaml`; permanecem o lockfile raiz e `scripts/voice-sip-test/pnpm-lock.yaml`.
- `workers/voice-worker/` (`@lumenva/voice-worker`) permanece fora do workspace. A dependência única (`getpatter`) é exclusiva e não entra no catálogo; a versão inválida fica registada no follow-up abaixo.

### Follow-up

- `workers/voice-worker/package.json` declara `getpatter@0.7.1`, mas o registry consultado disponibiliza no máximo `0.7.0`. O worker foi mantido fora do workspace nesta migração, sem corrigir a dependência. Validar a versão suportada antes de uma futura integração do worker.
