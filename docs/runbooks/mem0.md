# Mem0 OSS: operação do sidecar opcional

## Incidente e restore — 2026-09-05 — RESOLVIDO

Entre 22:21 e 22:33 UTC de 2026-09-03, um deploy/rebuild recriou a stack sem os
profiles `ai-memory`/`ai-graph` que eram necessários para os sidecars. Os quatro
containers desapareceram; isto foi acidente operacional, não uma decisão de
desativação. O OOM de 2026-09-02 às 18:43 UTC agravou a pressão durante o build,
mas não foi a causa final. Os volumes `deskcommcrm_mem0-postgres-data` (~73 MB) e
`deskcommcrm_neo4j-data` (~542 MB) foram preservados.

O restore executado na VPS em 2026-09-05 foi:

```bash
# /root/deskcommcrm — swap de 8 GB já existia; não alterar .env
docker pull pgvector/pgvector:pg16
docker pull neo4j:5.26.0
docker pull zepai/graphiti:0.22.0
git clone --depth 1 https://github.com/mem0ai/mem0.git mem0-src
cd mem0-src
git fetch --depth 1 origin 96d45b78c702b742fc91a2ce9eae91805be9144b
git checkout 96d45b78c702b742fc91a2ce9eae91805be9144b
sed -i 's/^psycopg>=/psycopg[binary]>=/' server/requirements.txt
# em server/Dockerfile: RUN mkdir -p /app/history após COPY . .
# e CMD: alembic upgrade head antes de uvicorn
docker build -t mem0-api-server:local server
cd /root/deskcommcrm
docker compose --profile ai-memory --profile ai-graph up -d
docker compose --profile ai-memory ps
docker compose --profile ai-graph ps
```

Os quatro sidecars ficaram `healthy` em aproximadamente 25 segundos, sem
`down`/recreate dos serviços existentes. A knowledge base do Alfred manteve 7
fontes e 46 chunks. A correção permanente está em `2d1c2450`: todo deploy Caddy
ou Traefik deve declarar ambos os profiles (ver `docs/runbooks/deploy.md`).
Não promover as flags: `mem0` permanece `shadow` e qualquer ativação exige
decisão de produto/compliance.

## Wiring no worker — ligado no código, ainda `off` por flag

`workers/agent-worker/main.ts` constrói `Mem0ContextProvider` (via
`buildTurnDeps()`, testado em `main.test.ts`) e injeta em todos os 4 tipos
de turno (`inbound_turn`, `followup_turn`, `case_reply_turn`,
`operator_turn`). Isso significa que o código **já está pronto pra
consultar o Mem0 real** — mas continua um no-op enquanto não houver linha
em `ai_platform_feature_flags` com `feature='mem0'` e `mode` diferente de
`off` (nenhuma existe hoje): o provider checa a flag internamente antes de
chamar `.search()`, então wiring de código e ativação de produto são dois
passos independentes por desenho. Sem `MEM0_BASE_URL`/`MEM0_API_KEY` no
ambiente, o boot cai pro `NullMemoryPort` em vez de falhar — mesmo padrão
já usado em `workers/memory-projection.handler.ts`.

## Limites e estado seguro

O Mem0 é uma projeção semântica descartável, nunca a fonte de verdade do CRM.
As fontes oficiais continuam no PostgreSQL do CRM (mensagens, `lead_notes`,
`org_memory` e eventos). O perfil `ai-memory` vem desligado: `docker compose
up -d` não o inicia. Configurar ou iniciar o serviço não liga a funcionalidade
do produto; a feature por organização permanece `off` até uma decisão explícita
de rollout para `shadow`.

Não publique a API, o dashboard ou o banco por Caddy. Em desenvolvimento a API
pode ser aberta apenas em `127.0.0.1:8888`; em produção não há porta publicada.
O nome DNS interno é `mem0` e só serviços na rede Docker interna podem alcançá-lo.

A imagem do servidor era pinada em `mem0/mem0-api-server:0.1.117`. Essa tag foi
removida do Docker Hub (confirmado em 2026-08-13: `docker pull` retorna "not
found") e a única tag publicada hoje, `latest`, só existe para `linux/arm64` —
sem manifesto `linux/amd64`, não roda nativo num Windows/PC comum (x86_64).
Puxar `latest` forçando `--platform linux/arm64` funciona via emulação do
Docker Desktop, mas fica lento; não é o caminho recomendado.

O caminho atual é **build local a partir do source oficial**, com três
correções necessárias sobre o `server/Dockerfile` de `mem0ai/mem0` — sem elas
o container quebra na inicialização em qualquer máquina limpa, não só
Windows:

1. `requirements.txt` pede `psycopg` puro; sem `libpq` no sistema (ausente na
   imagem base `python:3.12-slim`), o import falha. Trocar para
   `psycopg[binary]`.
2. O código espera `/app/history` já existir (`HISTORY_DB_PATH`); o
   `Dockerfile` nunca cria essa pasta — só funciona por acidente no compose
   oficial deles porque um `volumes:` mapeado cria a pasta de brinde. Sem
   volume, o boot quebra. Adicionar `RUN mkdir -p /app/history`.
3. O `Dockerfile` sobe `uvicorn` direto, sem migração. O schema
   (`users`, `api_keys` etc.) só existe depois de `alembic upgrade head`.
   Trocar o `CMD` para rodar a migração antes de subir o servidor.

Passo a passo (build único; a imagem fica salva localmente depois):

```bash
git clone --depth 1 https://github.com/mem0ai/mem0.git mem0-src
cd mem0-src && git log -1 --format=%H   # confirme/anote o commit — é o pin

# 1) troca psycopg puro por psycopg[binary] (evita depender de libpq do SO)
sed -i 's/^psycopg>=/psycopg[binary]>=/' server/requirements.txt

# 2) garante /app/history antes do EXPOSE, e 3) roda alembic antes do uvicorn
# — editar server/Dockerfile:
#   depois de `COPY . .`:          RUN mkdir -p /app/history
#   trocar o CMD por:              CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"]

docker build -t mem0-api-server:local server
```

Commit fonte validado nesta receita: `96d45b78c702b742fc91a2ce9eae91805be9144b`
(2026-08-13). Uma atualização de commit exige repetir a validação completa
abaixo antes de promover — mesmo espírito do pin antigo, só que agora contra
um commit do source em vez de uma tag de imagem que pode sumir.

O banco (`mem0-postgres`) também precisa criar um segundo banco
(`mem0_app`, para users/api-keys, separado do banco de vetores). O compose
deste repo já monta `docker/mem0/init-db.sh` (cópia do `init-db.sh` oficial,
Apache-2.0) em `/docker-entrypoint-initdb.d/`. Se copiar esse arquivo de novo
a partir do checkout do source no Windows, salve-o com quebra de linha LF —
CRLF faz o entrypoint do Postgres falhar com "cannot execute: required file
not found" (o interpretador do shebang `#!/bin/bash\r` não é encontrado).

Este runbook é para a máquina Windows com Docker já autorizado. Não instalar,
executar ou pedir Docker no Mac.

## Segredos antes do bootstrap

Guarde estes valores somente no runtime gerido (Infisical, conforme
`docs/runbooks/ai-platform-secrets.md`); nunca em Git, tickets, logs ou
`.env.example`:

```text
MEM0_POSTGRES_PASSWORD=<senha longa e exclusiva do banco Mem0>
MEM0_JWT_SECRET=<saída de openssl rand -base64 48>
MEM0_OPENAI_API_KEY=<chave do provider escolhida para o servidor Mem0>
MEM0_API_KEY=<chave m0sk_ emitida após o bootstrap>
MEM0_BASE_URL=http://mem0:8000
MEM0_TIMEOUT_MS=2000
```

`MEM0_OPENAI_API_KEY` é exigida pelo servidor OSS para embeddings/configuração;
não configure uma chave, conta ou provider como parte desta alteração. Antes do
bootstrap, aprove custos, retenção e a chave a usar. `AUTH_DISABLED=true` é
proibido em produção.

## Iniciar e validar no Windows

Desenvolvimento (a porta é apenas loopback):

```bash
docker compose --profile ai-memory up -d mem0-postgres mem0
curl --fail http://127.0.0.1:8888/auth/setup-status
docker compose --profile ai-memory ps
```

Produção self-hosted (sem porta pública):

```bash
docker compose -f docker-compose.prod.yml --env-file .env --profile ai-memory up -d mem0-postgres mem0
docker compose -f docker-compose.prod.yml --profile ai-memory ps
docker compose -f docker-compose.prod.yml logs --tail=100 mem0
```

Antes de subir, valide o YAML no Windows:

```bash
docker compose config
docker compose -f docker-compose.prod.yml config
```

O estado `healthy` do serviço e `GET /auth/setup-status` são a prova mínima de
que o servidor iniciou. Não habilite a feature do CRM nesta etapa.

## Primeiro administrador e chave de aplicação

Com a API local temporária, complete o único registo administrativo pelo
endpoint `/auth/register` ou pelo assistente oficial do Mem0. Depois faça login
e crie uma chave por `POST /api-keys`; o valor `m0sk_...` é mostrado só uma vez.
Armazene-o como `MEM0_API_KEY` no gestor de segredos e revogue-o no Mem0 se for
exposto. Não use a chave administrativa legada como credencial da aplicação.

Após o bootstrap, remova qualquer mapeamento de porta local que deixe de ser
necessário. Produção deve continuar sem `ports:` no serviço `mem0`.

## Backup, parar e recuperação

Faça um dump consistente do banco dedicado antes de atualizar a imagem ou
alterar a configuração do servidor:

```bash
docker compose --profile ai-memory exec -T mem0-postgres pg_dump -U mem0 -d mem0 > mem0-$(date +%F).sql
```

Guarde o backup cifrado fora do host, com acesso restrito. Para desativar sem
apagar dados: mantenha a feature Mem0 em `off`, defina
`AI_PLATFORM_KILL_MEM0=true` se for uma contenção imediata e pare somente os
serviços do perfil. Não apague o volume durante uma contenção.

```bash
docker compose --profile ai-memory stop mem0 mem0-postgres
```

## Wipe e reconstrução completos

Uma limpeza remove memórias, chaves de API, utilizadores e auditoria do Mem0.
Só faça isso após aprovação explícita e depois de confirmar que o nome do volume
é o volume exclusivo `mem0-postgres-data` listado pelo Compose. Não use
`docker compose down -v`, pois ele pode remover volumes não relacionados.

```bash
docker compose --profile ai-memory stop mem0 mem0-postgres
docker volume ls --format '{{.Name}}' | findstr mem0-postgres-data
# Após confirmar visualmente o volume exclusivo acima:
docker volume rm <nome-exato-do-volume-mem0-postgres-data>
```

Recriar o sidecar não recria dados do CRM. A reconstrução a partir de fontes
oficiais será feita apenas pelo tooling de ciclo de vida da Fase 2; até então,
não importe mensagens livremente nem trate o Mem0 como arquivo oficial.
