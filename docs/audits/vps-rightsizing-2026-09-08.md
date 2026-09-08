# Auditoria de rightsizing da VPS — 2026-09-08

## Escopo e limites

Auditoria somente leitura. Não foram executados build, `docker compose up`, `down`, `rm`, `prune`, `restart`, migration, teste pesado ou alteração de runtime. A branch é `audit/vps-rightsizing-2026-09-08`, criada a partir de `main`.

O worktree já continha um ficheiro não rastreado, preservado sem alteração:
`app/app/ai/agents/[id]/_components/CommandPanel.test.tsx`.

## Resumo executivo

1. A VPS tem 2 CPUs e 3.7 GiB de RAM. O uso medido foi 2.5 GiB, com 427 MiB livres, 1.2 GiB disponíveis e 2.5 GiB de swap usados de 8 GiB.
2. O maior consumidor de memória entre os containers é Neo4j: 263.6 MiB, 51.49% do limite de 512 MiB. App usa 225.9 MiB, WAHA 191.5 MiB e worker 174.6 MiB.
3. O maior desperdício de disco operacional é build/cache: 10.83 GiB de build cache, 5.808 GiB reclaimable. A imagem WAHA ocupa 4.39 GiB; cada imagem do worker ocupa 2.6 GiB.
4. Os sidecars de memória e grafo estão ativos, mas o código só os usa quando `MEM0_BASE_URL`/`GRAPHITI_BASE_URL` estão configurados e o rollout por organização permite. Os runbooks registram `mem0=shadow` e `graphiti=shadow` para a organização auditada, sem ativação.
5. A hipótese “VPS só serve tráfego; build sai para Actions/GHCR” é tecnicamente viável, mas o publish atual só produz a imagem do app. O worker ainda precisaria de uma imagem publicada separadamente ou continuaria a ser construído na VPS.
6. Actions está desativado ao nível do repositório por billing, não por defeito no workflow. Reativar o repositório enquanto os workflows `ci`, `e2e`, `perf` e outros permanecem `active` reativaria também os seus gatilhos. A ativação seletiva exige primeiro desativar individualmente todos os workflows que não devem correr.

## Histórico da decisão de desativar Actions

O commit `67dff648e40c6afa7ba049ef8502b50fffb6175b` (`2026-08-20`, `docs: registrar GitHub Actions desabilitado (permanente) + cadência de Vercel Preview`) registra:

- checks `FAILURE` em aproximadamente quatro segundos no PR #25;
- causa observada: billing da conta GitHub quebrado, com a mensagem `recent account payments have failed`;
- dúvida retroativa sobre PRs #21/#24, fechados sob a aparência de checks falhando;
- desativação aplicada via API `repos/{owner}/{repo}/actions/permissions`, `enabled: false`;
- consequência documentada: build ad-hoc na VPS virou o caminho operacional único.

Verificação atual via GitHub API, somente leitura:

```text
repos/trydavidqix/Lumenva/actions/permissions.enabled = false
```

Os workflows listados pela API continuam com estado individual `active`:

```text
agent-os-phase2-ci
ci
e2e
implementacao-tokens-ci
perf
publish-image.yml
Dependabot Updates
Dependency Graph
```

Portanto, `enabled=false` é um interruptor global. Não há evidência de que apenas `publish-image.yml` possa ser ligado por esse interruptor.

## Branches e classificação

Branches locais/remotas relevantes:

| Ref | Estado observado | Classificação |
|---|---|---|
| `main` / `origin/main` | SHA `712f3cfd`; linha de integração e base da VPS segundo a doutrina | Ativo/canônico |
| `blog` / `origin/blog` | SHA `de4fbb9d`; 15 commits à frente de `main`, Content OS/Radar, 152 ficheiros e 8.952 linhas adicionais | Ativo, mas fora da linha de integração `main` |
| `plan/nova-mode-v1-v2-v3` | SHA `9df4794f`; ancestral de `blog`; diferença efetiva para `blog` concentrada no avanço posterior do Content OS | Redundante/ponteiro histórico; não é a branch de deploy |
| `upstream/*` | Fork upstream, muitas branches remotas | Read-only; não usar para integração ou deploy |
| `audit/vps-rightsizing-2026-09-08` | Criada nesta tarefa a partir de `main` | Branch documental desta auditoria |

`blog` e `plan/nova-mode-v1-v2-v3` não devem ser confundidas com `main`: o diff `main...blog` contém o Content OS, rotas cron editoriais, workers editoriais, blog institucional e persistência adicional.

## Arquitetura do código

- `app/`: Next.js App Router, UI e Route Handlers; 589 ficheiros, dos quais 277 em `app/api`.
- `lib/`: domínio, auth, Supabase, IA, clientes externos e contratos; `lib/ai` tem 84 ficheiros.
- `workers/`: workers long-running e handlers de projeção; 51 ficheiros.
- `app/api/v1/cron/`: 19 rotas de cron chamadas pelo scheduler interno.
- `supabase/`: migrations e `baseline.sql`; o banco canônico está no Supabase Cloud, não na VPS.
- `website/`: pacote institucional/blog separado; no checkout local tem 1.4 GiB, explicado por `website/node_modules` (808 MiB) e `website/.next` (617 MiB). No checkout da VPS, `website` tem 3.0 MiB, sem os artefatos locais do desenvolvimento.
- `WAHA`: sessão e webhook WhatsApp; sessão persistente em volume externo.
- `Redis + SRH`: rate limit/debounce via API compatível com Upstash.
- `OpenAI/AI providers`: chamadas externas via credenciais runtime; não existe modelo local na VPS.
- `Mem0/Graphiti/Neo4j`: sidecars opcionais; os clientes TypeScript degradam para `skipped` quando as URLs não estão configuradas.

Dependências de maior peso no checkout local (`node_modules/.pnpm`): Next 198 MiB, `@next/swc` 84 MiB, Sentry CLI 35 MiB, `pdfjs-dist` 34 MiB, `@napi-rs/canvas` 31 MiB, `pdf-parse` 29 MiB, `@phosphor-icons/react` 57 MiB e `gpt-tokenizer` 55 MiB. O tamanho instalado total é 1.5 GiB.

## Medição local

```text
repo total                 3.5G
node_modules               1.5G
.next                      244M
.git                       198M
website                    1.4G
website/node_modules       808M
website/.next              617M
app                        3.8M
lib                        6.2M
workers                    464K
supabase                   1.4M
```

Não há Docker daemon local disponível (`docker: command not found`); portanto não há imagens locais para medir neste Mac.

## Medição da VPS

### Host

```text
Linux 7.0.0-29-generic x86_64
uptime: 18 dias, 4:34
CPU: 2 vCPUs
load average: 0.33 0.34 0.26
RAM: 3.7 GiB total, 2.5 GiB usada, 427 MiB livre, 1.2 GiB available
swap: 8.0 GiB total, 2.5 GiB usada, 5.5 GiB livre
```

Durante `vmstat 1 3`, houve swap-in/swap-out na primeira amostra (`si=334`, `so=394`) e depois zero nas duas amostras seguintes. Isso confirma pressão histórica/atual de memória, mas não prova saturação contínua.

### Containers e memória

Todos os 11 containers estavam `Up`. `healthy` explícito: app, worker, mem0, mem0-postgres, graphiti, neo4j e redis. Caddy, scheduler, SRH e WAHA não têm healthcheck declarado no Compose.

| Container | RAM medida | CPU | Imagem | Veredito funcional |
|---|---:|---:|---|---|
| `lumenva-app-1` | 225.9 MiB | 0.07% | `deskcomm-app:local` | Obrigatório para tráfego HTTP/API |
| `lumenva-worker-1` | 174.6 MiB | 1.40% | `lumenva-worker` | Obrigatório para processamento assíncrono |
| `lumenva-waha-1` | 191.5 MiB | 0.05% | `devlikeapro/waha` | Obrigatório para WhatsApp ativo |
| `lumenva-redis-1` | 2.281 MiB | 0.62% | `redis:7-alpine` | Obrigatório para rate limit/debounce local |
| `lumenva-srh-1` | 8.992 MiB | 0.01% | `hiett/serverless-redis-http:latest` | Adaptador necessário ao SDK Upstash |
| `lumenva-scheduler-1` | 1.391 MiB | 0.00% | `alpine:3.20` | Obrigatório enquanto crons não forem externos |
| `lumenva-caddy-1` | 25.73 MiB | 0.00% | `caddy:2-alpine` | Obrigatório como TLS/reverse proxy atual |
| `lumenva-mem0-1` | 37.57 MiB | 1.85% | `mem0-api-server:local` | Opcional/gated; não há prova de rollout ativo |
| `lumenva-mem0-postgres-1` | 32.5 MiB | 0.00% | `pgvector/pgvector:pg16` | Dados do Mem0; só necessário se Mem0 ativo |
| `lumenva-graphiti-1` | 35.98 MiB | 0.15% | `zepai/graphiti:0.22.0` | Opcional/gated; não há prova de rollout ativo |
| `lumenva-neo4j-1` | 263.6 MiB / 512 MiB cap | 0.55% | `neo4j:5.26.0` | Maior consumidor; só necessário se Graphiti ativo |

Os quatro sidecars Mem0/Graphiti/Neo4j somam aproximadamente 370 MiB de RSS Docker medido, cerca de 10% da RAM disponível da máquina. O impacto é maior durante startup, indexação e swap, não apenas na fotografia de `docker stats`.

### Imagens, cache e volumes

Imagens locais medidas na VPS:

```text
devlikeapro/waha:latest       4.39GB
lumenva-worker:latest         2.60GB (ativo)
lumenva-worker:local          2.60GB (órfão, sem container)
deskcommcrm-worker:latest     2.24GB (órfão, sem container)
neo4j:5.26.0                  896MB
mem0-api-server:local         714MB
zepai/graphiti:0.22.0         716MB
deskcomm-app:local            613MB (ativo)
deskcomm-crm:local            613MB (órfão, sem container)
pgvector/pgvector:pg16        621MB
```

`docker system df` mediu 15.81 GiB de imagens, com 5.162 GiB reclaimable, e 10.83 GiB de build cache, com 5.808 GiB reclaimable. A existência de três imagens antigas do worker e uma imagem antiga do app prova acumulação de artefatos, mas não autoriza remoção nesta fase.

Volumes externos com dados:

```text
deskcommcrm_neo4j-data          518M
deskcommcrm_mem0-postgres-data   72M
deskcommcrm_waha-data           4.4M
deskcommcrm_waha-media          0B
deskcommcrm_caddy-data          120K
deskcommcrm_caddy-config         12K
```

O tamanho pequeno de WAHA media não prova ausência de importância: as sessões pareadas vivem em `waha-data` e são dados operacionais não substituíveis sem novo pareamento.

### Processos e portas

Além dos containers, o host roda Docker daemon, Fail2ban, Asterisk e Chrony. O processo `dockerd` apareceu com RSS de aproximadamente 1.09 GiB; Neo4j com 251 MiB; Next server com 203 MiB; processo Node do worker com 168 MiB. Esse overhead do daemon e dos processos fora dos containers precisa entrar no orçamento de RAM.

Portas públicas observadas no host: TCP 80/443 (Caddy), TCP 22 (SSH), UDP 5060/4569/51433 e UDP dinâmicas (Asterisk). Asterisk não faz parte dos 11 containers e é uma carga adicional da VPS.

## Build atual e custo

Não foi executado build nesta auditoria: build é uma operação pesada e o briefing proíbe thrash/mutação. A evidência operacional documentada em `docs/runbooks/deploy.md` registra aproximadamente quatro minutos por build nesta VPS e um incidente real em que 4 GiB de swap não foram suficientes: o OOM killer atingiu processos de produção, incluindo Caddy. O runbook foi atualizado para exigir 8 GiB de swap.

O custo medido do estado atual é, portanto:

- tempo histórico: aproximadamente 4 minutos;
- risco de memória: confirmado por incidente documentado, swap atual 2.5 GiB usada;
- espaço: 10.83 GiB de cache local, além de imagens duplicadas;
- custo de oportunidade: o build compete diretamente com app, worker, WAHA, Docker daemon, Asterisk e Neo4j.

## Avaliação dos sidecars

`workers/memory-projection.handler.ts` e `workers/memory-lifecycle.handler.ts` só consideram Mem0 configurado quando `MEM0_BASE_URL` existe. Os equivalentes Graphiti usam `GRAPHITI_BASE_URL`. A configuração de feature é lida em `ai_platform_feature_flags`; o runbook de Graphiti registra as organizações auditadas como `shadow` e informa que subir o profile não promove o rollout.

Conclusão: há dados persistidos reais em `neo4j-data` e `mem0-postgres-data`, mas não há evidência nesta auditoria de que os sidecars estejam no caminho síncrono obrigatório do tráfego de produção. Eles podem ser candidatos a host separado ou perfil on-demand, condicionados a backup verificado, confirmação do dono e prova de que não há org em `on`/`canary`.

## Avaliação de Actions → GHCR

O `publish-image.yml` existente já usa `docker/login-action`, `docker/metadata-action` e `docker/build-push-action`, publica `linux/amd64` e declara `contents: read`/`packages: write`. A imagem do app é genérica: `.env` e segredos entram em runtime na VPS; não devem entrar no build.

É tecnicamente possível reativar somente a publicação, porque GitHub permite desativar/ativar workflows individualmente pela UI, CLI ou REST API. Mas a ordem segura é obrigatória:

1. corrigir/verificar billing da conta GitHub;
2. desativar individualmente `ci.yml`, `e2e.yml`, `perf.yml`, `implementacao-tokens-ci.yml`, `agent-os-phase2-ci.yml` e qualquer workflow não-publicador;
3. reativar Actions no repositório;
4. confirmar via API que apenas o workflow de publicação está `active`;
5. executar primeiro `workflow_dispatch` manual, sem qualquer push de produção;
6. ler o digest GHCR e só então testar pull/deploy numa janela autorizada.

Se o passo 4 não puder ser comprovado, a alternativa é manter Actions desligado e executar o mesmo Buildx em outro runner controlado, ou usar um repositório/organização dedicado apenas ao publish. Reativar Actions globalmente sem desativação individual não é seguro.

Há uma lacuna estrutural: o workflow atual publica o app, mas não publica `Dockerfile.worker`. Para “VPS só pull”, o worker precisa de workflow/imagem GHCR própria ou continua a ser construído localmente.

## Fontes oficiais consultadas

- [GitHub — publicar imagens Docker em GHCR](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images): `GITHUB_TOKEN`, `packages: write`, login GHCR e Buildx.
- [GitHub — desativar/ativar workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows): controle individual por workflow.
- [GitHub REST — permissões de Actions](https://docs.github.com/en/rest/actions/permissions): `enabled` é configuração do repositório inteiro.
- [Docker — cache em GitHub Actions](https://docs.docker.com/build/ci/github-actions/cache/): cache `gha` depende do contexto de workflow.
- [Next.js — output standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output): tracing reduz deployment; `public` e `.next/static` precisam ser copiados explicitamente.
- [WAHA — storage de sessões](https://waha.devlike.pro/docs/how-to/storages/): persistência local exige volume em `/app/.sessions`.
- [Mem0 — REST self-hosted](https://docs.mem0.ai/open-source/features/rest-api): servidor OSS depende de Postgres alcançável e deve permanecer interno/authenticated.
- [Neo4j — configuração de memória em Docker](https://neo4j.com/docs/operations-manual/current/docker/configuration/): heap/pagecache são limites distintos; `/data` é essencial para persistência.

