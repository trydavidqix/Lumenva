# Graphiti + Neo4j: operação do sidecar opcional

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
