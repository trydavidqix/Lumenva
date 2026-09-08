# Plano de rightsizing e build externo — 2026-09-08

Este documento é plano, não execução. Todos os passos que tocam produção ou configurações GitHub requerem aprovação explícita do dono e janela combinada.

## 1. Arquitetura atual

```text
Internet
  -> Caddy :80/:443
     -> app (Next standalone :3000)
        -> Supabase Cloud (DB/Auth/Storage/Realtime)
        -> WAHA :3000 (WhatsApp e webhooks)
        -> SRH -> Redis (rate-limit/debounce)
        -> Mem0 opcional -> mem0-postgres
        -> Graphiti opcional -> Neo4j

scheduler (crond interno)
  -> app/api/v1/cron/* a cada minuto/5/15 minutos/diário

worker 24/7
  -> event_log/handlers
  -> WAHA, Supabase e sidecars opcionais

Fora da VPS:
  - Supabase Cloud: banco, Auth, Storage e Realtime
  - OpenAI/outros providers: LLM/embedder via credenciais runtime
  - GitHub/GHCR proposto: build e distribuição de imagens
```

## 2. Problemas e riscos encontrados

### 2.1 Actions desligado por billing, não por código

O commit `67dff648` registra falha de pagamentos da conta GitHub e desativação via API. Hoje a API confirma `enabled=false`, mas os workflows estão individualmente `active`. Ligar Actions sem primeiro desativar os demais faria `ci`, `e2e`, `perf` e workflows auxiliares voltarem a reagir aos seus gatilhos.

### 2.2 Build concorre com produção

A VPS tem 2 CPUs, 3.7 GiB de RAM, swap usada e incidente OOM documentado durante build. O build local também conserva 10.83 GiB de cache e imagens duplicadas.

### 2.3 Worker não acompanha a proposta atual

`publish-image.yml` publica somente a imagem do app. `Dockerfile.worker` gera uma imagem separada com aproximadamente 2.6 GiB. Sem um segundo artefato GHCR, o deploy continuará a construir o worker na VPS.

### 2.4 Sidecars ativos apesar de rollout não comprovado

Mem0, Mem0 Postgres, Graphiti e Neo4j ocupam aproximadamente 370 MiB de RSS Docker; Neo4j sozinho usa 263.6 MiB e tem volume de 518 MiB. O código é gated por URL e feature mode, mas os processos permanecem ativos.

### 2.5 Imagens e cache acumulados

Há imagens ativas, antigas e sem container: dois workers locais adicionais, uma imagem antiga do app e cache de build reclaimable. Nenhuma limpeza é autorizada neste plano sem inventário, backup e confirmação.

### 2.6 Healthchecks incompletos

Caddy, scheduler, SRH e WAHA aparecem `Up`, mas sem healthcheck Docker. `Up` não prova disponibilidade da função; o plano deve adicionar probes somente em passo separado e aprovado.

## 3. Desperdício medido

### VPS

```text
Imagens totais                    15.81 GiB
Imagens reclaimable                5.162 GiB
Build cache                      10.83 GiB
Build cache reclaimable           5.808 GiB
Neo4j volume                    518 MiB
Mem0 Postgres volume             72 MiB
Repo checkout                    1.7 GiB
Repo node_modules                1.4 GiB
mem0-src                         102 MiB
```

### Checkout local

```text
Repo total                      3.5 GiB
node_modules                    1.5 GiB
.next                           244 MiB
.git                            198 MiB
website                         1.4 GiB
website/node_modules            808 MiB
website/.next                   617 MiB
```

`website` é um pacote separado e não deve ser automaticamente embutido na imagem CRM sem prova de necessidade. O `.dockerignore` já exclui `docs`, `.git`, `.next`, `node_modules`, `.env*` e `mem0-src`; preservar essa fronteira é requisito.

## 4. Arquitetura recomendada

### Mínimo conservador na VPS

Manter inicialmente:

- Caddy;
- app;
- worker;
- WAHA e volumes de sessão/mídia;
- Redis + SRH;
- scheduler;
- redes externas atuais;
- Supabase Cloud fora da VPS.

Mover o build para fora da VPS não remove nenhum serviço de tráfego e não altera segredos de runtime.

### Sidecars

Manter Mem0/Graphiti/Neo4j como profiles desligados por default no caminho principal. Antes de os retirar da VPS:

1. confirmar no Supabase que nenhuma organização está em `on`/`canary`;
2. confirmar que `MEM0_BASE_URL` e `GRAPHITI_BASE_URL` não são usados pelo runtime ativo;
3. fazer backup dos volumes;
4. executar uma janela separada para mover ou reanexar os volumes.

Opção recomendada: host dedicado de memória/grafo ou serviço gerido compatível, com endpoint privado, TLS, autenticação e latência medida. Não enviar volumes diretamente para GitHub/GHCR: registry é para imagens, não para dados.

## 5. Estratégia de build e deploy

### Fase-alvo

```text
push/tag autorizado
  -> workflow_dispatch ou trigger protegido
  -> Buildx linux/amd64 no GitHub
  -> cache GHA/registry
  -> push GHCR com tags imutáveis + digest
  -> VPS puxa digest
  -> compose sobe app/worker sem build local
```

### App

- Publicar `ghcr.io/trydavidqix/lumenva:sha-<commit>` e uma tag operacional não-imutável apenas como conveniência.
- Produção deve fixar digest (`@sha256:...`) após verificação, não confiar apenas em `latest`.
- Definir `APP_IMAGE=ghcr.io/trydavidqix/lumenva@sha256:<digest>`.
- Definir `APP_PULL_POLICY=missing` quando `APP_IMAGE` aponta para um digest imutável: a VPS usa a imagem já presente e só faz pull quando ela falta, evitando que um restart falhe por indisponibilidade temporária do GHCR. Usar `never` apenas quando o pull já tiver sido executado e verificado explicitamente na janela.
- Segredos permanecem no `.env` gerido da VPS; `NEXT_PUBLIC_*` continuam runtime conforme o Dockerfile atual.

### Worker

Criar, em etapa posterior e separada, imagem `ghcr.io/trydavidqix/lumenva-worker:<tag>` a partir de `Dockerfile.worker`. O worker deve ser publicado para `linux/amd64`, verificado por digest e referenciado explicitamente no Compose. Sem essa etapa, apenas o app sai da VPS.

### Workflow seguro

O workflow atual usa tags de Actions (`@v7`) e deve ser endurecido antes de produção:

- pin de cada action a commit SHA completo;
- `permissions: contents: read, packages: write` no job e nada além;
- `workflow_dispatch` inicial como único gatilho de prova;
- tags de branch/release só depois de provar o caminho manual;
- `attestations`/proveniência considerados separadamente, sem colocar segredos no build;
- `cache-from/cache-to` com `type=gha` ou `type=registry`, observando limites e retenção.

## 6. Separação de serviços

| Serviço | Primeira decisão | Condição |
|---|---|---|
| app | Fica na VPS, imagem passa a ser pull | Serve HTTP/API |
| worker | Fica na VPS, imagem publicada separadamente | Processa event log/side effects |
| WAHA | Fica na VPS | Sessões pareadas e callbacks reais |
| Redis/SRH | Ficam na VPS | Rate limit/debounce e contrato Upstash |
| scheduler | Fica inicialmente | Substituição por cron externo só após prova de idempotência e observabilidade |
| Caddy | Fica na VPS | TLS e reverse proxy atuais |
| Mem0 | Profile opcional; candidato a host separado | Backup + confirmação de rollout |
| mem0-postgres | Acompanha Mem0 ou host dedicado | Não apagar volume |
| Graphiti | Profile opcional; candidato a host separado | Backup + confirmação de rollout |
| Neo4j | Acompanha Graphiti ou host dedicado | `/data` persistente, backup verificável |

## 7. Otimizações

1. Build remoto com cache BuildKit elimina concorrência do `next build` com tráfego.
2. Manter `.dockerignore`; nunca incluir `.env*`, `.git`, `docs`, `node_modules`, `mem0-src` ou artefatos do `website` na imagem CRM.
3. Manter Next `output: standalone`; copiar apenas `.next/standalone`, `.next/static` e `public`, como já faz o Dockerfile.
4. Tornar o worker multi-stage em etapa própria: runtime sem ferramentas de desenvolvimento, depois de existir uma prova equivalente ao `tsx` atual.
5. Medir retenção de cache GHCR/GHA antes de definir política; não substituir cache local por outro acúmulo sem limite.
6. Inventariar e, somente após backup/autorização, remover imagens sem container e cache reclaimable.

## 8. Segurança

- Repositório GHCR deve ser privado ou ter visibilidade deliberadamente aprovada.
- O token de pull da VPS deve ser um deploy token/read-only, armazenado fora do Git e fora dos logs. O login operacional `docker login ghcr.io` grava as credenciais do root em `/root/.docker/config.json`; o formato Docker convencional guarda o token em Base64, não cifrado. O procedimento deve usar um token read-only de curta duração/escopo mínimo, executar `printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io --username "$GHCR_READ_USER" --password-stdin`, restringir permissões do ficheiro (`chmod 600 /root/.docker/config.json`) e nunca imprimir o comando, token ou conteúdo do ficheiro. Rotação exige novo login e revogação do token anterior.
- `GITHUB_TOKEN` precisa apenas de `packages: write` no job de publicação.
- Nunca passar API keys por `ARG`, `COPY`, query string ou output de build.
- Pin de actions por SHA completo.
- Não publicar portas de Mem0/Graphiti/Neo4j; manter redes internas sem egress indevido.
- Manter apenas Caddy em 80/443; tratar as portas Asterisk existentes como superfície separada.
- Asterisk/voz corre fora dos 11 containers e também consome RAM/CPU/portas na VPS; fica fora do escopo desta migração, mas entra no orçamento de memória e nas validações de capacidade.

## 9. Backups antes de qualquer mexida

Os comandos abaixo são plano para janela autorizada; não foram executados:

```bash
cd /root/deskcommcrm
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
BACKUP_DIR=/root/backups/lumenva/$STAMP
mkdir -p "$BACKUP_DIR"

# Capturar manifestos, não segredos
docker compose -f docker-compose.lumenva.prod.yml config --services > "$BACKUP_DIR/services.txt"
docker volume ls --format '{{.Name}}' | sort > "$BACKUP_DIR/volumes.txt"

# Volumes de dados, com nomes explícitos e sem docker volume rm
for volume in deskcommcrm_waha-data deskcommcrm_waha-media deskcommcrm_mem0-postgres-data deskcommcrm_neo4j-data deskcommcrm_caddy-data deskcommcrm_caddy-config; do
  docker run --rm -v "$volume":/data:ro -v "$BACKUP_DIR":/backup alpine \
    tar czf "/backup/${volume}.tar.gz" -C /data .
done

sha256sum "$BACKUP_DIR"/*.tar.gz > "$BACKUP_DIR/SHA256SUMS"
sha256sum -c "$BACKUP_DIR/SHA256SUMS"
```

Para Neo4j Community, o backup deve respeitar o procedimento do runbook: parar apenas o serviço Neo4j durante a janela, ou usar `neo4j-admin database dump` com o banco parado. Não remover volume nem usar `down -v`.

## 10. Rollback

### Build remoto

- Guardar digest atualmente em produção antes do primeiro pull.
- Em falha de build/publicação: não tocar na VPS; continuar com imagem antiga.
- Em falha de pull: restaurar `APP_IMAGE` para o digest anterior.

### Deploy app/worker

- Fazer pull do digest novo sem substituir a imagem antiga.
- Subir um serviço por vez, começando pelo app; verificar healthcheck e HTTP.
- Se falhar, apontar o Compose para o digest anterior e subir novamente.
- Não remover a imagem antiga até passar a janela de observação.

### Sidecars

- Rollback é reanexar os volumes originais e restaurar as referências anteriores.
- Não restaurar dump por cima de volume original sem cópia preservada e checksum.

### GitHub Actions

- Se o workflow manual disparar qualquer workflow não autorizado, desativar o workflow por API/UI e voltar o repositório para `enabled=false`.
- Manter registro do estado anterior dos workflows e das permissões.

## 11. Validações pré e pós-deploy

### Pré-check local/registry

- `git rev-parse` do commit publicado.
- digest retornado pelo GHCR corresponde ao digest esperado.
- scan de logs de build sem secrets.
- imagem contém `server.js`, `.next/static`, `public` e `ffmpeg`.
- imagem worker contém entrypoint e `/healthz`.

### Pós-check VPS

- `docker compose ps`: nenhum serviço alvo em `unhealthy`.
- Healthcheck TCP do app e `/healthz` do worker.
- `curl` HTTPS do domínio retorna o redirect esperado (`307` conforme runbook).
- logs do Caddy sem falha ACME; logs app/worker sem crash loop.
- WAHA mantém sessão sem novo QR.
- cron interno responde sem 401/5xx inesperados.
- Supabase permanece acessível; nenhuma migration é executada neste fluxo.
- volumes aparecem com os mesmos nomes e dados preservados.
- confirmar memória/swap após 5, 15 e 30 minutos.

## 12. Sequência exata das implementações

Cada passo é sequencial. Nenhum passo autoriza automaticamente o seguinte.

### Passo 0 — Aprovação e pré-condições — PRECISA DONO

- Pre-check: confirmar billing GitHub, acesso de administração do repositório, janela VPS, domínio de rollback e responsável presente.
- Ação: registrar autorização escrita para Actions seletivo e para qualquer ação VPS posterior.
- Verificação: API de permissões continua `enabled=false`; nenhum runtime alterado.
- Rollback: cancelar plano.

### Passo 1 — Preparar segurança do workflow — PRECISA DONO

- Pre-check: listar workflows e estados via API; guardar JSON de estado.
- Ação: fixar actions por SHA, limitar permissions, adicionar digest/tag imutável e `workflow_dispatch`; não ligar Actions ainda.
- Verificação: revisão de diff, análise de contexto e confirmação de que build não recebe segredos.
- Rollback: reverter apenas o commit documental/workflow.

### Passo 2 — Isolar workflows não-publicadores — PRECISA DONO

- Pre-check: confirmar que branch protection não depende dos workflows a desativar.
- Ação: desativar individualmente `ci`, `e2e`, `perf`, `implementacao-tokens-ci`, `agent-os-phase2-ci` e quaisquer outros não necessários.
- Verificação: API mostra esses workflows `disabled_manually`; `publish-image` permanece o único alvo ativo.
- Rollback: reativar individualmente os workflows a partir do estado salvo.

### Passo 3 — Reativar Actions globalmente, sem produção — PRECISA DONO

- Pre-check: passos 1 e 2 verificados; billing resolvido.
- Ação: habilitar Actions do repositório com política mínima de actions permitidas.
- Verificação: API mostra `enabled=true` e somente `publish-image` ativo; nenhum run inesperado.
- Rollback: voltar `enabled=false` e preservar os estados individuais.

Os gates de qualidade `ci`, `e2e` e `perf` permanecem OFF de propósito; o gate local consciente passa a ser `pnpm gov:verify`, complementado por `pnpm test:db`/E2E quando o raio da mudança exigir. Isto é uma decisão operacional explícita, não um efeito colateral da migração de imagens.

### Passo 4 — Prova manual do app — PRECISA DONO

- Pre-check: `workflow_dispatch`, sem push para `main` e sem release.
- Ação: build/push `linux/amd64` para GHCR.
- Verificação: job exit 0, digest, tamanho, provenance/logs sem secrets.
- Rollback: apagar/retirar tag não-imutável apenas conforme política GHCR; não tocar VPS.

### Passo 5 — Pull controlado na VPS — PRECISA DONO + JANELA

- Pre-check: backup/manifestos e digest antigo; verificar espaço e memória.
- Ação: pull do digest novo, sem build, e atualizar somente `APP_IMAGE`/referência aprovada.
- Verificação: healthchecks, HTTP, logs, WAHA, cron, memória/swap e volumes.
- Rollback: apontar para digest antigo e subir app/worker conforme runbook, sem `down -v`.

### Passo 6 — Publicar worker — PRECISA DONO

- Pre-check: imagem worker ainda é construída e verificada separadamente.
- Ação: workflow dedicado para `Dockerfile.worker`, depois pull por digest.
- Verificação: `/healthz`, consumo e processamento de evento controlado.
- Rollback: manter imagem worker anterior.

### Passo 7 — Sidecars fora da VPS — PRECISA DONO + JANELA

- Pre-check: confirmar modes/URLs por organização e backup com checksum.
- Ação: migrar endpoint/host ou desligar profile de forma reversível; nunca apagar volumes no primeiro passo.
- Verificação: projeções continuam `skipped` quando esperado; tráfego CRM, WAHA e cron permanecem verdes.
- Rollback: reanexar volumes e restaurar endpoints anteriores.

### Passo 8 — Higiene de imagens/cache — PRECISA DONO + JANELA

- Pre-check: imagem antiga/digest de rollback e backups confirmados.
- Ação: remover somente artefatos explicitamente listados e reclaimable; nenhum volume, rede ou dado.
- Verificação: `docker system df`, espaço e possibilidade de rollback.
- Rollback: repuxar imagem do digest preservado; não há rollback de uma remoção de cache sem reconstrução.

## Decisão recomendada

Recomendo aprovar primeiro apenas o desenho de build remoto do app, com Actions globalmente reativado somente depois de desativar individualmente todos os workflows não-publicadores e resolver o billing. Não recomendo ainda remover sidecars nem publicar worker no mesmo passo: são mudanças independentes, com dados persistidos e critérios de rollback próprios.
