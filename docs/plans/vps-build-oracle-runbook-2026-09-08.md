# Runbook: builder Oracle Always Free → GHCR → VPS pull

Data: 2026-09-08  
Branch: `audit/vps-rightsizing-2026-09-08`  
Estado: plano documental. Nenhuma conta Oracle foi criada, nenhum token foi gerado, nenhum build foi executado, nenhuma imagem foi publicada e nenhuma alteração foi feita na VPS ou no GitHub.

## Objetivo e invariantes

Retirar o build pesado da VPS de produção. Uma VM Oracle Cloud Infrastructure Always Free faz o build das imagens `linux/amd64`; o GHCR privado armazena os artefatos; a VPS apenas autentica em modo read-only, puxa por digest e reinicia `app` e `worker` em uma janela aprovada.

Invariantes:

- O repositório `trydavidqix/Lumenva` permanece privado.
- A VM Oracle não recebe `.env`, credenciais Supabase, credenciais WAHA, dados de clientes, volumes de produção ou segredos de runtime.
- Segredos não entram em contexto Docker, `ARG`, `ENV`, labels, cache, artifacts, logs ou tags.
- A imagem de produção é imutável por digest. Tags `sha-<commit>` são apenas referência humana.
- `APP_PULL_POLICY=missing` é intencional: com digest fixo, evita que um restart dependa de nova conexão ao GHCR. O pull inicial/rollout continua explícito.
- Os gates `ci`, `e2e` e `perf` permanecem OFF de propósito. O gate local aceito é `pnpm gov:verify`; isto é uma decisão consciente, não efeito colateral do builder.
- Supabase/Postgres continua no Supabase Cloud. Este runbook não aplica migrations.
- Asterisk continua fora dos 11 containers e entra no orçamento de RAM da VPS.
- A ordem é estritamente sequencial. Nenhuma etapa é executada em paralelo.

## Limites gratuitos e fontes oficiais

Oracle informa que Always Free deve ser criado na região home e inclui, para A1, 1.500 OCPU-horas e 9.000 GB-horas/mês, equivalentes a 2 OCPU e 12 GB; inclui 200 GB de Block Volume combinados e cinco backups. Também inclui 10 TB/mês de outbound data. Instâncias com CPU, rede e, para A1, memória abaixo de 20% no percentil 95 durante sete dias podem ser reclamadas. A1 pode sofrer `out of host capacity`; não converter para Pay As You Go apenas para contornar esse erro sem aprovação. Fontes: [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm).

Docker documenta Docker Engine para Ubuntu 22.04/24.04 LTS em amd64 e arm64, o driver `docker-container`, `buildx --platform` e QEMU/binfmt para emulação. A emulação é a estratégia mais simples, mas pode ser muito mais lenta em compilação e compressão. Fontes: [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [Multi-platform builds](https://docs.docker.com/build/building/multi-platform/), [buildx build reference](https://docs.docker.com/reference/cli/docker/buildx/build/).

O GHCR exige PAT classic para publicar/instalar imagens privadas. `read:packages` permite pull; `write:packages` permite pull e push; `delete:packages` não é necessário. O login documentado é `echo "$CR_PAT" | docker login ghcr.io -u USERNAME --password-stdin`. Fontes: [Working with the Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [Publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).

## Estado conhecido do repositório

- App: `Dockerfile`, Next standalone, Node 22 Alpine, `server.js`, `.next/static`, `public` e `ffmpeg` no runtime.
- Worker: `Dockerfile.worker`, Node 22 Alpine, `pnpm exec tsx workers/agent-worker/main.ts`, health endpoint em `8787/healthz`.
- `mem0-src/` deve continuar no `.dockerignore`.
- O build do app usa placeholders `NEXT_PUBLIC_*`; valores reais entram em runtime via `.env` da VPS.
- Build histórico na VPS levou aproximadamente quatro minutos e já houve incidente de OOM com 4 GB de swap.
- **Gap obrigatório:** `docker-compose.lumenva.prod.yml` atualmente tem `image:` para `app`, mas `worker` ainda tem apenas `build:` de `Dockerfile.worker`. Antes de um rollout “VPS só pull”, será necessário alterar o contrato do compose para uma `WORKER_IMAGE` por digest e remover/desativar o `build:` nesse caminho. Este runbook não faz essa alteração. Se ela não existir, o passo do worker deve abortar em vez de reconstruir na VPS.

## Ordem de execução

### 0. Aprovação, inventário e abort criteria

**Pre-check**

- Confirmar que a branch/documentação foi revisada e que o dono aprovou a Opção B.
- Confirmar que nenhum passo abaixo foi executado previamente.
- Fixar o SHA do código que será construído (`git rev-parse <ref>`), a região home OCI e o IP público do dono para SSH.
- Confirmar orçamento de armazenamento: boot volume 50 GB (ou mínimo de 47 GB documentado), eventual volume adicional e backups permanecem dentro dos 200 GB totais.
- Confirmar que a VM de build não será usada para runtime, banco, WAHA ou dados reais.

**Ação**

- **PRECISA DONO.** Aprovar conta Oracle, região, custos fora do Always Free, criação de chaves e janela futura da VPS.

**Verificação**

- Registrar apenas identificadores não sensíveis: região, shape, OCPU/RAM, volume e SHA. Nunca registrar cartão, chave privada, PAT ou `.env`.

**Rollback/abort**

- Antes de qualquer criação, abortar se não houver região home confirmada, limite Always Free disponível ou aprovação de custo zero.

### 1. Provisionar VM Oracle Always Free

**Pre-check**

- Console OCI → região home → **Compute → Instances → Create instance**.
- Confirmar imagem **Ubuntu LTS** marcada como Always Free eligible e arquitetura ARM64.
- Confirmar shape `VM.Standard.A1.Flex`, 2 OCPU e 12 GB RAM. Essa é a capacidade completa Always Free A1; não criar outro A1 ou E2 que consuma a mesma quota.
- Confirmar boot volume dentro dos 200 GB totais e outbound dentro de 10 TB/mês.
- Confirmar ausência de IP/porta de produção; a VM é apenas builder.

**Ação**

- **PRECISA DONO.** Criar a tenancy/conta, escolher a região home e provisionar a VM A1.
- **PRECISA DONO.** Gerar uma chave SSH dedicada no computador do dono. A chave privada fica somente no computador do dono, com permissões locais restritas; a chave pública é inserida na VM.
- Criar VCN/subnet pública somente se necessário para SSH. Security List/NSG: entrada TCP 22 exclusivamente do IP público atual do dono (`<IP_DO_DONO>/32`); nenhuma entrada para 80, 443, Docker, BuildKit, GHCR ou portas de aplicação. Egress necessário para apt, GitHub e GHCR pode ser permitido; regras são stateful.
- Não atribuir chave, PAT ou `.env` durante o wizard.

**Verificação**

- **PRECISA DONO.** Confirmar no console que a instância está etiquetada Always Free eligible, `VM.Standard.A1.Flex`, 2 OCPU/12 GB, Ubuntu LTS e volume na região home.
- Testar somente SSH a partir do IP autorizado: `ssh -i <CHAVE_PRIVADA_LOCAL> ubuntu@<IP_BUILDER> 'uname -m; . /etc/os-release; echo "$PRETTY_NAME"'`. Esperado: `aarch64` e Ubuntu LTS.
- Verificar que portas 80/443/2375/2376/8787 não aceitam conexão externa.

**Fallback e rollback**

- Se A1 der `out of host capacity`, tentar outra availability domain da região home ou aguardar; não trocar automaticamente para conta paga.
- `VM.Standard.E2.1.Micro` AMD (até duas instâncias, 1 GB cada) é fallback de capacidade de controle, mas **não passa o pre-check de memória para este build**. O Next/Sentry já exige heap de 4 GB. Só usar E2 se um build de prova autorizado demonstrar memória suficiente ou se a estratégia de build for alterada; caso contrário, abortar e tentar A1 novamente.
- Rollback antes do uso: **PRECISA DONO.** Terminar a instância e apagar o boot volume somente se o dono confirmar que não há dados a preservar; não fazer isso automaticamente.

### 2. Bootstrap seguro do builder

**Pre-check**

- SSH como `ubuntu`; confirmar `uname -m`, Ubuntu LTS, disco livre, swap e relógio NTP.
- Confirmar que nenhum pacote Docker não-oficial deve ser preservado. Docker alerta que `docker.io`, `docker-compose`, `docker-buildx`, `podman-docker`, `containerd` e `runc` podem conflitar com os pacotes oficiais.

**Ação**

- **PRECISA DONO.** Autorizar downloads/instalações. Seguir o repositório apt oficial Docker para Ubuntu LTS; instalar `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` e `docker-compose-plugin`. Não usar o convenience script em produção.
- Instalar `qemu-user-static`/`binfmt-support` conforme necessidade do host e registrar binfmt com a imagem oficial `tonistiigi/binfmt`, somente uma vez, usando o privilégio necessário.
- Criar utilizador dedicado `builder` sem login root. O daemon Docker rootful pode ser administrado por `builder` através do grupo `docker`, mas esse grupo é equivalente a root; documentar essa decisão. Se a revisão de segurança exigir isolamento mais forte, usar Docker rootless e ajustar o builder antes de continuar.
- Configurar `docker buildx create --name lumenva-builder --driver docker-container --bootstrap --use`.
- Ativar `unattended-upgrades` para correções de segurança; não permitir upgrade automático que reinicie durante build sem janela/monitorização.
- Criar diretórios restritos: `/srv/lumenva-builder/src`, `/srv/lumenva-builder/logs` e `/home/builder/.docker` com owner `builder`.

**Verificação**

```sh
docker version
docker buildx version
docker buildx inspect --bootstrap
docker buildx ls
test -r /proc/sys/fs/binfmt_misc/qemu-x86_64
grep -w F /proc/sys/fs/binfmt_misc/qemu-x86_64
systemctl is-active docker unattended-upgrades
```

Esperado: Docker ativo, builder `lumenva-builder` bootstrapped e `F` presente no registro binfmt. Confirmar `docker info` sem expor credenciais.

**Rollback/abort**

- Abort se o kernel não oferecer binfmt, o builder não inicializar, o daemon aceitar conexão pública ou a instalação sair da arquitetura/versão suportada.
- Remover apenas o builder de teste com `docker buildx rm lumenva-builder` se não houver build em curso; não usar prune amplo nem apagar `/var/lib/docker`.

### 3. Credenciais GHCR no builder

**Pre-check**

- Confirmar que o package namespace será `ghcr.io/trydavidqix/lumenva` e `ghcr.io/trydavidqix/lumenva-worker`.
- Confirmar que as imagens serão privadas e que não será usado `GITHUB_TOKEN` fora de Actions.

**Ação**

- **PRECISA DONO.** Criar PAT **classic** dedicado para publicação com `write:packages` e `read:packages`; não selecionar `delete:packages`. A documentação alerta que a UI pode marcar `repo` ao escolher `write:packages`; remover `repo` se a UI permitir e usar a URL de escopo mínimo documentada.
- Preferir dois tokens: PAT de push somente no builder e PAT separado de pull somente na VPS. Se uma única credencial temporária for usada para o primeiro teste, ela deve ser substituída antes do rollout.
- No builder, guardar o valor fora do Git, por exemplo em `/home/builder/.config/lumenva/ghcr-push-token` com mode `600`, owner `builder`, ou inserir interativamente sem histórico de shell. Nunca exportar em logs, `ps`, systemd unit, Dockerfile ou build args.
- Login somente por stdin:

```sh
umask 077
read -r -s CR_PAT
printf '%s' "$CR_PAT" | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
unset CR_PAT
```

- Confirmar que `~/.docker/config.json` é `0600` e que não contém valores em backups/logs. Docker armazena a credencial base64 quando não há credential helper; base64 não é cifragem.

**Verificação**

- `docker login` retorna sucesso sem imprimir o token. Testar apenas leitura de metadata de um package permitido; não fazer push ainda.
- Confirmar no GitHub que o package continua privado e ligado ao repositório correto.

**Rotação/rollback**

- **PRECISA DONO.** Revogar o PAT no GitHub e remover o ficheiro/token local quando houver suspeita, mudança de operador ou fim da fase de teste. Criar novo token e repetir login; nunca editar histórico de shell para “limpar” um segredo já exposto.
- Abort se o token tiver `repo`, `delete:packages`, `admin:*`, ou se aparecer em `docker inspect`, logs ou arquivos versionados.

### 4. Clonar o repositório sem segredos

**Pre-check**

- Confirmar SHA alvo e que o clone será somente código/lockfile. Nenhum `.env`, backup, volume ou export de produção acompanha o clone.
- Escolher chave de deploy dedicada da VM, read-only, em vez de reutilizar chave pessoal ou deploy key de produção.

**Ação**

- **PRECISA DONO.** Criar uma chave SSH dedicada para `builder` e adicioná-la ao repositório como deploy key **read-only**. Não reutilizar a chave da VPS.
- Fixar `known_hosts` para GitHub por fingerprint verificado. Clonar em `/srv/lumenva-builder/src`:

```sh
git clone git@github.com:trydavidqix/Lumenva.git /srv/lumenva-builder/src
cd /srv/lumenva-builder/src
git checkout --detach <SHA_ALVO>
git status --short
```

- Não copiar `.env`, `.env.*` real, `/root/deskcommcrm`, volumes, secrets ou artifacts da VPS.

**Verificação**

- `git rev-parse HEAD` bate com `<SHA_ALVO>`; `git status --short` está limpo; `find . -maxdepth 1 -name '.env*' -type f` retorna somente exemplos autorizados, nunca valores de produção.
- Confirmar `.dockerignore` exclui `mem0-src/`, `.env*`, chaves, dumps e caches locais.

**Rollback**

- Antes de qualquer build, remover o clone somente com autorização; não apagar a chave no GitHub até confirmar que nenhum build depende dela. Nunca executar `git clean -fdx` sem escopo e backup.

### 5. Primeiro build de teste e publicação por SHA

**Pre-check**

- **PRECISA DONO.** Autorizar publicação de imagens de teste privadas no GHCR. Confirmar que o SHA foi revisado e que `pnpm gov:verify` local já foi o gate escolhido; não executar `ci`, `e2e` ou `perf` no builder como efeito colateral.
- Confirmar que o builder tem disco livre para duas imagens/cache e que nenhuma credencial está no contexto.
- Confirmar que `Dockerfile` usa placeholders públicos e que `Dockerfile.worker` não precisa de `.env` para instalar/buildar.

**Ação**

```sh
cd /srv/lumenva-builder/src
SHA="$(git rev-parse --short=12 HEAD)"
APP="ghcr.io/trydavidqix/lumenva:sha-${SHA}"
WORKER="ghcr.io/trydavidqix/lumenva-worker:sha-${SHA}"

docker buildx build \
  --builder lumenva-builder \
  --platform linux/amd64 \
  --file Dockerfile \
  --tag "$APP" \
  --push \
  .

docker buildx build \
  --builder lumenva-builder \
  --platform linux/amd64 \
  --file Dockerfile.worker \
  --tag "$WORKER" \
  --push \
  .
```

Não usar `--build-arg` para segredos. Não usar `latest` como referência de deploy. O output do BuildKit pode mostrar somente status, digest e tempo; redigir qualquer URL/token se uma ferramenta imprimir metadata.

**Verificação da imagem e digest**

```sh
docker buildx imagetools inspect "$APP"
docker buildx imagetools inspect "$WORKER"
APP_DIGEST="$(docker buildx imagetools inspect "$APP" --format '{{json .Manifest.Digest}}')"
WORKER_DIGEST="$(docker buildx imagetools inspect "$WORKER" --format '{{json .Manifest.Digest}}')"
```

Guardar somente os dois digests e o SHA em um registro operacional sem secrets. Confirmar que cada manifest tem apenas `linux/amd64` e que o package continua privado.

**Inspeção de conteúdo, ainda fora da produção**

```sh
docker run --rm --platform linux/amd64 --entrypoint sh "$APP_DIGEST" -lc '
  set -eu
  test -f /app/server.js
  test -d /app/.next/static
  test -d /app/public
  command -v ffmpeg
  node --version
  id
'

docker run --rm --platform linux/amd64 --entrypoint sh "$WORKER_DIGEST" -lc '
  set -eu
  test -f /app/workers/agent-worker/main.ts
  node --version
  pnpm --version
'
```

Além do conteúdo, verificar o contrato de health do worker sem fornecer segredos: `docker image inspect "$WORKER_DIGEST" --format '{{json .Config.ExposedPorts}} {{json .Config.Healthcheck}}'` deve mostrar a porta `8787` se houver healthcheck embutido. O endpoint `/healthz` é a prova de runtime no passo 7; se for necessário iniciar um container isolado para essa prova, usar apenas variáveis não secretas explicitamente documentadas e destruí-lo ao terminar. Nunca usar o `.env` da VPS no builder.

Para o worker, `/healthz` é validado no passo de compose/prod porque o processo deve estar rodando; a imagem não deve ser chamada com segredos de produção no teste.

**Verificação final do passo**

- App: `server.js`, `.next/static`, `public` e `ffmpeg` presentes; usuário não-root; plataforma `linux/amd64`.
- Worker: source/runtime esperado e Node/pnpm disponíveis; nenhuma camada contém `.env` real, token ou chave.
- Registar tempo de cada build, pico de disco/RAM e digest. Esse registro não é prova de deploy.

**Rollback**

- Como é teste privado, apagar tags de teste somente após preservar os digests e com autorização. Revogar o PAT de push ao terminar. Não apagar o clone/volume se for necessário diagnosticar; não fazer prune global.

### 6. Preparar o contrato de imagem do worker

**Pre-check**

- Confirmar que o compose em produção ainda contém `build:` no serviço `worker`. No estado atual, `docker compose up worker` reconstruiria na VPS.

**Ação**

- **PRECISA DONO + revisão de código antes da janela.** Alterar o compose em uma mudança separada e revisada para aceitar `WORKER_IMAGE` e usar a referência por digest, removendo o `build:` do caminho normal. O override de build local pode continuar em arquivo separado, mas não deve ser carregado no deploy.
- Confirmar que `app` também recebe `APP_IMAGE` por digest e `APP_PULL_POLICY=missing` no `.env` da VPS, sem registrar o valor de nenhum outro segredo.

**Verificação**

```sh
docker compose -f docker-compose.lumenva.prod.yml --env-file .env config \
  | sed -n '/^services:/,$p' | rg -n 'app:|worker:|image:|build:|pull_policy:'
```

Esperado: `app.image` e `worker.image` por digest; nenhum `build:` em ambos no caminho de produção; `pull_policy: missing` para app e equivalente explícito para worker.

**Rollback/abort**

- Se o compose ainda tiver `build:` no worker, abortar antes da janela. Não contornar com build manual na VPS. Rollback da configuração é a versão anterior do ficheiro/commit, sem `docker compose down`.

### 7. Rollout na VPS: pull e app primeiro, worker depois

**Pre-check**

- **PRECISA DONO + JANELA DE PRODUÇÃO.** Confirmar backup verificado do `.env`, imagem local antiga e digests antigos de app/worker.
- Confirmar espaço, RAM/swap, volumes e networks. Nenhum volume deve ser recriado ou removido.
- Confirmar que o token VPS é separado, classic PAT com somente `read:packages`, e que o owner sabe que `~/.docker/config.json` guarda base64 não cifrado.

Registrar o rollback antes de trocar qualquer referência, sem imprimir valores:

```sh
docker image inspect deskcomm-app:local --format 'app-local-id={{.Id}} repo-digests={{json .RepoDigests}}'
docker image inspect <WORKER_REF_LOCAL> --format 'worker-local-id={{.Id}} repo-digests={{json .RepoDigests}}'
```

Se a imagem antiga não tiver `RepoDigests`, o `Image ID` local é a âncora de rollback; não removê-la até o período de observação terminar.

**Ação: credencial e pull explícito**

```sh
umask 077
read -r -s GHCR_READ_PAT
printf '%s' "$GHCR_READ_PAT" | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
unset GHCR_READ_PAT
chmod 600 /root/.docker/config.json

docker pull ghcr.io/trydavidqix/lumenva@sha256:<APP_DIGEST>
docker pull ghcr.io/trydavidqix/lumenva-worker@sha256:<WORKER_DIGEST>
docker image inspect ghcr.io/trydavidqix/lumenva@sha256:<APP_DIGEST> \
  --format '{{.RepoDigests}}'
docker image inspect ghcr.io/trydavidqix/lumenva-worker@sha256:<WORKER_DIGEST> \
  --format '{{.RepoDigests}}'
```

Não colar PAT no comando, não usar `-p`, não imprimir `config.json` e não colocar token em `.env` versionado. Se Docker tiver credential helper compatível, preferi-lo; caso contrário, proteger o ficheiro e aceitar que base64 não é cifragem.

**Ação: atualizar referência e subir app, depois worker**

- **PRECISA DONO + JANELA DE PRODUÇÃO.** Fazer backup do `.env` sem imprimir valores, substituir somente `APP_IMAGE`/`WORKER_IMAGE` pelos digests aprovados e `APP_PULL_POLICY=missing`.
- Usar o compose normal, nunca `docker-compose.build.yml`:

```sh
cd /root/deskcommcrm
docker compose -f docker-compose.lumenva.prod.yml --env-file .env up -d --no-deps app
# Após a verificação do app:
docker compose -f docker-compose.lumenva.prod.yml --env-file .env up -d --no-deps worker
```

**Verificação imediata**

```sh
docker compose -f docker-compose.lumenva.prod.yml --env-file .env ps app worker caddy waha redis srh scheduler
docker inspect lumenva-app-1 --format '{{json .State.Health}}'
docker inspect lumenva-worker-1 --format '{{json .State.Health}}'
curl -skI https://app.lumenva.pt/
curl -skI https://crm.lumenva.pt/
docker logs --since=10m lumenva-caddy-1
docker logs --since=10m lumenva-app-1
docker logs --since=10m lumenva-worker-1
```

Esperado: healthchecks verdes, HTTP público `307` conforme contrato atual, Caddy sem erros novos, app sem crash loop e worker respondendo no healthcheck `http://127.0.0.1:8787/healthz` dentro do container.

**Verificação estendida, em série**

- Aos 5, 15 e 30 minutos: `docker stats --no-stream`, `free -h`, `cat /proc/loadavg`, uso de swap e `docker compose ps`.
- Confirmar que a sessão WAHA permanece conectada e que um webhook/mensagem de teste autorizado não causa erro; não imprimir número de telefone, payload ou token.
- Confirmar que scheduler/cron continua executando pelo nome do job e timestamp, sem payload sensível.
- Confirmar que volumes `deskcommcrm_*` e networks external permanecem os mesmos; não há `down`, `rm`, `prune` ou migration.

**Rollback**

- **PRECISA DONO + JANELA.** Se qualquer healthcheck, HTTP, WAHA, worker, memória ou log falhar, restaurar `APP_IMAGE` e `WORKER_IMAGE` aos digests locais/anteriores registrados e executar, sem `down`:

```sh
docker compose -f docker-compose.lumenva.prod.yml --env-file .env up -d --no-deps app
docker compose -f docker-compose.lumenva.prod.yml --env-file .env up -d --no-deps worker
```

- Se a imagem antiga só existir localmente, manter `APP_PULL_POLICY=never` apenas durante o rollback documentado; depois restaurar o valor anterior. Não remover a imagem nova nem volumes até a investigação terminar.
- Se o GHCR estiver inacessível após o rollout, `APP_PULL_POLICY=missing` permite restart com a imagem já presente; não forçar `always` durante incidente.

### 8. Keepalive, reclaim e manutenção do builder

**Pre-check**

- Oracle pode reclamar A1 quando CPU, rede e memória ficam abaixo de 20% por sete dias. Um cron leve não garante ultrapassar esses limiares; é keepalive operacional e alerta, não promessa contra reclaim.

**Ação**

- Criar job semanal como `builder` que verifica Docker, faz `git fetch --prune` sem checkout de código secreto, consulta `docker buildx du` e envia apenas status/uso para um destino aprovado. Não usar `stress-ng`, mineração, tráfego artificial ou carga para manipular métricas.
- Agendar backup da configuração não secreta do builder e teste de SSH/health; nunca incluir `/home/builder/.docker/config.json`, PAT, chave privada ou `.env`.
- Manter atualizações de segurança e revisar mensalmente quota/limits no Console OCI. Rebuilds são manuais até existir automação revisada.

**Verificação**

- Confirmar execução do cron sem logs de credenciais, espaço Docker e status `systemctl`. Confirmar no Console que a VM continua Always Free eligible.

**Rollback**

- Desabilitar o cron se gerar custo, carga ou logs excessivos. Se a VM for reclamada, reprovisionar uma nova A1 e repetir bootstrap; os artefatos ficam no GHCR e não nos discos efêmeros do builder.

### 9. Fallback manual no Mac

Se a VM estiver indisponível, o dono pode executar o mesmo build no Mac, sem mudar o repositório nem a VPS:

```sh
docker buildx create --name lumenva-mac --driver docker-container --bootstrap --use
docker buildx build --builder lumenva-mac --platform linux/amd64 -f Dockerfile \
  -t ghcr.io/trydavidqix/lumenva:sha-<SHA> --push .
docker buildx build --builder lumenva-mac --platform linux/amd64 -f Dockerfile.worker \
  -t ghcr.io/trydavidqix/lumenva-worker:sha-<SHA> --push .
```

Docker confirma que QEMU/emulação é mais lenta para workloads de compilação; o Mac deve permanecer ligado e autorizado durante o processo. Não instalar Docker Desktop, Colima ou QEMU nesta tarefa: qualquer download requer autorização explícita. O Mac também não recebe `.env` de produção.

## Checklist final de aceitação

- [ ] **PRECISA DONO:** conta Oracle, região home, shape A1 2 OCPU/12 GB e volume dentro dos 200 GB.
- [ ] **PRECISA DONO:** chave SSH dedicada; entrada OCI somente TCP 22 do IP do dono.
- [ ] Docker CE/buildx/QEMU verificados; builder rootless ou grupo Docker com risco documentado.
- [ ] **PRECISA DONO:** deploy key read-only para o clone; nenhuma chave reutilizada.
- [ ] **PRECISA DONO:** PAT classic de push no builder e PAT classic read-only na VPS; sem `delete:packages`/`repo` desnecessário.
- [ ] Build app e worker `linux/amd64` concluído; dois digests registrados; conteúdo esperado verificado sem secrets.
- [ ] **PRECISA DONO:** compose alterado/revisado para `WORKER_IMAGE`; nenhum `build:` no caminho de produção.
- [ ] **PRECISA DONO + JANELA:** pull autenticado na VPS; `APP_IMAGE`/`WORKER_IMAGE` por digest; `APP_PULL_POLICY=missing`.
- [ ] **PRECISA DONO + JANELA:** app sobe primeiro, worker depois; healthchecks, HTTP 307, Caddy, WAHA, cron, RAM/swap e volumes verificados em 5/15/30 minutos.
- [ ] Rollback por digest antigo testado/documentado; nenhum `down`, `rm`, `prune`, migration ou alteração de volume.
- [ ] Keepalive/alerta configurado sem carga artificial; risco de reclaim permanece explícito.

## O que precisa do dono antes de começar

1. Criar/autorizar a conta OCI, confirmar região home, aceitar chave de cobrança exigida pelo fornecedor e aprovar custo zero estrito.
2. Aprovar o shape A1 e a janela para criar a VM; aceitar que A1 pode sofrer falta de capacidade ou reclaim.
3. Gerar a chave SSH dedicada e fornecer somente a chave pública à VM.
4. Criar a deploy key read-only do repositório e os dois PAT classic: `write:packages`/`read:packages` para o builder e `read:packages` separado para a VPS.
5. Aprovar a alteração separada do compose para `WORKER_IMAGE`; sem ela, abortar antes da produção.
6. Definir a janela de produção e autorizar backup/verificação do `.env`, pull e restart sequencial de app e worker.
7. Autorizar qualquer download de Docker/QEMU no builder e qualquer uso do Mac como fallback.

## Fontes oficiais consultadas

- [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle Cloud Infrastructure Free Tier](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Docker multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
- [Docker buildx build reference](https://docs.docker.com/reference/cli/docker/buildx/build/)
- [GitHub Container Registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitHub publishing Docker images](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)
