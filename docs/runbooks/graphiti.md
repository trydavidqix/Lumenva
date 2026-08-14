# Graphiti + FalkorDB: operação do sidecar opcional

## Limites e estado seguro

Graphiti é uma projeção temporal/relacional reconstruível, nunca a fonte de
verdade do CRM. O estado oficial continua no PostgreSQL do CRM (`crm_leads`,
`crm_lead_activities`, `contacts`, mensagens etc.); Graphiti/FalkorDB só
existem para acelerar consultas de contexto que o Postgres também
comprovaria por replay. Se o volume for apagado, o CRM continua operando —
a reconstrução (rebuild/replay) é entregue por uma task posterior da Fase 4,
não por este runbook.

O profile `ai-graph` vem desligado: `docker compose up -d` **não** inicia
`falkordb` nem `graphiti`. Subir os serviços manualmente também não liga a
feature no produto — o rollout mode (`off` → `shadow` → …) é uma decisão
separada, gated por `AI_PLATFORM_KILL_GRAPHITI` (vence sobre qualquer flag) e
pela feature flag por organização.

Nenhum fato do grafo pode, por si só, autorizar uma ação de risco HIGH
enquanto a feature estiver `off`/`shadow` — essa é uma doutrina do
`GraphContextPort` (`lib/agent-engine/graph/port.ts`), não deste runbook, mas
vale repetir aqui porque quem opera o sidecar precisa saber que ele nunca é
autoritativo.

Não publique a API do Graphiti, o browser do FalkorDB ou a porta Redis por
Caddy. Em produção nenhum dos dois serviços declara `ports:` — só `app` e
`worker` alcançam `graphiti` pela rede interna `ai-graph-internal`. Em
desenvolvimento a API REST do Graphiti fica disponível em
`127.0.0.1:${GRAPHITI_DEV_PORT:-8890}` apenas para depuração local do adapter
(Task 4); FalkorDB não publica porta nem em dev.

## Estado de verificação das imagens (leia antes de habilitar)

As tags abaixo são as pinadas pelo plano da Fase 4 e foram usadas como estão,
sem confirmação contra o registry nesta tarefa (ambiente sem acesso à
internet/Docker Hub):

- `zepai/graphiti:0.22.1`
- `falkordb/falkordb-server:v4.20.1-alpine`

Do mesmo modo, os nomes de variável de ambiente do container `graphiti`
(`FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_PASSWORD`, `GRAPHITI_API_KEY`,
`OPENAI_API_KEY`, `MODEL_NAME`, `EMBEDDER_MODEL_NAME`, `SEMAPHORE_LIMIT`), a
porta interna `8000` e o path de healthcheck `/healthcheck` são o melhor
palpite a partir da documentação pública do `graphiti-core`/`zepai` — **não
foram confirmados rodando a imagem real**. A Task 4 do plano
(`docs/superpowers/plans/2026-08-10-ai-platform-phase-4-graphiti.md`) inspeciona
o OpenAPI publicado pela imagem pinada antes de implementar o client HTTP; use
esse passo para corrigir qualquer nome de env/porta/path divergente aqui e
neste runbook antes de habilitar `--profile ai-graph` fora de um teste
isolado e descartável. Trate este runbook como scaffolding de infraestrutura,
não como receita validada em produção.

## Segredos antes do bootstrap

Guarde estes valores somente no runtime gerido (Infisical, conforme
`docs/runbooks/ai-platform-secrets.md`); nunca em Git, tickets, logs ou
`.env.example`:

```text
GRAPHITI_FALKORDB_PASSWORD=<senha longa e exclusiva do FalkorDB>
GRAPHITI_API_KEY=<segredo compartilhado app<->graphiti — mesmo valor nos dois lados>
GRAPHITI_LLM_API_KEY=<credencial de PLATAFORMA pro LLM/embedder do sidecar>
```

`GRAPHITI_LLM_API_KEY` é a credencial que o container `graphiti` usa para
chamar o provider de LLM/embedder configurado (`GRAPHITI_LLM_PROVIDER` /
`GRAPHITI_EMBEDDER_PROVIDER`). Ela é **exclusiva do sidecar**: nunca a chave
BYOK de um tenant vinda de `ai_provider_credentials`, e nunca compartilhe a
chave de criptografia do banco (`AI_CRED_AES_KEY`) com o serviço Python. Se
BYOK por tenant se tornar um requisito real mais adiante, a solução é um
broker de credencial escopado — não expor esta variável a mais de um tenant.

`GRAPHITI_API_KEY` também precisa ser refletida em `.env`/runtime do **app**
(contrato em `lib/env.ts`), já que é o mesmo valor que autentica as chamadas
do adapter (Task 4) contra o serviço.

Variáveis não sensíveis já têm default em `.env.example`:

```text
GRAPHITI_BASE_URL=http://graphiti:8000        # preencha ao habilitar o profile
GRAPHITI_TIMEOUT_MS=2000
GRAPHITI_LLM_PROVIDER=
GRAPHITI_LLM_MODEL=
GRAPHITI_EMBEDDER_PROVIDER=
GRAPHITI_EMBEDDER_MODEL=
GRAPHITI_INGESTION_CONCURRENCY=2
```

Antes de aprovar custo/retenção real, confirme com o dono do produto qual
provider/modelo de LLM e embedder o sidecar vai usar; não configure uma
credencial de provider sem essa decisão.

## Concorrência de ingestão

Cada episódio ingerido pode disparar várias chamadas de LLM (extração de
entidade, resolução de relação/aresta). `GRAPHITI_INGESTION_CONCURRENCY`
(mapeada para `SEMAPHORE_LIMIT` dentro do container) começa em `2` —
conservador de propósito para não estourar rate limit/custo numa instalação
self-host pequena. Só suba esse número com medição real de throughput e
custo; não aumente "porque parece lento" sem dado.

## Iniciar e validar no Windows

Antes de subir, valide o YAML (não inicia contêiner nenhum):

```bash
docker compose config
docker compose -f docker-compose.prod.yml config
```

Desenvolvimento (porta da API só em loopback; FalkorDB nunca publica porta):

```bash
docker compose --profile ai-graph up -d falkordb graphiti
curl --fail http://127.0.0.1:8890/healthcheck   # path não confirmado — ver seção acima
docker compose --profile ai-graph ps
```

Produção self-hosted (sem porta pública nenhuma):

```bash
docker compose -f docker-compose.prod.yml --env-file .env --profile ai-graph up -d falkordb graphiti
docker compose -f docker-compose.prod.yml --profile ai-graph ps
docker compose -f docker-compose.prod.yml logs --tail=100 graphiti
```

O estado `healthy` dos dois serviços é a prova mínima de que o sidecar
iniciou. Isso não habilita a feature do CRM — o rollout mode permanece a
decisão separada descrita acima.

## Backup, parar e recuperação

Faça um dump/snapshot do FalkorDB antes de atualizar a imagem ou mudar a
configuração do sidecar. FalkorDB é Redis-compatível; use `SAVE`/`BGSAVE` ou
copie o volume:

```bash
docker compose --profile ai-graph exec falkordb redis-cli -a "$GRAPHITI_FALKORDB_PASSWORD" BGSAVE
```

Guarde o backup cifrado fora do host, com acesso restrito. Como o grafo é
derivado/reconstruível (replay a partir do Postgres, entregue em task
posterior), este backup é conveniência operacional para evitar
reprocessamento, não uma cópia de dados oficiais.

Para desativar sem apagar dados: mantenha a feature Graphiti em `off`, use
`AI_PLATFORM_KILL_GRAPHITI=true` se for uma contenção imediata e pare somente
os serviços do profile — não use `docker compose down -v`.

```bash
docker compose --profile ai-graph stop graphiti falkordb
```

## Wipe e reconstrução completos

Uma limpeza remove todo o grafo (entidades, arestas, episódios) de todos os
tenants. Só faça isso após aprovação explícita e depois de confirmar que o
nome do volume é o volume exclusivo `falkordb-data` listado pelo Compose.

```bash
docker compose --profile ai-graph stop graphiti falkordb
docker volume ls --format '{{.Name}}' | findstr falkordb-data
# Após confirmar visualmente o volume exclusivo acima:
docker volume rm <nome-exato-do-volume-falkordb-data>
```

Recriar o sidecar não recria dados do CRM. O rebuild/replay a partir das
fontes oficiais e a purga por tenant (`deleteOrganization` do
`GraphContextPort`, LGPD) são entregues por uma task posterior do plano da
Fase 4 (`scripts/rebuild-graphiti.ts`, lifecycle worker) — até lá, não trate
este sidecar como tendo ciclo de vida por tenant automatizado.
