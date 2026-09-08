# Runbook: builder Linux doméstico → GHCR → VPS

> **Substitui** `docs/plans/vps-build-oracle-runbook-2026-09-08.md`.

Data: 2026-09-08

Branch: `audit/vps-rightsizing-2026-09-08`
Estado: plano documental. Este documento não executa build, login, push, deploy,
limpeza, parada de serviço ou alteração na VPS. Não tocar no PC Linux enquanto o
scan PhotoRec estiver em curso (estimativa: 4–8 horas).

## Objetivo, topologia e limites

O PC Linux doméstico é o builder real. O código e as imagens passam pelo GitHub e
GHCR; o PC faz build/testes e empurra imagens por HTTPS de saída; a VPS só puxa
imagens por digest e executa o runtime.

| Camada | Responsabilidade | Não fazer |
|---|---|---|
| GitHub + GHCR | Código, tags por SHA e imagens privadas imutáveis | Não guardar `.env`, tokens ou dados de produção |
| PC Linux (`claude@192.168.1.78`) | Build `linux/amd64`, testes e inspeção das imagens | Não correr serviços chamados pela VPS; não receber segredos de produção |
| VPS | Caddy, app, worker, WAHA, Redis, SRH e scheduler | Não compilar; não alterar volumes/redes fora deste runbook |

Builder confirmado pelo dono: Ubuntu 24.04.4, kernel 6.8, 8 threads, 7.7 GB de
RAM, Docker 29.8 + Compose v5.5, Node 20.20 e pnpm 9.15.9 via Corepack/
`packageManager`. Checkout: `/home/claude/src/Lumenva`; branches `main`, `blog` e
`audit`. SSH é somente por chave (`~/.ssh/lumenva_worker`). A VPS não consegue
alcançar o PC; o PC tem HTTPS outbound para GHCR.

Invariantes:

- O checkout do builder contém apenas código. Nunca copiar `.env`, backups,
  volumes, dumps, tokens, chaves privadas, dados de clientes ou credenciais da
  VPS. Segredos não entram em contexto Docker, `ARG`, `ENV`, labels, cache,
  logs, tags ou artefatos.
- Usar o SHA completo do commit como referência de auditoria e tags humanas
  `sha-<SHA>`. Deploy usa `@sha256:<digest>`, nunca `latest`.
- O `APP_IMAGE` existente continua parametrizado. O worker precisa do contrato
  equivalente: a alteração futura em `docker-compose.lumenva.prod.yml` é **uma
  única linha adicionada** ao serviço `worker` —
  `image: ${WORKER_IMAGE:?set WORKER_IMAGE}` (ou a forma acordada na revisão).
  Não editar
  outra linha nesta etapa; a linha é pré-condição e não é adicionada neste
  documento.
- Não aplicar migrations, regenerar `.env`, alterar DNS/OAuth/WAHA, apagar
  volumes/redes ou usar `down -v`, `docker system prune` ou prune de volumes.
- Se qualquer pre-check falhar, abortar o passo e preservar o estado anterior.

## Fontes oficiais usadas

- Docker, [multi-platform builds](https://docs.docker.com/build/building/multi-platform/): `--platform`, driver `docker-container`, emulação e `--push`.
- Docker, [buildx build reference](https://docs.docker.com/reference/cli/docker/buildx/build/): `--platform`, `--push`, `--tag` e `--provenance`.
- Docker, [Compose service `image`](https://docs.docker.com/reference/compose-file/services/): imagem parametrizada e precedência do serviço.
- Docker, [Compose variable interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/): `${WORKER_IMAGE}` via shell/`--env-file` e `docker compose config`.
- GitHub, [Working with the Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry): PAT classic, `read:packages`, `write:packages`, login por `--password-stdin` e escopo `repo` desnecessário.
- GitHub, [Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images): publicação e autenticação no GHCR.

## 0. Pre-check global, aprovação e abort

**Pre-check**

1. **PRECISA DONO.** Confirmar que o scan PhotoRec terminou e que o dono
   autorizou qualquer acesso ao PC. Até lá, nenhum SSH, download, Docker ou
   alteração é permitido.
2. **PRECISA DONO.** Confirmar o SHA exato a construir, a visibilidade privada
   dos dois packages GHCR e a janela futura de produção. Confirmar que não há
   PAT ativo em outro operador.
3. Localmente, somente quando autorizado, verificar branch/estado no checkout
   do repo e registrar SHA, sem abrir ou copiar ficheiros de segredo.

**Ação**

Nenhuma ação agora. Este runbook é preparação; os passos seguintes só começam
com as aprovações explicitamente marcadas.

**Verificação**

Registrar apenas SHA, nomes de imagem, digests, códigos de saída e estados
`healthy`; nunca valores de token, cookie, `.env` ou payloads.

**Rollback/abort**

Abortar se o scan estiver ativo, o SHA não estiver fixado, o checkout estiver
sujo sem explicação, houver segredo no contexto, ou não existir janela/aprovação
para a etapa pedida. Não tentar “limpar” o builder ou a VPS para prosseguir.

## 1. PAT de publicação somente no builder

**Pre-check**

- **PRECISA DONO.** Criar um PAT classic dedicado com `write:packages` (que já
  permite pull) e, se necessário pela UI, `read:packages`; não conceder
  `delete:packages`, `admin:*` ou `repo` amplo. O package deve permanecer
  privado e ligado ao repositório correto.
- Confirmar que o token será usado somente no PC Linux, com owner e ficheiro
  protegidos, e que a rotação/revogação está prevista.

**Ação**

- **PRECISA DONO.** Depois do PhotoRec, entrar no PC por SSH e guardar o PAT
  fora do repo, modo `600`, ou fornecê-lo interativamente. Não escrever token
  em shell history, systemd, Dockerfile, build arg, log ou `.env`.
- Login somente por stdin, sem imprimir o valor:

```sh
umask 077
read -r -s GHCR_PUSH_PAT
printf '%s' "$GHCR_PUSH_PAT" | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
unset GHCR_PUSH_PAT
chmod 600 ~/.docker/config.json
```

**Verificação**

- O comando termina com sucesso sem revelar o token. Confirmar que o package é
  privado e que `~/.docker/config.json` não foi versionado nem copiado.
- O login é somente no builder; a VPS usará outro token read-only no passo 4.

**Rollback/rotação**

- **PRECISA DONO.** Revogar o PAT no GitHub ao fim da fase de publicação, em
  mudança de operador ou suspeita de exposição; remover a cópia local e criar
  outro token com o menor escopo. Rotação não exige apagar imagens já publicadas.
- Se o token aparecer em output, processo, ficheiro ou histórico, abortar,
  revogar e investigar antes de qualquer build.

## 2. Build, push, digests e inspeção sem segredos

**Pre-check**

- **PRECISA DONO.** Aguardar fim do PhotoRec e autorizar build/push. Confirmar
  que o PC tem espaço/RAM para duas imagens e que `/home/claude/src/Lumenva`
  está no SHA aprovado, sem `.env` real.
- Confirmar `.dockerignore` exclui `mem0-src/`, `.env*`, chaves, dumps e caches.
  Não instalar Docker, QEMU, dependências ou binários: qualquer download exige
  autorização explícita.
- Confirmar que o app usa placeholders `NEXT_PUBLIC_*` no build e injeta
  valores reais somente no runtime da VPS; não passar segredo em `--build-arg`.

**Ação**

No PC, após autorização, configurar/usar um builder BuildKit existente. Se for
necessário criar um nome novo, usar `docker-container` e `--bootstrap`; não
remover builders ou fazer prune amplo. Fixar o SHA completo antes dos comandos:

```sh
cd /home/claude/src/Lumenva
SHA="$(git rev-parse HEAD)"
APP="ghcr.io/trydavidqix/lumenva:sha-${SHA}"
WORKER="ghcr.io/trydavidqix/lumenva-worker:sha-${SHA}"

docker buildx build --platform linux/amd64 --file Dockerfile --tag "$APP" --push .
docker buildx build --platform linux/amd64 --file Dockerfile.worker --tag "$WORKER" --push .
```

Os dois comandos devem ser sequenciais e cada um deve terminar com código de
saída zero. Não usar `latest`, `--build-arg` para segredo, `--secret` com dados
de produção ou contexto copiado da VPS.

**Verificação**

1. Ler e guardar somente os digests e o SHA:

```sh
docker buildx imagetools inspect "$APP"
docker buildx imagetools inspect "$WORKER"
docker buildx imagetools inspect "$APP" --format '{{json .Manifest.Digest}}'
docker buildx imagetools inspect "$WORKER" --format '{{json .Manifest.Digest}}'
```

2. Confirmar manifest `linux/amd64`, package privado e digest estável. Não
   tratar tag como prova de imutabilidade.
3. Inspecionar o app fora da VPS, sem `.env`:

```sh
docker run --rm --platform linux/amd64 --entrypoint sh "$APP" -lc '
  set -eu
  test -f /app/server.js
  test -d /app/.next/static
  test -d /app/public
  command -v ffmpeg
  node --version
  id
'
```

4. Inspecionar o worker e o contrato de health:

```sh
docker image inspect "$WORKER" --format '{{json .Config.Healthcheck}} {{json .Config.ExposedPorts}}'
docker run --rm --platform linux/amd64 --entrypoint sh "$WORKER" -lc '
  set -eu
  test -f /app/workers/agent-worker/main.ts
  node --version
  pnpm --version
'
```

O `Dockerfile.worker` expõe `8787`; o compose continuará a verificar
`http://127.0.0.1:8787/healthz` quando o worker estiver rodando. Não iniciar o
worker do builder com segredos nem tentar provar integração com a VPS.

5. Guardar tempo, exit code, SHA e digests. Não guardar logs que contenham
   credenciais ou variáveis de ambiente.

**Rollback/abort**

- Se qualquer build, push, inspeção, plataforma ou conteúdo falhar: não publicar
  outra tag e não tocar na VPS. Preservar digests já existentes para diagnóstico.
- **PRECISA DONO.** Revogar o PAT de push se houver suspeita de exposição. Não
  apagar tags/imagens sem autorização; isso não é necessário para rollback.

## 3. Pré-condição de Compose: `WORKER_IMAGE` (uma linha)

**Pre-check**

- **PRECISA DONO + revisão de código.** Confirmar no diff que esta é a única
  mudança de contrato: o serviço `worker` deixa de depender do `build:` no
  compose de produção e passa a aceitar referência por variável.
- O arquivo atual tem `build: Dockerfile.worker` no `worker`; sem a linha de
  imagem o `up worker` pode reconstruir na VPS. Não contornar esse gap com
  comando manual. A revisão deve provar que a referência por imagem é usada no
  caminho de produção e que o build local continua disponível no override
  apropriado.

**Ação**

- Em alteração separada e revisada (não nesta tarefa), adicionar somente esta
  linha ao serviço `worker`, sem remover o build local:

```yaml
image: ${WORKER_IMAGE:?set WORKER_IMAGE}
```

- Manter o build local em override/arquivo apropriado, sem carregá-lo no deploy.

**Verificação**

```sh
docker compose -f docker-compose.lumenva.prod.yml --env-file .env config \
  | sed -n '/^services:/,$p' | rg -n 'app:|worker:|image:|build:|pull_policy:'
```

Esperado: `app.image` e `worker.image` existem e apontam para refs por digest no
rollout. Confirmar que o comando de produção não invoca build e que o build local
continua restrito ao override/fluxo de desenvolvimento. Confirmar a interpolação
sem imprimir `.env` (`docker compose config --environment` só em ambiente
controlado).

**Rollback/abort**

- **PRECISA DONO.** Se a revisão encontrar qualquer alteração além da linha,
  abortar e voltar o diff dessa alteração separada; não executar `up`.
- Se `WORKER_IMAGE` estiver ausente, ou a revisão mostrar que o caminho de
  produção ainda pode reconstruir sem a imagem aprovada, abortar antes da janela
  de produção.

## 4. VPS: pull por digest e rollout sequencial

**Pre-check**

- **PRECISA DONO MAIS JANELA.** Confirmar backup verificado do `.env`, digests
  atuais de app/worker, espaço, RAM/swap, 11 serviços e volumes/redes intactos.
- Criar token GHCR separado, classic, somente `read:packages`; não reutilizar o
  PAT do builder. Confirmar que o dono aceita que `~/.docker/config.json` pode
  conter credencial codificada e será protegido.
- Confirmar que `WORKER_IMAGE` já foi revisado e que ambos os digests foram
  lidos no passo 2. Não iniciar se qualquer imagem não estiver disponível.

**Ação**

1. **PRECISA DONO MAIS JANELA.** Na VPS, login por stdin e depois pulls
   explícitos. Não imprimir `config.json` nem token:

```sh
umask 077
read -r -s GHCR_READ_PAT
printf '%s' "$GHCR_READ_PAT" | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
unset GHCR_READ_PAT
chmod 600 /root/.docker/config.json
docker pull ghcr.io/trydavidqix/lumenva@sha256:<APP_DIGEST>
docker pull ghcr.io/trydavidqix/lumenva-worker@sha256:<WORKER_DIGEST>
```

2. Fazer backup do `.env` conforme runbook de produção, sem o imprimir, e
   definir `APP_IMAGE` e `WORKER_IMAGE` para os refs por digest. Definir
   `APP_PULL_POLICY=missing`. Não alterar outras variáveis.
3. Subir app e, somente após a verificação imediata do app, worker:

```sh
cd /root/deskcommcrm
docker compose -f docker-compose.lumenva.prod.yml --env-file .env up -d --no-deps app
# verificar app antes de continuar
docker compose -f docker-compose.lumenva.prod.yml --env-file .env up -d --no-deps worker
```

Não usar `docker-compose.build.yml`, `build`, `down` ou `--force-recreate` fora
da decisão explícita da janela.

**Verificação**

- Imediata: `docker compose ... ps` e healthchecks dos 11 containers. O endpoint
  público esperado é HTTP `307`:

```sh
docker compose -f docker-compose.lumenva.prod.yml --env-file .env ps
docker inspect lumenva-app-1 --format '{{json .State.Health}}'
docker inspect lumenva-worker-1 --format '{{json .State.Health}}'
curl -skI https://app.lumenva.pt/
curl -skI https://crm.lumenva.pt/
docker logs --since=10m lumenva-caddy-1
docker logs --since=10m lumenva-app-1
docker logs --since=10m lumenva-worker-1
docker logs --since=10m lumenva-waha-1
docker logs --since=10m lumenva-scheduler-1
```

- Confirmar WAHA/sessão, scheduler/cron e ausência de crash loop, sem imprimir
  números, payloads, cookies ou tokens.
- Aos 5, 15 e 30 minutos, registrar `docker compose ps`, `docker stats
  --no-stream`, `free -h`, `/proc/loadavg` e swap. Confirmar os 11 healthchecks,
  HTTP `307`, logs de Caddy/app/worker/WAHA/cron e volumes/redes externos
  inalterados.

**Rollback**

- **PRECISA DONO MAIS JANELA.** Se healthcheck, HTTP, WAHA, cron, logs, RAM ou
  swap falhar, restaurar `APP_IMAGE` e `WORKER_IMAGE` aos digests antigos e
  executar `up -d --no-deps app` e depois `worker`, sem `down`:

```sh
docker compose -f docker-compose.lumenva.prod.yml --env-file .env up -d --no-deps app
docker compose -f docker-compose.lumenva.prod.yml --env-file .env up -d --no-deps worker
```

- Se o rollback depender de imagem apenas local, usar temporariamente o valor
  anterior de `APP_PULL_POLICY`/`WORKER_IMAGE`, sem remover a imagem nova.
- Revalidar healthchecks, HTTP e logs; manter a evidência para investigação.

## 5. Reclaim de espaço Docker na VPS

**Pre-check**

- **PRECISA DONO.** Medir `df -h`, `docker system df` e listar exatamente as
  imagens órfãs antes de qualquer remoção. Confirmar alvo aproximado: `docker
  builder prune` recupera cerca de 5.8 GB; imagens órfãs listadas, cerca de 7.4
  GB. Os números são estimativas e não autorização automática.
- Confirmar que nenhum build/deploy está em curso e que volumes/redes não fazem
  parte da lista.

**Ação**

- **PRECISA DONO.** Executar somente `docker builder prune` para o cache aprovado
  e remover somente as imagens órfãs previamente listadas e confirmadas. Não
  usar `docker system prune`, `docker volume prune`, `docker network prune`,
  `-a`, `down -v` ou remoção por glob.

**Verificação**

- Repetir `df -h`, `docker system df` e a lista de volumes/redes/containers;
  registrar bytes realmente recuperados e exit code. Confirmar que os 11
  serviços e volumes permanecem presentes.

**Rollback/abort**

- Prune não tem rollback automático. Abortará antes da ação se a lista mudar,
  se houver volume/rede envolvido, ou se o espaço recuperável divergir muito do
  esperado. Imagens necessárias devem ser repuxadas por digest, nunca por
  `latest`.

## 6. Parar os quatro sidecars de IA, depois de prova de segurança

**Pre-check**

- **PRECISA DONO MAIS JANELA.** Confirmar no Supabase que nenhuma organização
  está a usar mem0/graphiti, ou definir canary aprovado. Confirmar backup dos
  volumes `mem0-postgres` e `neo4j` com checksum verificável, sem copiar dados
  para o builder e sem imprimir conteúdo.
- Confirmar nomes/estado dos quatro serviços: `mem0`, `mem0-postgres`, `neo4j`
  e `graphiti`, e impacto aceito no runtime.

**Ação**

- **PRECISA DONO MAIS JANELA.** Parar individualmente com `docker compose stop`
  (ou `docker stop`) apenas os quatro sidecars. Nunca usar `down`, `down -v`,
  remover containers, volumes ou redes.

**Verificação**

- Confirmar estado `Exited` apenas nos quatro alvos, app/worker/WAHA/Redis/SRH/
  scheduler/Caddy saudáveis, volumes e redes ainda anexados e ausência de
  escrita inesperada nos volumes. Recolher RAM/swap antes/depois.

**Rollback**

- **PRECISA DONO MAIS JANELA.** Reativar somente com `docker compose start mem0
  mem0-postgres neo4j graphiti` (ou `docker start` dos nomes confirmados), nunca
  recriar com `up` se isso puder trocar imagem/volume. Revalidar healthchecks e
  a canary.

## 7. Scheduler externo opcional

**Pre-check**

- **PRECISA DONO.** Escolher exatamente um executor: scheduler externo, GitHub
  Actions cron ou o próprio builder a chamar o URL público. Confirmar que o
  endpoint é autenticado, idempotente, rate-limited e observável; não introduzir
  um segundo cron concorrente.

**Ação**

- Só depois de prova de idempotência e janela aprovada, configurar o executor
  escolhido. O builder não deve tornar-se runtime permanente nem aceitar
  chamadas internas da VPS.

**Verificação/rollback**

- Executar um canary não destrutivo, verificar uma única execução por chave e
  timestamp, e observar logs sem PII. Desativar o executor se houver duplicação,
  drift de horário, custo ou ausência de audit; manter o scheduler atual até a
  substituição ser provada.

## Critérios de abortar e estado de não execução

Abortar imediatamente se: PhotoRec ainda estiver em curso; faltar aprovação do
dono; aparecer segredo no builder/contexto/log; o SHA ou digest não for fixo; o
Compose ainda puder reconstruir o worker no caminho de produção sem a imagem
aprovada; GHCR não aceitar escopo mínimo; o worker/app falhar inspeção;
healthcheck, HTTP `307`, WAHA, cron, RAM/swap ou volume divergir; ou qualquer
passo pedir `down`, `rm`, `prune` amplo, migration ou alteração de rede/volume.

Neste commit documental: **não executado** — SSH no PC, login GHCR, buildx,
push, inspeção de imagem, alteração de Compose, token read-only, pull/deploy na
VPS, prune, parada de sidecars e scheduler externo.

## Checklist de aprovação do dono

- [ ] PhotoRec terminou; builder pode ser acedido.
- [ ] SHA fixado; packages GHCR privados; PAT push e PAT read separados.
- [ ] Build/push `linux/amd64` de app e worker com dois digests.
- [ ] Conteúdo app (`server.js`, `.next/static`, `public`, `ffmpeg`) e worker
      (`healthz`/porta 8787) verificados sem segredos.
- [ ] Alteração isolada de uma linha `WORKER_IMAGE` revisada.
- [ ] Janela de produção aprovada; backup `.env`, volumes e digests antigos
      verificados.
- [ ] Rollout app → worker e observação aos 5/15/30 minutos autorizados.
- [ ] Prune limitado e sidecars somente com prova Supabase/canary e checksum.
- [ ] Opcional de scheduler aprovado somente após idempotência.
