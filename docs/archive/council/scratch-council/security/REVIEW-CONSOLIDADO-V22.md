# Revisão consolidada — Retrieval, Resource Router e Affect Ledger PostgreSQL

Data: 2026-09-13  
Método: leitura read-only no worker e execução independente dos testes; PostgreSQL descartável usado nas duas peças persistentes, com teardown.

## 1. Cartógrafa — redação obrigatória no retrieval (`09d300eb`)

**PASS-CONDICIONAL.** `searchKnowledge.ts:95` aplica `redactKnowledgeHit` a todo resultado antes de retornar. A função (`:142-153`) sempre substitui email, CPF e telefone; não existe flag ou parâmetro de opt-out. O teste real passou: `search-knowledge-redaction.test.ts` — 1 arquivo, 1 teste, exit 0.

O pipeline ainda devolve `metadata` sem redação (`KnowledgeHit.metadata`, linha 23; `redactKnowledgeHit` só altera `content`) e `citationsFromHits` copia metadata integralmente (`:167-175`). Se metadata contiver email, telefone, CPF ou outro PII, ele chega ao consumidor/UI. O teste cobre somente PII no `content`, não metadata, snippet/citation ou outras categorias sensíveis. Portanto a exigência de cobrir todos os campos sensíveis ainda não está provada.

Não há opt-out nem secret hardcoded. Tracing exporta apenas metadados reduzidos, mas a telemetria de falha é deliberadamente engolida (não é bypass de redaction).

## 2. Lótus — Resource Router persistente (`bb03b03c`)

**PASS.** `resource-router-persistence.ts:6-11` cria chave primária `(tenant_id, agent_id)`; `persistWorker` usa parâmetros e `ON CONFLICT` nessa chave (`:14-22`); `loadWorkers` filtra sempre por `tenant_id` (`:25-29`); `routeResourcePersisted` roteia somente a lista daquele tenant (`:32-34`). Sem worker apto, o router lança `resource_router_no_apt_worker` (fail-closed).

Teste real executado pelo Vitest: `resource-router-persistence.integration.test.ts` — 1 arquivo, 1 teste, exit 0. O próprio teste subiu PostgreSQL descartável, aguardou query, persistiu dois workers, roteou o de menor carga, abriu pool novo e confirmou a mesma decisão; teardown removeu o container.

Limite: não há teste cross-tenant explícito nem validação de tenant vazio em `routeResourcePersisted`; consulta vazia falha fechado. Nenhum secret hardcoded encontrado.

## 3. Prisma — Affect Ledger PostgreSQL (`59f6fbe8`)

**PASS.** `affect-ledger-pg.ts:23-44` cria tabela append-only com checks de faixa, chave primária `(agent_id, session_id, event_id)` e trigger que rejeita UPDATE/DELETE. `append` usa `INSERT ... ON CONFLICT DO NOTHING RETURNING` (`:53-68`), permitindo replay idempotente entre pools/processos; `read` ordena deterministicamente (`:71-77`).

Teste independente contra PostgreSQL descartável: `affect-ledger-pg.test.ts` — 1 arquivo, 2 testes, exit 0. Confirmou persistência após reabertura de pool, replay único e rejeição real de UPDATE/DELETE pelo trigger; container removido no final.

Não há secret hardcoded nem logging sensível. O schema não inclui tenant_id; isolamento multi-tenant não é demonstrado neste commit e precisa ser garantido na camada superior se o ledger for compartilhado.

## Veredito consolidado

- Cartógrafa: **PASS-CONDICIONAL** — redação non-opt-out do `content` confirmada, mas metadata/citations não são redigidos e não há teste cobrindo esses campos.
- Lótus: **PASS** — persistência e roteamento por tenant passaram em PostgreSQL descartável real.
- Prisma: **PASS** — append-only, idempotência e restart passaram em PostgreSQL descartável real; tenant isolation permanece fora do escopo.

SELF-CHECK: PASS — código real lido, testes executados com saída/exit registrados, containers descartáveis removidos e nenhum segredo exposto.
