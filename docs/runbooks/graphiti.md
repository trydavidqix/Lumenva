# Graphiti + Neo4j: operação do sidecar opcional

## Incidente e restore — 2026-09-05 — RESOLVIDO

Entre 22:21 e 22:33 UTC de 2026-09-03, um deploy/rebuild recriou a stack sem os
profiles `ai-memory`/`ai-graph`. `graphiti`, `neo4j`, `mem0` e `mem0-postgres`
sumiram da VPS por acidente operacional; não houve decisão deliberada de
desativação. O OOM de 2026-09-02 às 18:43 UTC contribuiu para a pressão de
memória, mas não explica a remoção final. O volume `deskcommcrm_neo4j-data`
(~542 MB) foi preservado (assim como o volume do Postgres Mem0, ~73 MB).

Restore executado em 2026-09-05 na VPS (`/root/deskcommcrm`), sem alterar `.env`:

```bash
docker pull pgvector/pgvector:pg16
docker pull neo4j:5.26.0
docker pull zepai/graphiti:0.22.0
docker compose --profile ai-memory --profile ai-graph up -d
docker compose --profile ai-graph ps
```

Os quatro serviços ficaram `healthy` em aproximadamente 25 segundos e nenhum
serviço existente foi recriado. A knowledge base do Alfred permanece intacta
(7 fontes, 46 chunks). As seis chaves `GRAPHITI_*` foram confirmadas no
Infisical, sem imprimir valores. As flags da organização
`2e51006a-b264-4ef7-8783-9b95184cd714` continuam `graphiti=shadow` e
`mem0=shadow`; não ligar nenhuma flag. A prevenção permanente está em
`2d1c2450`: as receitas de deploy Caddy e Traefik incluem explicitamente os dois
profiles.

## Wiring no worker — ligado no código, ainda `off` por flag

`workers/agent-worker/main.ts` constrói `GraphitiContextProvider` (via
`buildTurnDeps()`, testado em `main.test.ts`) e injeta em todos os 4 tipos
de turno, junto com o `Mem0ContextProvider` (mesmo helper). Assim como o
Mem0, o código está pronto mas continua no-op sem uma linha em
`ai_platform_feature_flags` com `feature='graphiti'` e `mode` diferente de
`off` (nenhuma existe hoje) — o provider checa a flag antes de chamar
`.search()`. Sem `GRAPHITI_BASE_URL`/`GRAPHITI_API_KEY`, o boot cai pro
`NullGraphContextPort` em vez de falhar, mesmo padrão de
`workers/graph-projection.handler.ts`.

## Limites e estado seguro

Graphiti é uma projeção temporal/relacional reconstruível, nunca a fonte de
verdade do CRM. O estado oficial continua no PostgreSQL do CRM (`crm_leads`,
`crm_lead_activities`, `contacts`, mensagens etc.); Graphiti/Neo4j só
existem para acelerar consultas de contexto que o Postgres também
comprovaria por replay. Se o volume for apagado, o CRM continua operando —
a reconstrução (rebuild/replay) é entregue por uma task posterior da Fase 4,
não por este runbook.

O profile `ai-graph` vem desligado: `docker compose up -d` **não** inicia
`neo4j` nem `graphiti`. Subir os serviços manualmente também não liga a
feature no produto — o rollout mode (`off` → `shadow` → …) é uma decisão
separada, gated por `AI_PLATFORM_KILL_GRAPHITI` (vence sobre qualquer flag) e
pela feature flag por organização.

Nenhum fato do grafo pode, por si só, autorizar uma ação de risco HIGH
enquanto a feature estiver `off`/`shadow` — essa é uma doutrina do
`GraphContextPort` (`lib/agent-engine/graph/port.ts`), não deste runbook, mas
vale repetir aqui porque quem opera o sidecar precisa saber que ele nunca é
autoritativo.

**O que realmente sai do sistema quando a feature está ligada (qualquer modo
que não `off`, incluindo `shadow`):** `workers/graph-projection.handler.ts`
grava (`addEpisode`) no sidecar Graphiti sempre que o modo do tenant é
diferente de `off` — `shadow` já é um caminho completo de escrita/egress, não
apenas medição. Isso significa que o conteúdo real de mensagens do tenant é
enviado ao container `graphiti`, processado por um subprocessador de
LLM/embedder externo (`GRAPHITI_LLM_PROVIDER`/`GRAPHITI_EMBEDDER_PROVIDER`) e
persistido no Neo4j. `shadow` garante apenas que o fato resultante não chega
ao prompt (`influencePrompt:false`) — não garante que nenhum dado pessoal
saiu do sistema nem que ele pode ser apagado seletivamente depois (ver
`docs/runbooks/graphiti-rebuild.md` sobre a lacuna de redação por contato).
A decisão de compliance sobre habilitar Graphiti para um tenant real precisa
considerar este fato de fluxo de dados **antes** de ligar `shadow` para
aquele tenant, não apenas antes de uma eventual promoção a `canary`/`on`.

Não publique a API do Graphiti nem a interface HTTP/Bolt do Neo4j por
Caddy. Em produção nenhum dos dois serviços declara `ports:` — só `app` e
`worker` alcançam `graphiti` (e `graphiti` alcança `neo4j`) pela rede interna
`ai-graph-internal`. Em desenvolvimento a API REST do Graphiti fica
disponível em `127.0.0.1:${GRAPHITI_DEV_PORT:-8890}` apenas para depuração
local do adapter (Task 4).

O `neo4j` **não** publica porta nenhuma, nem em dev: testado ao vivo nesta
task, confirmou-se que Docker não publica porta de host pra um container
cuja única rede é `internal: true` (`docker port` fica vazio mesmo com
`ports:` declarado no compose), e juntar a rede `default` só pra viabilizar
o publish daria egress desnecessário a um datastore puro. Pra inspecionar o
grafo manualmente em dev, entre no container:

```bash
docker compose --profile ai-graph exec neo4j cypher-shell -u neo4j -p "$GRAPHITI_NEO4J_PASSWORD"
```

## Limite de memória

O Neo4j roda em JVM e, sem teto, tende a reservar bem mais RAM do que uma
instalação self-host pequena tem sobrando (VPS Hetzner CPX22 de referência:
4GB totais, já divididos entre `app`, `worker` e WAHA). Três variáveis
controlam o teto, todas com default pequeno de propósito (grafo
single-tenant):

- `GRAPHITI_NEO4J_MEM_LIMIT` (default `512m`): cap duro do container Docker
  (`mem_limit`). Pega crescimento fora do heap do JVM (transaction memory,
  overhead do SO) que os dois envs abaixo não cobrem — se o processo
  ultrapassar esse teto, o kernel mata o container (OOM), não deixa vazar
  pro resto da VPS.
- `GRAPHITI_NEO4J_HEAP_SIZE` (default `256m`): heap máximo do JVM
  (`server.memory.heap.max_size` — repassado como env `NEO4J_server_memory_
  heap_max__size`, com `_` duplo antes de `size`; não é erro de digitação, é
  a sintaxe oficial da imagem pra mapear ponto→underscore no `neo4j.conf`).
- `GRAPHITI_NEO4J_PAGECACHE_SIZE` (default `128m`): cache de páginas do
  Neo4j (`server.memory.pagecache.size`).

**Trade-off aceito:** com o grafo pequeno (poucos meses de dados de um único
tenant), esses defaults são suficientes. Conforme o grafo cresce, consultas
que não cabem mais no pagecache batem em disco e ficam mais lentas — é
degradação gradual, não uma falha súbita. Se isso for percebido em produção,
suba os três valores (ou migre o sidecar pra uma VPS com mais RAM, decisão
de infra já discutida e adiada) em vez de remover o teto — um Neo4j sem
`mem_limit` pode consumir RAM suficiente pra derrubar `app`/`worker`/WAHA no
mesmo host.

Fonte: [Neo4j Docker Operations Manual — Modify the default
configuration](https://neo4j.com/docs/operations-manual/current/docker/configuration/).

## Histórico: por que FalkorDB virou Neo4j

O plano original da Fase 4 (Task 3) wireou este sidecar em FalkorDB
(`falkordb/falkordb-server`). A Task 4 (implementação do adapter REST)
descobriu, inspecionando o container `zepai/graphiti:0.22.0` ao vivo e lendo
seu código-fonte empacotado, um defeito de arquitetura: o REST server desta
imagem (`graph_service`) só fala com Neo4j.

```python
# graph_service/config.py, dentro da imagem zepai/graphiti:0.22.0
class Settings(BaseSettings):
    openai_api_key: str
    openai_base_url: str | None = Field(None)
    model_name: str | None = Field(None)
    embedding_model_name: str | None = Field(None)
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str

    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
```

Não existe nenhum campo FalkorDB em `Settings`, e `extra='ignore'` faz o
Pydantic descartar silenciosamente qualquer env desconhecida — os
`FALKORDB_*` que a Task 3 configurava nunca chegavam ao processo. Sem
`NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD`, `Settings()` falha a validação e o
container `graphiti` entra em crash-loop na inicialização.

Decisão explícita do parceiro humano: trocar o sidecar por **Neo4j Community
Edition** (gratuita, sem serviço pago obrigatório — invariante 9 de
self-host) em vez de procurar/buildar uma imagem Graphiti alternativa com
driver FalkorDB. Este runbook documenta a topologia corrigida.

O client TypeScript (`lib/agent-engine/graph/graphiti-client.ts`) fala o
contrato HTTP do Graphiti (`POST /messages`, `POST /search`,
`DELETE /group/{id}`, `GET /healthcheck`), que independe de qual grafo roda
atrás do serviço — o arquivo não tinha (e continua sem ter) nenhum código
específico de FalkorDB ou Neo4j; não precisou de nenhuma mudança nesta troca.

## Estado de verificação das imagens

- `neo4j:5.26.0`: confirmado puxável do Docker Hub. É Community Edition por
  padrão (tags sem sufixo `-enterprise` são Community e não exigem aceite de
  licença); `cypher-shell` e `wget` estão presentes na imagem.
- `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD`: confirmados lendo
  `graph_service/config.py` e `graph_service/zep_graphiti.py`
  (`Graphiti(uri, user, password)`) diretamente de dentro da imagem
  `zepai/graphiti:0.22.0` — são exatamente os nomes que `Settings` exige
  (pydantic-settings casa env vars com o nome do campo, case-insensitive).
- Healthcheck do Neo4j (`wget` contra `http://127.0.0.1:7474`, sem auth):
  confirmado ao vivo — a imagem responde `200` com um JSON de discovery
  (`bolt_direct`, `neo4j_version`, `neo4j_edition`, etc.) mesmo sem
  credenciais, então o healthcheck não precisa embutir a senha (diferente do
  padrão anterior do FalkorDB, que expunha a senha em texto claro via
  `docker inspect`).
- `neo4j-admin database backup` **não existe** no Community Edition desta
  imagem — `neo4j-admin database --help` só lista `check`, `dump`, `import`,
  `info`, `load`, `migrate`, `upload`. Confirmado rodando `--help` dentro da
  imagem. Ver seção de Backup abaixo.
- Round-trip `graphiti` + `neo4j`: os dois serviços subiram e ficaram
  `healthy` sem crash-loop, e `graphiti` executou queries Cypher reais
  contra o Neo4j (confirmado nos logs) — prova de que a conexão
  `NEO4J_URI`/`NEO4J_USER`/`NEO4J_PASSWORD` funciona. O round-trip completo
  (`POST /messages` seguido de `POST /search` encontrando o fato) **não**
  foi provado nesta verificação: `/search` retornou `500` com
  `openai.AuthenticationError` porque a credencial de LLM/embedder usada era
  intencionalmente falsa (nunca uma credencial paga real nesta verificação).
  Detalhe completo em
  `.superpowers/sdd/2026-08-10-ai-platform-phase-4-graphiti/task-3-neo4j-swap-report.md`
  — consulte esse arquivo para o veredito mais recente em vez de presumir
  sucesso a partir deste runbook.

## Segredos antes do bootstrap

Guarde estes valores somente no runtime gerido (Infisical, conforme
`docs/runbooks/ai-platform-secrets.md`); nunca em Git, tickets, logs ou
`.env.example`:

```text
GRAPHITI_NEO4J_PASSWORD=<senha longa e exclusiva do Neo4j>
GRAPHITI_API_KEY=<segredo compartilhado app<->graphiti — mesmo valor nos dois lados>
GRAPHITI_LLM_API_KEY=<credencial de PLATAFORMA pro LLM/embedder do sidecar>
```

`GRAPHITI_NEO4J_PASSWORD` vira a senha do usuário `neo4j` via
`NEO4J_AUTH=neo4j/<senha>` (formato padrão da imagem oficial) — só tem
efeito na primeira inicialização do volume `neo4j-data`; trocar a variável
depois de o volume já existir não muda a senha do banco.

`GRAPHITI_LLM_API_KEY` é a credencial que o container `graphiti` usa para
chamar o provider de LLM/embedder configurado (`GRAPHITI_LLM_PROVIDER` /
`GRAPHITI_EMBEDDER_PROVIDER`). Ela é **exclusiva do sidecar**: nunca a chave
BYOK de um tenant vinda de `ai_provider_credentials`, e nunca compartilhe a
chave de criptografia do banco (`AI_CRED_AES_KEY`) com o serviço Python. Se
BYOK por tenant se tornar um requisito real mais adiante, a solução é um
broker de credencial escopado — não expor esta variável a mais de um tenant.

`GRAPHITI_API_KEY` também precisa ser refletida em `.env`/runtime do **app**
(contrato em `lib/env.ts`), já que é o mesmo valor que o adapter (Task 4)
envia em `X-Api-Key`. Vale repetir: esta imagem do Graphiti não valida essa
key no servidor (não há middleware de auth) — o isolamento real é a rede
`ai-graph-internal`. A variável é mantida para never-regress se uma versão
futura da imagem adotar autenticação de verdade.

### ✅ Drift entre a VPS e o Infisical — fechado em 2026-08-21

Durante a sessão de validação de 2026-08-21 (testes com Gemini e depois
NVIDIA Build), seis valores foram gerados/editados direto no
`/root/deskcommcrm/.env` da VPS via SSH (regeneração de senha do Neo4j,
troca de provider de LLM/embedder) e ficaram temporariamente fora do
projeto Infisical "DeskcommCRM - Lumenva" (fonte canônica de segredos desse
ambiente, ver `docs/runbooks/ai-platform-secrets.md`). Três já existiam lá
com valor placeholder `"unused"` (`GRAPHITI_API_KEY`,
`GRAPHITI_NEO4J_PASSWORD`, `GRAPHITI_LLM_API_KEY`); três nunca tinham sido
criados (`GRAPHITI_LLM_BASE_URL`, `GRAPHITI_LLM_MODEL`,
`GRAPHITI_EMBEDDER_MODEL`).

Corrigido via `infisical secrets set --file <arquivo com os 6 pares
chave=valor lidos direto do .env da VPS> --env prod` — projeto/ambiente
confirmados pelo próprio usuário (login interativo `infisical login`,
seleção do projeto "DeskcommCRM - Lumenva"). Os 6 valores foram lidos da VPS
e escritos no Infisical sem passar pelo terminal/log em texto plano (arquivo
temporário local apagado logo depois). Confirmado por leitura pós-escrita
(`infisical secrets --env prod`, listando só as 6 chaves, sem valores) que
as 6 existem no ambiente `prod` do projeto correto.

Environment slug correto no Infisical é `prod`, não `production` (o slug
`production` não existe nesse projeto — descoberto por 404 durante esta
correção).

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

## Provider do LLM/embedder

O `Settings` empacotado no `zepai/graphiti:0.22.0` só reconhece o contrato
"shape OpenAI" (`openai_api_key`/`openai_base_url`/`model_name`/
`embedding_model_name`) — não existe campo de seleção de provider. Isso não
trava o sidecar num único provider: **qualquer API compatível com o formato
REST da OpenAI funciona, trocando só `OPENAI_BASE_URL`** (mapeado de
`GRAPHITI_LLM_BASE_URL` no compose).

**Gemini via camada de compatibilidade OpenAI do Google** (decisão adotada —
reaproveita a chave que já temos, em vez de pagar por uma credencial OpenAI
separada só pro sidecar):

```text
GRAPHITI_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GRAPHITI_LLM_API_KEY=<chave Gemini>
GRAPHITI_LLM_MODEL=gemini-3.6-flash
GRAPHITI_EMBEDDER_MODEL=gemini-embedding-001
```

**Validado via `curl` direto contra a API do Gemini** (sem Docker, só o
contrato HTTP que o sidecar usa):

- `POST /v1beta/openai/embeddings` com `gemini-embedding-001` → `200`,
  vetor de 3072 dimensões, formato OpenAI padrão.
- `POST /v1beta/openai/chat/completions` com `gemini-2.5-flash` → `404`:
  **esse modelo não está mais disponível pra contas novas** (mensagem da
  própria API pedindo pra usar `gemini-3.6-flash`). Corrigido no default
  deste repo — não use `gemini-2.5-flash`.
- `POST /v1beta/openai/chat/completions` com `gemini-3.6-flash` → `200`,
  resposta correta.

**Ainda não validado**: o round-trip completo do sidecar Python (imagem
`zepai/graphiti:0.22.0`, não só a API do Gemini isolada) — `POST /messages`
seguido de `POST /search` encontrando o fato de volta. O teste acima prova
que a API do Gemini responde certo no formato esperado; não prova que o
cliente Python empacotado na imagem consome essa resposta sem erro (ex.:
campos extras como `extra_content.google.thought_signature` que a OpenAI
não devolve). Antes de apontar pra produção, valide com o container real:

```bash
docker compose --profile ai-graph up -d neo4j graphiti
curl --fail http://127.0.0.1:8890/healthcheck
# depois POST /messages seguido de POST /search com um episódio de teste —
# confirmar que o /search encontra o fato, não só que o container sobe.
```

Se algum campo de resposta do Gemini não bater com o que o cliente
OpenAI-Python espera, o erro aparece nesse round-trip, não no boot do
container — não presuma sucesso só porque `docker compose ps` mostra
`healthy`.

Se o Gemini não funcionar de ponta a ponta, o fallback é usar uma chave
OpenAI real (deixar `GRAPHITI_LLM_BASE_URL` vazio) — a variável existe
justamente pra essa troca ser de configuração, não de código.

## Patch local: embedder ignorado pelo upstream

Validado ao vivo na VPS em 2026-08-21 (Neo4j + Graphiti reais, provider
Gemini): `POST /messages` e `POST /search` falhavam com
`openai.NotFoundError: models/text-embedding-3-small is not found` — mesmo
com `GRAPHITI_EMBEDDER_MODEL` configurado corretamente e a variável
confirmada dentro do container (`docker exec ... env`).

Causa raiz, lendo `graph_service/zep_graphiti.py` de dentro da imagem:
`get_graphiti()` aplica `openai_base_url`/`openai_api_key`/`model_name` só
no `llm_client` — nunca no `embedder`. `base_url`/`api_key` do embedder já
chegam certos por fallback automático do SDK da OpenAI lendo
`OPENAI_BASE_URL`/`OPENAI_API_KEY` do ambiente (confirmado: o erro veio do
endpoint do Google, não da OpenAI real). O que nunca é aplicado é o nome do
modelo — `OpenAIEmbedderConfig.embedding_model` fica travado no default
`'text-embedding-3-small'`. Confirmado contra o `main` branch upstream do
Graphiti no mesmo dia: o bug segue presente na versão mais recente, não é
algo específico da `0.22.0`.

**Correção adotada**: `docker/graphiti/zep_graphiti.py` neste repo é uma
cópia do arquivo original da imagem com **uma linha adicionada**:

```python
if settings.embedding_model_name is not None:
    client.embedder.config.embedding_model = settings.embedding_model_name
```

Funciona porque `OpenAIEmbedder.create()`/`create_batch()`
(`graphiti_core/embedder/openai.py`) leem `self.config.embedding_model` na
hora da chamada, não na construção do client — mutar depois de criar o
client é seguro, igual já acontecia com `model_name` do `llm_client` duas
linhas acima no mesmo arquivo.

**Segundo bug, mesma família** (achado ao vivo em 2026-08-21, testando com
NVIDIA NIM depois de trocar o Gemini por falta de crédito): `graphiti_core`
escolhe entre dois modelos por tarefa — `self.model` (normal) ou
`self.small_model` (tarefas mais simples/baratas, ex.: alguns passos de
dedup), via `_get_model_for_size()` em `openai_base_client.py`.
`get_graphiti()` só configura `client.llm_client.model`, nunca `.small_model`
— sem override, cai no default hardcoded `DEFAULT_SMALL_MODEL =
'gpt-4.1-nano'`, que só existe na OpenAI real. Sintoma: episódio processa
normalmente por um tempo (extração de entidade/aresta funcionando,
confirmado vendo o Graphiti já consultando o Neo4j), depois trava com `404
page not found` vindo do provider — sem nenhum log até a fila do worker
morrer. Adicionada ao patch:

```python
if settings.model_name is not None:
    client.llm_client.model = settings.model_name
    client.llm_client.small_model = settings.model_name
```

A `Settings` deste app não expõe um "modelo pequeno" separado, então a
correção reaproveita o mesmo `model_name` configurado pros dois tamanhos —
mais simples que deixar sem controle nenhum.

O compose (`docker-compose.yml` e `docker-compose.prod.yml`) monta esse
arquivo por cima do original via `volumes:` — **não precisa rebuildar a
imagem**.

**Manutenção**: como é um arquivo colado por cima do original, ele pode
ficar desatualizado se uma versão futura de `zepai/graphiti` mudar a
estrutura interna deste arquivo. Ao trocar a versão da imagem no compose,
revalide comparando `docker exec <container> cat
/app/graph_service/zep_graphiti.py` original contra a versão patchada antes
de assumir que o mount ainda faz sentido — e confira se o bug upstream
ainda existe (pode ter sido corrigido, tornando este patch redundante e
seguro de remover).

## Concorrência de ingestão

Cada episódio ingerido pode disparar várias chamadas de LLM (extração de
entidade, resolução de relação/aresta). `GRAPHITI_INGESTION_CONCURRENCY`
(mapeada para `SEMAPHORE_LIMIT` dentro do container, hoje um no-op
documentado nesta versão da imagem) começa em `2` — conservador de
propósito para não estourar rate limit/custo numa instalação self-host
pequena. Só suba esse número com medição real de throughput e custo; não
aumente "porque parece lento" sem dado.

## Iniciar e validar no Windows

Antes de subir, valide o YAML (não inicia contêiner nenhum; use `--services`
pra nunca imprimir segredo interpolado):

```bash
docker compose config --services
docker compose -f docker-compose.prod.yml config --services
```

Desenvolvimento (porta da API do Graphiti só em loopback; Neo4j publica
Bolt/browser em loopback opcionalmente, nunca em produção):

```bash
docker compose --profile ai-graph up -d neo4j graphiti
curl --fail http://127.0.0.1:8890/healthcheck
docker compose --profile ai-graph ps
```

O Neo4j Community pode levar 30–60s pra aceitar conexões no primeiro boot de
um volume novo; dê um `start_period`/espera adequada antes de considerar o
serviço travado.

Produção self-hosted (sem porta pública nenhuma):

```bash
docker compose -f docker-compose.prod.yml --env-file .env --profile ai-graph up -d neo4j graphiti
docker compose -f docker-compose.prod.yml --profile ai-graph ps
docker compose -f docker-compose.prod.yml logs --tail=100 graphiti
```

O estado `healthy` dos dois serviços é a prova mínima de que o sidecar
iniciou. Isso não habilita a feature do CRM — o rollout mode permanece a
decisão separada descrita acima.

## Backup, parar e recuperação

Neo4j Community Edition **não tem backup online/hot** — `neo4j-admin
database backup` (que copiaria o banco com o servidor rodando) é recurso
exclusivo do Enterprise Edition. `neo4j-admin database --help` dentro da
imagem `neo4j:5.26.0` só lista `check`, `dump`, `import`, `info`, `load`,
`migrate`, `upload`; `dump` explicitamente recusa rodar contra um banco
"mounted in a running Neo4j server". Não trate isso como uma limitação deste
runbook — é uma restrição real da edição gratuita da imagem.

Duas opções honestas, nenhuma delas "hot":

**Opção 1 — parar o container e copiar o volume (mais simples, recomendada):**

```bash
docker compose --profile ai-graph stop neo4j
docker run --rm -v <nome-do-volume-neo4j-data>:/data -v "$PWD":/backup alpine \
  tar czf /backup/neo4j-data-$(date +%Y%m%d).tar.gz -C /data .
docker compose --profile ai-graph start neo4j
```

Como o grafo é derivado/reconstruível (replay a partir do Postgres, entregue
em task posterior), isso é conveniência operacional para evitar
reprocessamento, não uma cópia de dados oficiais.

**Opção 2 — `neo4j-admin database dump` com o Neo4j parado dentro do mesmo
container** (gera um arquivo `.dump` portátil, útil se for migrar/restaurar
em outro host):

```bash
docker compose --profile ai-graph stop neo4j
docker compose --profile ai-graph run --rm --entrypoint neo4j-admin neo4j \
  database dump neo4j --to-path=/data/backups
docker compose --profile ai-graph start neo4j
```

Guarde o backup cifrado fora do host, com acesso restrito.

Para desativar sem apagar dados: mantenha a feature Graphiti em `off`, use
`AI_PLATFORM_KILL_GRAPHITI=true` se for uma contenção imediata e pare somente
os serviços do profile — não use `docker compose down -v`.

```bash
docker compose --profile ai-graph stop graphiti neo4j
```

## Wipe e reconstrução completos

Uma limpeza remove todo o grafo (entidades, arestas, episódios) de todos os
tenants. Só faça isso após aprovação explícita e depois de confirmar que o
nome do volume é o volume exclusivo `neo4j-data` listado pelo Compose.

```bash
docker compose --profile ai-graph stop graphiti neo4j
docker volume ls --format '{{.Name}}' | findstr neo4j-data
# Após confirmar visualmente o volume exclusivo acima:
docker volume rm <nome-exato-do-volume-neo4j-data>
```

Recriar o sidecar não recria dados do CRM. O rebuild/replay a partir das
fontes oficiais e a purga por tenant (`deleteOrganization` do
`GraphContextPort`, LGPD) são entregues por `scripts/rebuild-graphiti.ts` e
`workers/graph-lifecycle.handler.ts` (Fase 4, Task 8) — detalhes
operacionais em `docs/runbooks/graphiti-rebuild.md`. A purga automática por
LGPD cobre hoje apenas o escopo `tenant` (grupo inteiro do Neo4j); redação
de um único contato só marca o ledger, sem remover os episódios já gravados
desse contato do grafo compartilhado do tenant — limitação real do
contrato de API do Graphiti, documentada no runbook de rebuild.
