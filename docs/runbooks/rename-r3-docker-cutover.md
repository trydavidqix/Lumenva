# R3 — preparação do cutover Docker Deskcomm → Lumenva

Estado: **FASE A preparada, não executada**. Nenhum comando deste documento foi
executado na VPS além das consultas de leitura registadas abaixo. O cutover exige
janela aprovada pelo dono; não fazer `up`, `down`, `pull`, `build`, `rm` ou
`volume prune` como parte desta fase.

## Estado observado na VPS

Auditoria somente leitura em `root@2.29.8.225:/root/deskcommcrm`, em 2026-09-05:

- Compose ativo: `deskcommcrm`; onze containers saudáveis/em execução:
  `app`, `worker`, `waha`, `redis`, `srh`, `scheduler`, `caddy`, `mem0`,
  `mem0-postgres`, `neo4j` e `graphiti`.
- Imagem da aplicação em execução: `deskcomm-app:local`.
- Redes em uso: `deskcommcrm_internal`,
  `deskcommcrm_ai-memory-internal` e `deskcommcrm_ai-graph-internal`.
- Volumes persistentes observados:
  `deskcommcrm_mem0-postgres-data`, `deskcommcrm_neo4j-data`,
  `deskcommcrm_waha-data`, `deskcommcrm_waha-media`,
  `deskcommcrm_caddy-data` e `deskcommcrm_caddy-config`.
- Os volumes `deskcommcrm_mem0-postgres-data` e
  `deskcommcrm_neo4j-data` contêm dados reais restaurados e são tratados como
  **não substituíveis**.
- A topologia real observada usa Caddy; não foi encontrada rede externa
  `traefik`. O override Traefik não deve ser usado sem nova auditoria.

## Artefactos preparados

- `docker-compose.lumenva.prod.yml`
  - projeto Compose explícito `lumenva`;
  - default da imagem: `ghcr.io/trydavidqix/lumenva-crm:latest`;
  - `APP_IMAGE` continua a substituir o default e aceita a imagem legada
    (`APP_IMAGE=deskcomm-app:local`);
  - todos os volumes, inclusive os dois com dados, são `external: true` e
    apontam explicitamente para os nomes existentes `deskcommcrm_*`;
  - as três redes existentes também são externas e mantêm os nomes antigos;
  - não há criação silenciosa de `lumenva_*` para estado existente.
- `docker-compose.lumenva.traefik.yml`
  - labels Traefik passam a usar `lumenva-*`;
  - não altera domínio, CORS, callbacks OAuth ou regras de routing nesta fase;
  - só deve ser combinado após confirmar que a VPS realmente usa Traefik.

Manter as redes com nome antigo é intencional. Renomear uma rede em Docker
exigiria criar outra bridge, reconectar os onze serviços e coordenar a troca do
proxy; isso requer janela e pode causar indisponibilidade. A alteração fica
explicitamente fora desta preparação.

## Cutover futuro — pré-check obrigatório

Executar somente numa janela aprovada e com acesso root confirmado:

```bash
cd /root/deskcommcrm
docker compose -f docker-compose.prod.yml config > /tmp/deskcomm-compose.before.yml
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Networks}}'
docker volume ls
docker network ls
docker compose -f docker-compose.prod.yml ps
df -h
docker system df
```

Confirmar manualmente que os volumes abaixo existem antes de prosseguir:

```bash
docker volume inspect deskcommcrm_mem0-postgres-data deskcommcrm_neo4j-data
```

Abortar se qualquer volume não existir, se o compose ativo divergir deste
inventário, se houver container não saudável, ou se o espaço livre não suportar
os backups.

## Backup dos volumes

Usar destinos de backup em volumes Docker distintos, com espaço suficiente.
O exemplo abaixo não deve ser executado sem escolher e verificar os volumes de
destino:

```bash
docker volume create r3-backup-$(date +%Y%m%d-%H%M%S)
# guardar o nome devolvido na variável BACKUP_VOLUME, sem o substituir por palpite
BACKUP_VOLUME=<volume-de-backup-verificado>

docker run --rm \
  -v deskcommcrm_mem0-postgres-data:/from:ro \
  -v "$BACKUP_VOLUME":/to \
  alpine:3.20 sh -c 'tar czf /to/mem0-postgres-data.tar.gz -C /from .'

docker run --rm \
  -v deskcommcrm_neo4j-data:/from:ro \
  -v "$BACKUP_VOLUME":/to \
  alpine:3.20 sh -c 'tar czf /to/neo4j-data.tar.gz -C /from .'

docker run --rm \
  -v deskcommcrm_waha-data:/from:ro \
  -v "$BACKUP_VOLUME":/to \
  alpine:3.20 sh -c 'tar czf /to/waha-data.tar.gz -C /from .'
```

Verificar tamanho, checksum e possibilidade de listar cada arquivo antes de
qualquer troca:

```bash
docker run --rm -v "$BACKUP_VOLUME":/backup alpine:3.20 \
  sh -c 'ls -lh /backup/*.tar.gz && sha256sum /backup/*.tar.gz && tar tzf /backup/mem0-postgres-data.tar.gz >/dev/null && tar tzf /backup/neo4j-data.tar.gz >/dev/null'
```

## Publicar/carregar a imagem nova

Escolher uma imagem imutável e registar o digest antes da troca. A opção
self-hosted mantém compatibilidade com o fluxo atual:

```bash
APP_IMAGE=deskcomm-app:local APP_PULL_POLICY=never \
  docker compose -f docker-compose.prod.yml -f docker-compose.build.yml \
  --env-file .env build app
docker image inspect deskcomm-app:local --format '{{index .RepoDigests 0}}'
```

Se for usada a imagem GHCR, carregar/publicar primeiro a tag nova e fixar o
digest no `.env`/comando de cutover. Não usar `latest` como prova de identidade
da imagem.

## Subida futura com os nomes Lumenva

Antes de subir, validar os dois ficheiros preparados sem alterar containers:

```bash
docker compose -f docker-compose.lumenva.prod.yml config
```

Topologia Caddy (a observada na auditoria):

```bash
APP_IMAGE=<imagem-verificada> APP_PULL_POLICY=never \
  docker compose -f docker-compose.lumenva.prod.yml --env-file .env \
  --profile ai-memory --profile ai-graph up -d
```

Não executar os dois projects em paralelo se a porta 80/443 estiver publicada
pelo Caddy antigo. A troca de project name recria os serviços; portanto existe
uma breve indisponibilidade e a janela é obrigatória. Os volumes continuam a ser
os `deskcommcrm_*` externos declarados no compose novo.

## Verificação pós-cutover

Confirmar os onze serviços e os healthchecks:

```bash
docker compose -f docker-compose.lumenva.prod.yml ps
docker ps --format '{{.Names}}\t{{.Status}}' | sort
```

Todos os onze devem estar `Up`; os serviços com healthcheck devem estar
`(healthy)`. Confirmar reanexação dos dados:

```bash
docker inspect lumenva-mem0-postgres-1 --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
docker inspect lumenva-neo4j-1 --format '{{range .Mounts}}{{println .Name .Destination}}{{end}}'
```

Os nomes esperados são `deskcommcrm_mem0-postgres-data` em
`/var/lib/postgresql/data` e `deskcommcrm_neo4j-data` em `/data`. Verificar ainda
o proxy e a aplicação sem alterar routing:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<DOMAIN>/
```

O resultado esperado é o redirect de login documentado em `deploy.md`.

## Rollback e critérios de abortar

Backup completo dos seis volumes persistentes observados (somente na janela
aprovada; nunca executar nesta preparação):

```bash
for V in deskcommcrm_mem0-postgres-data deskcommcrm_neo4j-data deskcommcrm_waha-data deskcommcrm_waha-media deskcommcrm_caddy-data deskcommcrm_caddy-config; do
  docker run --rm -v "${V}:/from:ro" -v "$BACKUP_VOLUME:/to" alpine:3.20 sh -c "tar czf /to/${V}.tar.gz -C /from ."
done
docker run --rm -v "$BACKUP_VOLUME:/backup:ro" alpine:3.20 sh -c 'sha256sum /backup/*.tar.gz; for f in /backup/*.tar.gz; do tar tzf "$f" >/dev/null || exit 1; done'
```

Healthcheck explícito dos onze containers após `up` (também somente na janela):

```bash
for C in app worker waha redis srh scheduler caddy mem0 mem0-postgres neo4j graphiti; do
  docker inspect "lumenva-${C}-1" --format "{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}"
done
```

Auditoria name-only do Infisical: se a versão instalada não suportar saída
somente de nomes sem valores, pedir ao dono para listar no Infisical. Nunca
imprimir secrets. Plano de resync: adicionar `LUMENVA_*`, validar duas releases,
manter `DESKCOMM_*` como fallback nesse período e remover os nomes antigos só
com aprovação explícita.

Abortar imediatamente se houver container unhealthy, volume ausente ou vazio,
erro de mount, falha do healthcheck, conflito de porta, ou resposta HTTP fora do
contrato. Não remover volumes para “corrigir” a situação.

Rollback:

```bash
APP_IMAGE=<digest-antigo-verificado> APP_PULL_POLICY=never \
  docker compose -f docker-compose.prod.yml --env-file .env \
  --profile ai-memory --profile ai-graph up -d
```

Se um volume tiver sido corrompido, parar e restaurar somente após autorização,
usando o tar verificado do backup no volume original. Nunca usar `docker compose
down -v`, `docker volume rm`, `docker system prune` ou remover redes durante o
rollback.

O cutover descrito aqui **não foi executado** nesta fase. A VPS não foi alterada.
