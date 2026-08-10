# AI Platform Master Design — DeskcommCRM

**Data:** 2026-08-10  
**Branch de desenho/execução:** `gpt-ai-platform`  
**Status:** arquitetura aprovada para virar implementação por fases  
**Base inicial:** `main@4fa4ca9a7042b88d6de35e411e4375213fb26d93`

## 1. Objetivo

Evoluir o DeskcommCRM para uma plataforma de IA com memória semântica, grafo temporal, ingestão avançada, observabilidade/evaluation, automações externas e workflows human-in-the-loop sem substituir os mecanismos maduros que o produto já possui.

O desenho preserva:

- Supabase/PostgreSQL como fonte de verdade;
- RLS e `organization_id` como fronteira multi-tenant;
- `event_log` + workers como barramento assíncrono;
- `job_queue` + agent-engine como runtime principal;
- `org_memory`, `lead_notes`, checkpoints, `lead_state` e histórico como memória oficial;
- RAG atual + `pgvector` como retrieval padrão;
- guardrails determinísticos do CRM como autoridade de segurança;
- automation engine/webhooks atuais como caminho de integrações;
- Sentry como observabilidade de software/infra.

## 2. Problema que este desenho resolve

O produto já possui memória e RAG, mas precisa ganhar:

1. memória semântica mais flexível sem virar segunda fonte de verdade;
2. relações temporais e causais entre pessoas, empresas, produtos, objeções e oportunidades;
3. publicação controlada de conhecimento humano;
4. avaliação quantitativa da IA antes/depois de mudanças;
5. workflows complexos que podem pausar para aprovação humana;
6. integrações externas mais amplas sem transformar n8n em core;
7. gestão consistente de secrets da plataforma;
8. rollout seguro com shadow/canary/kill switch;
9. lifecycle LGPD que alcance também as novas projeções.

## 3. Princípio central: uma verdade, várias projeções

```text
PostgreSQL/Supabase
     = SOURCE OF TRUTH
            |
            +-- org_memory / lead_notes / checkpoints / state
            +-- knowledge / pgvector
            +-- event_log / job_queue / audit
            |
            +--> Mem0       = projeção semântica reconstruível
            +--> Graphiti   = projeção temporal/relacional reconstruível
            +--> LangSmith  = telemetria/evaluation
            +--> n8n        = integração externa
```

Se Mem0 ou Graphiti forem apagados, o CRM continua possuindo o estado oficial e deve conseguir reconstruir as projeções por replay/reconciliation.

## 4. Decisões arquiteturais travadas

### 4.1 Mem0

- entra como `MemoryPort` opcional;
- inicialmente self-hosted como serviço interno;
- REST interno preferido para desacoplar o runtime TypeScript do engine Mem0;
- banco do Mem0 não é banco oficial do CRM;
- nunca substitui `lead_notes`, `org_memory`, checkpoints ou CRM state;
- escrita é assíncrona via eventos;
- leitura pode ser síncrona com timeout estrito, mas só depois de shadow/canary;
- falha do Mem0 não bloqueia resposta do agente.

### 4.2 Graphiti

- entra somente após Mem0 provar valor;
- `GraphContextPort` existe desde a fundação, começando com provider desabilitado;
- backend inicial recomendado: FalkorDB self-hosted em rede interna;
- Graphiti roda como serviço Python isolado;
- dados são projeções derivadas;
- deve existir replay/rebuild completo;
- nunca determina sozinho contrato, pagamento, consentimento ou status oficial.

### 4.3 LangSmith

- entra antes de Mem0 para medir baseline;
- usa SDK TypeScript no runtime onde possível;
- traces são sanitizados antes do envio;
- LangSmith nunca recebe segredo bruto;
- organização/telefone/e-mail não devem ser enviados como identificadores humanos brutos quando não forem necessários;
- indisponibilidade do LangSmith nunca quebra agente.

### 4.4 LlamaIndex

- não substitui o RAG atual;
- é adapter opcional para ingestão/parsing/connectors onde houver ganho medido;
- o artefato final continua entrando no pipeline oficial de knowledge e pgvector;
- não entra no hot path por default.

### 4.5 Obsidian

- workspace editorial humano;
- nunca runtime DB;
- nunca guarda secrets;
- documentos seguem `DRAFT -> REVIEW -> PUBLISHED`;
- somente conteúdo `PUBLISHED` pode entrar no knowledge pipeline;
- não escreve diretamente em Mem0/Graphiti.

### 4.6 Guardrails externos

- opcionais;
- entram só depois de gap analysis;
- complementam, não substituem, `runBeforeSend` e regras determinísticas atuais;
- qualquer regra crítica de STOP/LGPD/anti-ban/janela/promise/handoff/disclosure continua em código determinístico.

### 4.7 n8n

- integration layer, não core;
- outbound: CRM registra estado primeiro, depois `event_log -> automation engine -> signed webhook -> n8n`;
- inbound: n8n chama API/MCP escopado do CRM;
- n8n não recebe `service_role` e não atualiza tabelas diretamente;
- falha do n8n gera retry/delivery failure, não rollback do estado de negócio.

### 4.8 LangGraph

- somente workflows complexos;
- implementação em TypeScript/JavaScript para manter proximidade com o runtime atual;
- persistência PostgreSQL;
- um workflow piloto inicial: proposta comercial com aprovação humana;
- side effects precisam ser idempotentes porque nodes podem ser reexecutados no resume;
- não substitui `job_queue`, agent-engine ou memória principal.

### 4.9 Infisical e KeePassXC

- Infisical: secrets da plataforma/runtime;
- PostgreSQL cifrado: BYOK/credenciais por tenant que já fazem parte do produto;
- KeePassXC: credenciais humanas/recovery;
- apps nunca leem KeePassXC automaticamente;
- nenhum secret migra automaticamente para Infisical sem inventário e validação.

## 5. Arquitetura alvo

```text
WAHA / UI / Webhooks
        |
        v
   CRM API / Agent Worker
        |
        +-------------------------+
        |                         |
        v                         v
 PostgreSQL/Supabase           event_log
 source of truth                 |
        |                        +--> memory projection worker --> Mem0
        |                        +--> graph projection worker  --> Graphiti --> FalkorDB
        |                        +--> automation engine         --> n8n
        |
        +--> org_memory
        +--> lead_notes
        +--> checkpoints
        +--> lead_state
        +--> knowledge + pgvector
        |
        v
   Context Builder
        |
        +--> native CRM context
        +--> native RAG
        +--> Mem0 (optional, bounded timeout)
        +--> Graphiti (optional, bounded timeout)
        |
        v
   Context Fusion
 authority-domain -> recency -> confidence -> dedupe -> token budget
        |
        v
    Agent Runtime
        |
        +--> simple flow: native runtime
        +--> complex flow: LangGraph workflow adapter
        |
        v
 External validators (optional)
        |
        v
 CRM deterministic guardrails
        |
        v
       WAHA

Obsidian PUBLISHED --> publication pipeline --> LlamaIndex? --> knowledge pipeline --> pgvector

AI runtime --> redaction --> LangSmith

Platform secrets --> Infisical
Tenant BYOK      --> encrypted PostgreSQL
Human passwords --> KeePassXC
```

## 6. Contratos de dados

### 6.1 Projection Envelope

Todo write para Mem0/Graphiti usa envelope canônico:

```ts
export interface ProjectionEnvelope<TPayload = unknown> {
  eventId: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  sourceType: string;
  sourceId: string;
  sourceVersion: string;
  occurredAt: string;
  projectionType: "memory" | "graph";
  projectionVersion: number;
  idempotencyKey: string;
  payload: TPayload;
}
```

Regras:

- `organizationId` vem de fonte confiável do CRM;
- `idempotencyKey` é estável para a mesma projeção/version;
- evento repetido não produz duplicata;
- versão menor não sobrescreve versão mais nova;
- payload é sanitizado antes do boundary externo.

### 6.2 Projection Ledger

Tabela oficial de controle no Postgres:

```text
ai_projection_ledger
- id uuid pk
- organization_id uuid not null
- projection_type text not null
- provider text not null
- entity_type text not null
- entity_id text not null
- source_id text not null
- source_version text not null
- idempotency_key text not null
- status text: pending|processing|applied|failed|deleted
- attempts int
- next_attempt_at timestamptz
- last_error_code text null
- last_error_at timestamptz null
- applied_at timestamptz null
- created_at timestamptz
- updated_at timestamptz
```

Unique: `(organization_id, projection_type, provider, idempotency_key)`.

O ledger registra apenas metadados operacionais; não duplica o conteúdo bruto da conversa.

### 6.3 Feature Flags

Tabela:

```text
ai_platform_feature_flags
- id uuid pk
- organization_id uuid null
- feature text not null
- mode text not null: off|shadow|canary|on
- config jsonb not null default '{}'
- updated_by uuid null
- updated_at timestamptz not null
```

`organization_id NULL` representa default global de produto. Override por tenant tem precedência.

Features iniciais:

- `langsmith`
- `mem0`
- `llamaindex`
- `graphiti`
- `external_guardrails`
- `n8n`
- `langgraph_proposal_workflow`

Kill switch global adicional via env/Infisical:

```text
AI_PLATFORM_KILL_MEM0
AI_PLATFORM_KILL_GRAPHITI
AI_PLATFORM_KILL_LANGSMITH
AI_PLATFORM_KILL_EXTERNAL_GUARDRAILS
AI_PLATFORM_KILL_N8N
AI_PLATFORM_KILL_LANGGRAPH
```

Kill switch sempre vence flag do banco.

## 7. Context Engine

### 7.1 Providers

```ts
export interface ContextProvider {
  readonly name: string;
  retrieve(input: ContextRequest): Promise<ContextProviderResult>;
}

export interface ContextRequest {
  organizationId: string;
  contactId: string;
  conversationId: string;
  agentId: string;
  query: string;
  now: string;
}

export interface ContextItem {
  id: string;
  provider: string;
  authorityDomain: AuthorityDomain;
  authorityLevel: number;
  confidence: number;
  occurredAt: string | null;
  expiresAt: string | null;
  risk: "low" | "medium" | "high";
  sourceId: string;
  text: string;
}
```

Providers iniciais:

- `NativeCrmContextProvider`
- `NativeKnowledgeProvider`
- `Mem0ContextProvider`
- `GraphitiContextProvider`

### 7.2 Consulta paralela

Providers opcionais rodam em paralelo e com budget próprio. Falha/timeout vira resultado degradado, não exception fatal.

### 7.3 Authority Domain

Domínios canônicos:

- `commercial_status`
- `customer_preference`
- `consent`
- `legal`
- `product_policy`
- `relationship`
- `behavior`
- `operational_state`

A fonte de maior autoridade depende do domínio.

Exemplos:

- `commercial_status`: CRM > memória/graph/inference;
- `consent`: registro oficial > qualquer memória;
- `product_policy`: knowledge PUBLISHED > memória;
- `customer_preference`: declaração explícita recente > Mem0 inference;
- `relationship`: fatos CRM + Graphiti temporal podem complementar, mas Graphiti não sobrescreve fato oficial.

### 7.4 Conflict Resolution

Ordem:

1. autoridade adequada ao domínio;
2. estado explícito/confirmado;
3. recência válida;
4. confidence;
5. se continuar ambíguo: não inventar; pedir confirmação ou handoff.

### 7.5 Token Budget

Context Fusion deduplica antes de montar prompt. Nenhum provider tem direito ilimitado a tokens. O orçamento exato deve ser medido contra o baseline atual; a implementação registra `candidate_tokens`, `selected_tokens` e descartes por provider.

## 8. Memory Engine

### 8.1 O que pode virar memória

Permitido:

- preferências de canal/horário;
- interesses;
- contexto comercial estável;
- restrições úteis;
- relacionamento/afinidade;
- informações explicitamente fornecidas que sejam necessárias ao atendimento.

Bloqueado:

- passwords;
- API keys;
- access/refresh tokens;
- cookies/sessions;
- recovery codes;
- cartões completos/CVV;
- segredos internos;
- conteúdo classificado como proibido pela política de PII/secret.

### 8.2 Risk Levels

`LOW`: pode personalizar automaticamente.  
`MEDIUM`: pode orientar; alteração de estado precisa confirmação/autoridade oficial.  
`HIGH`: nunca autoriza ação sensível sozinho.

### 8.3 Write flow

```text
message/event official
  -> event_log
  -> memory projection handler
  -> sanitizer
  -> typed extraction
  -> risk/authority classification
  -> dedupe/supersede decision
  -> projection ledger
  -> Mem0
```

A resposta ao usuário não espera essa escrita.

### 8.4 Read rollout

1. `OFF`: nada.
2. `SHADOW`: consulta e mede; resultado não entra no prompt.
3. `CANARY`: resultado entra para tenants selecionados.
4. `ON`: entra conforme config.

## 9. Graph Engine

### 9.1 Casos de uso

- quem influencia a decisão;
- como opinião mudou no tempo;
- relações entre contato/empresa/produto/oportunidade;
- sequência de objeções e propostas;
- histórico temporal de interesse.

### 9.2 Não usar para

- saldo;
- contrato aceito;
- consentimento LGPD;
- status definitivo de pagamento;
- campo oficial de pipeline.

### 9.3 Tenant Isolation

Cada episódio/projeção usa `group_id` ou namespace derivado exclusivamente de `organization_id` pelo adapter; o modelo não escolhe esse valor.

### 9.4 Rebuild

Deve existir comando administrativo interno que:

1. desabilita leitura do provider;
2. remove projeção do tenant;
3. zera/recria ledger da projeção;
4. reemite/reprocessa eventos oficiais;
5. compara contagens e checksums operacionais;
6. habilita somente após reconciliação.

## 10. Knowledge/Obsidian/LlamaIndex

### 10.1 Publication state

`DRAFT -> REVIEW -> PUBLISHED -> ARCHIVED`.

Somente `PUBLISHED` pode gerar chunks ativos.

### 10.2 Provenance obrigatória

Cada chunk indexado precisa ter:

- organization_id;
- source_id;
- source_version;
- document title;
- source type;
- published_at;
- content_hash;
- chunk position.

### 10.3 LlamaIndex

Adapter só é ativado quando o source type exigir parsing/connectors que superam claramente o pipeline nativo. Se não houver ganho, pipeline nativo continua.

## 11. Observability/Evaluation

### 11.1 Separação

Sentry:

- erros de aplicação;
- performance/runtime;
- exceções Next/worker.

LangSmith:

- LLM calls;
- retrieval;
- memory context;
- tool trajectory;
- prompt/run metadata;
- evaluations.

### 11.2 Trace metadata

Permitido:

- request_id;
- organization hash/opaque id;
- conversation opaque id;
- agent id/version;
- job/run id;
- feature modes;
- model/provider;
- token/latency/cost metrics.

Conteúdo sensível passa por redaction antes do export.

### 11.3 Golden Dataset

Dataset versionado no repo em formato sem PII real. Deve cobrir:

- memória correta;
- memória stale;
- supersede;
- conflito entre fontes;
- cross-tenant;
- secret injection;
- LGPD delete;
- RAG contradiction;
- duplicate event;
- out-of-order event;
- provider timeout;
- provider outage;
- HIGH-risk memory;
- prompt injection em memória/knowledge;
- human handoff.

## 12. n8n Integration Contract

Outbound envelope:

```ts
export interface IntegrationEventEnvelope {
  eventId: string;
  organizationId: string;
  eventType: string;
  occurredAt: string;
  idempotencyKey: string;
  data: Record<string, unknown>;
}
```

Antes de sair da fronteira do CRM:

- remover campos internos não necessários;
- aplicar assinatura HMAC;
- timeout;
- retry/backoff;
- status visível/auditável;
- anti-SSRF atual continua obrigatório.

Inbound n8n usa tokens/API/MCP com scopes e RBAC. Proibido acesso direto ao banco com service role.

## 13. LangGraph Workflow Pilot

Workflow piloto: proposta comercial com aprovação humana.

```text
START
 -> load official CRM context
 -> qualify preconditions
 -> draft proposal
 -> validate draft
 -> interrupt: human approval
     -> reject -> record reason -> END
     -> edit   -> validate edited proposal
     -> approve
 -> persist official proposal record
 -> send via existing channel path
 -> schedule follow-up
 -> audit
 -> END
```

Regras:

- todo side effect possui idempotency key;
- enviar WhatsApp/e-mail não ocorre duas vezes ao resume;
- thread_id é interno e mapeado a organização + workflow run;
- nenhum state do LangGraph substitui CRM oficial;
- checkpointer Postgres é isolado das tabelas de negócio.

## 14. Secrets Model

### Infisical

Guardar/injetar secrets de infraestrutura/plataforma, por ambiente:

- Supabase service role;
- internal/cron secrets;
- WAHA service secrets;
- Mem0 service API key;
- Graphiti service secret;
- LangSmith API key;
- n8n service credentials;
- kill switches;
- encryption master keys conforme política definida.

### PostgreSQL cifrado

Permanece para BYOK tenant já suportado por `ai_provider_credentials` e integrações tenant-aware.

### KeePassXC

Somente humano: logins admin, recovery codes, break-glass credentials.

## 15. LGPD Lifecycle

Operações oficiais em Postgres disparam lifecycle event para derivados.

```text
Delete/anonymize official record
 -> event_log
 -> lifecycle worker
 -> pgvector cleanup
 -> Mem0 purge
 -> Graphiti purge
 -> telemetry handling according to retention policy
 -> integration/caches cleanup when applicable
 -> ledger confirms result
```

Um pedido não é considerado totalmente propagado enquanto houver projection ledger pendente/failed. O CRM pode concluir a etapa oficial e registrar o estado de propagação derivada separadamente, sem esconder falhas.

## 16. Failure Model

| Dependência | Falha | Comportamento |
|---|---|---|
| PostgreSQL | down | fail closed para estado oficial |
| Mem0 | timeout/down | contexto nativo continua |
| Graphiti/FalkorDB | timeout/down | contexto sem grafo |
| LangSmith | down | fila/background drop controlado; agente continua |
| LlamaIndex | down | pipeline nativo/retry |
| n8n | down | retry/DLQ; CRM mantém estado |
| external guardrail | down | native guardrails continuam |
| LangGraph workflow | down | somente workflow complexo afetado; runtime simples continua |

## 17. Deployment Topology

### Core atual

Mantém `app`, `worker`, `waha`, `redis/srh`, `scheduler`, `caddy`.

### Sidecars novos, quando suas fases forem ativadas

- `mem0`: REST API interno; sem porta pública;
- `mem0-db`: Postgres/pgvector próprio ou storage suportado isolado do schema oficial;
- `graphiti`: FastAPI/REST interno com `graphiti-core[falkordb]`;
- `falkordb`: rede interna + volume persistente;
- `llamaindex`: somente se adapter ativado; preferencialmente job/worker isolado, não hot path;
- `guardrails`: somente se gap justificar runtime externo;
- `n8n`: pode estar fora da stack do CRM; comunicação por HTTPS assinado/token escopado.

Não expor dashboards/ports desses serviços via Caddy por default.

## 18. Rollout e release

Por feature:

```text
OFF
 -> SHADOW
 -> INTERNAL
 -> CANARY
 -> ON
```

Requisitos para promoção:

- nenhum P0 de segurança;
- zero cross-tenant leak;
- zero secret persisted em derived stores;
- LGPD propagation tests verdes;
- regressão de qualidade dentro do gate definido;
- latência/custo dentro do orçamento definido pelo baseline;
- kill switch testado;
- rollback testado.

## 19. Critérios de qualidade fixos

Sem tolerância:

- cross-tenant leak: 0;
- secret persisted em memory/graph/telemetry fixtures: 0;
- HIGH-risk action autorizada só por derived memory: 0;
- duplicate external side effect em replay/resume: 0;
- evento duplicado gerando projeção duplicada: 0;
- migration sem baseline/MANIFEST: 0.

Metas que devem ser calibradas a partir do baseline, não inventadas:

- p95 de latência adicional;
- custo adicional por turno;
- memory precision/recall;
- retrieval usefulness;
- trace sampling rate;
- maximum projection lag.

A Fase 0 mede e congela estes números antes de permitir canary.

## 20. Anti-patterns

Não fazer:

- “Mem0 é o novo banco de memória”.
- “Graphiti sabe mais que o CRM sobre status oficial”.
- “n8n grava direto no Supabase com service role”.
- “LangGraph executa toda mensagem”.
- “LlamaIndex substitui todo RAG”.
- “Guardrails externo substitui STOP/LGPD”.
- “LangSmith recebe prompt bruto porque é mais fácil”.
- “Ativa em produção e observa”.
- “Erro do provider externo faz o WhatsApp parar”.
- “feature flag é só env global”; precisamos override por tenant.
- “apaga cliente no CRM e esquece projeções”.

## 21. Sequência de implementação

- Gate 0: baseline verde.
- Fase 0: foundation/contracts/flags/secrets/eval fixtures.
- Fase 1: observability/evaluation.
- Fase 2: Mem0.
- Fase 3: Knowledge/Obsidian/LlamaIndex.
- Fase 4: Graphiti/FalkorDB.
- Fase 5: external guardrails after gap analysis.
- Fase 6: n8n adapter over existing automation.
- Fase 7: LangGraph pilot.

Cada fase tem plano próprio em `docs/superpowers/plans/` e não pode ser executada sem ler `docs/superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`.

## 22. Definition of Done da iniciativa

A iniciativa só pode ser chamada de concluída quando:

1. todos os planos marcados como escopo obrigatório estiverem implementados;
2. todos os gates P0/P1 aplicáveis estiverem verdes;
3. Mem0 e Graphiti tiverem rebuild/replay comprovado;
4. LGPD delete/anonymize tiver teste end-to-end sobre derived stores;
5. flags e kill switches tiverem teste real;
6. Golden Dataset provar não regressão;
7. build/testes/CI principais estiverem verdes;
8. deploy canary tiver evidência;
9. não houver recurso pago criado sem aprovação explícita;
10. documentação operacional e runbooks estiverem atualizados.
