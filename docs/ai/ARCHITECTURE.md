# Architecture for AI Agents — Lumenva

> Mapa operacional para acelerar leitura de codebase. Não substitui `ARCHITECTURE.md`, specs nem rules.  
> Snapshot atualizado: 2026-09-06, base `main @ ed70187c`.

## Estado de provider em produção

Os seis agentes publicados usam `provider=openai`, `model=gpt-5.6-terra` e
`credential_id` BYOK em `ai_agent_versions`; o runtime resolve a configuração
pelo `ai_agents.published_version_id`. Em produção o provider é direto:
`AI_GATEWAY_API_KEY` e `OPENROUTER_API_KEY` ficam vazias, `OPENAI_API_KEY` é a
chave ativa para OpenAI, e Anthropic é fallback. Trocas de versão seguem
`draft -> public.fn_publish_ai_agent_version`; o trigger de imutabilidade recusa
UPDATE direto de conteúdo em versão publicada.

## 1. Princípio arquitetural

O CRM é a fonte de verdade de negócio. Canais, agentes, voz, memória auxiliar, integrações e automações convergem para o mesmo núcleo de tenant, identidade, políticas, ferramentas e auditoria.

```text
                           CLIENTE
                              │
        ┌─────────────────────┼──────────────────────┐
        │                     │                      │
     WhatsApp               Voz                 Webhooks/API
        │                     │                      │
   WAHA / Meta           SIP/PSTN stack         integrações
        │                     │                      │
        └──────────────┬──────┴──────────────┬───────┘
                       │                     │
                 CHANNEL/INGEST          AUTH/GUARDS
                       │                     │
                       └──────────┬──────────┘
                                  │
                           TENANT + IDENTITY
                                  │
                          CUSTOMER CONTEXT
                                  │
                              AGENT OS
                      ┌───────────┼───────────┐
                      │           │           │
                    RAG        TOOLS       POLICY
                      │           │           │
                      └───────────┼───────────┘
                                  │
                             CRM / DB
                                  │
                   events / audit / observability
```

## 2. Boundaries que não devem ser quebrados

### 2.1 Tenant boundary

Toda leitura/escrita tenant-aware precisa carregar organização de fonte confiável. Service role não é autorização global para dados de tenant.

### 2.2 Channel boundary

Regras de negócio não devem depender diretamente de WAHA/Meta/Telnyx/etc. Provider deve ficar atrás da abstração de canal apropriada.

### 2.3 Agent boundary

O agente não deve acessar banco cru de forma ad-hoc quando existe Tool Gateway/contrato de ferramenta. Ferramentas precisam respeitar autorização, tenant, auditoria e política de autonomia.

### 2.4 Memory boundary

CRM/Postgres é autoridade. Mem0/Graphiti/RAG/sumários são projeções/contexto e precisam poder ser reconstruídos ou invalidados.

### 2.5 Voice boundary

Runtime de voz transporta conversa e sinais; não cria um segundo CRM ou um segundo conjunto de regras comerciais.

### 2.6 External side-effect boundary

Trigger de Postgres não faz HTTP. Side effects de rede pertencem a workers/consumers.

## 3. App principal

### Entrada web

Next.js 16 App Router. Server Components são default quando possível. Client Components entram quando estado/interatividade exigem.

Rotas autenticadas passam pelo boundary de borda em `proxy.ts`, que participa de:

- distinção public/private path;
- contexto da request;
- sessão Supabase;
- request id/headers conforme contrato atual.

Não introduzir lógica de negócio pesada em `proxy.ts`.

### API

Superfícies relevantes:

```text
/api/v1/*          API canônica do produto
/api/v1/webhooks/* webhooks externos
/api/v1/cron/*     consumers/rotinas protegidas por secret
/api/internal/*    integração interna protegida
/api/mcp           MCP do CRM
/api/oauth/*       OAuth ligado a conectores/integradores quando aplicável
```

Para cada rota, identificar primeiro:

1. como autentica;
2. como resolve organização;
3. se usa session client ou admin/service role;
4. como valida input;
5. se muta dados;
6. se precisa de audit;
7. se precisa de idempotência/rate limit;
8. se dispara side effect externo.

## 4. Auth e RBAC

### Sessão

No server, identidade deve ser provada com `getUser()` no padrão atual. Não confiar em `getSession()` como prova de identidade server-side.

### Papéis de tenant

```text
viewer < agent < manager < admin
```

Platform admin é domínio separado e segue contrato canônico.

### MFA

TOTP obrigatório nos perfis administrativos conforme PRD/spec atual. Não remover enforcement por conveniência de UI/E2E.

### Convites/tokens

Tokens e bearer devem seguir os helpers e política de hashing/segredos atuais. Nunca mover API key para query string.

## 5. Multi-tenancy e dados

### Regra central

```text
request/event
   -> trusted identity
   -> trusted organization
   -> authorized operation
   -> RLS or explicit tenant filter
```

Não aceitar isto:

```text
body.organization_id -> admin client -> query
```

sem prova confiável de que a organização pertence ao actor.

### Service role

`createAdminClient` bypassa RLS. Toda query tenant-aware precisa de filtro manual e revisão cuidadosa de dataflow.

### Cross-tenant tests

Mudança em schema, service role, RBAC, routing ou identity resolution deve considerar teste com duas organizações distintas.

## 6. Schema e baseline

O projeto precisa suportar instalação fresca self-host. Por isso o schema tem dois caminhos que precisam permanecer sincronizados:

```text
migrations incrementais  -> instalações existentes
baseline.sql             -> instalação fresca
MANIFEST                 -> cadeia/documentação
```

Qualquer alteração de schema relevante:

```text
nova migration
+ baseline idempotente
+ MANIFEST
+ tipos regenerados quando necessário
```

Migrations aplicadas são imutáveis; correção é forward-fix.

## 7. Event log e workers

`event_log` é o seam principal para trabalho assíncrono/side effects.

```text
mutação / trigger local
   -> event_log
      -> claim/consumer
         -> worker
            -> side effect
               -> status/retry/audit
```

Objetivos:

- evitar HTTP dentro da transação do banco;
- permitir retries;
- evitar duplicação;
- tornar falha visível;
- desacoplar canal/integração da transação original.

Workers importantes vivem em `workers/`, incluindo runtime do agente e consumers relacionados a mídia/RAG/privacy conforme árvore atual.

## 8. WhatsApp

### Inbound

```text
WAHA/Meta webhook
 -> assinatura/validação
 -> rate limit quando aplicável
 -> resolve canal/sessão/tenant
 -> dedupe/idempotência
 -> persiste mensagem/evento
 -> dispatcher/worker
```

### Outbound

```text
Agent OS / automação / humano
 -> policy/guard
 -> channel adapter
 -> pacing/anti-ban
 -> provider
 -> persistência/status
```

### Regras sensíveis

- manter `external_id`/dedupe tenant-aware;
- respeitar opt-out;
- não transformar grupo em lead indevidamente;
- manter comportamento multi-device/fromMe conforme contrato;
- não remover throttle/jitter/janelas sem business rule explícita;
- mídia deve seguir armazenamento/URL e políticas atuais.

## 9. Agent OS

A visão do projeto é um sistema com funções especializadas, mas sem quebrar o núcleo de governança.

Conceitos recorrentes na documentação/implementação:

- Kernel/turn runtime;
- atendimento;
- vendas;
- retenção/follow-up;
- supervisor;
- escalation/handoff;
- CRM operator;
- Tool Gateway/Registry;
- políticas de autonomia;
- evals/shadow mode;
- observabilidade;
- model router;
- learning/flywheel com gate humano.

Nem toda fase histórica citada em planos está necessariamente ativa no HEAD. Auditar implementação real antes de usar nome de fase como verdade.

## 10. Turno do agente

Modelo mental recomendado:

```text
INPUT
  │
  ├─ mensagem/evento
  ├─ tenant
  ├─ contacto/lead
  ├─ channel context
  └─ policy context
        │
        ▼
CONTEXT ASSEMBLY
  ├─ customer quick memory
  ├─ recent conversation
  ├─ RAG/knowledge sob demanda
  └─ business state/tool state
        │
        ▼
MODEL ROUTER
  ├─ capability
  ├─ tool calling
  ├─ multimodal
  ├─ availability
  ├─ cost
  └─ policy
        │
        ▼
AGENT DECISION
  ├─ answer
  ├─ tool call
  ├─ clarification
  └─ handoff
        │
        ▼
GUARDRAILS / POLICY
        │
        ▼
SIDE EFFECT / RESPONSE
        │
        ▼
MEMORY + AUDIT + METRICS
```

## 11. RAG e memória

### Fonte de verdade

Leads, contacts, mensagens, pedidos, estado do CRM e audit pertencem ao Postgres/CRM.

### Camadas auxiliares

A documentação descreve camadas com papéis distintos:

- memória rápida por cliente;
- histórico bruto;
- RAG institucional;
- memória por pessoa/fatos;
- grafo temporal/relacional;
- índices/embeddings.

A regra de custo é não jogar histórico inteiro no prompt por default.

### Pattern esperado

```text
turno normal
 -> resumo/estado compacto
 -> busca adicional somente quando a pergunta exige
```

### Risco

Não deixar uma projeção de memória sobrescrever silenciosamente um dado transacional mais confiável.

## 12. Model routing

O router deve considerar mais do que preço:

```text
capability > policy > reliability > tool support > latency > cost
```

Para tarefas simples, cheap/free-first faz sentido. Para ações comerciais, modelo incapaz de tool calling pode produzir texto convincente sem executar a operação — falha silenciosa grave.

Registrar/observar modelo/provider quando o runtime suportar.

## 13. MCP / tools

O CRM tem MCP e ferramentas internas. Em qualquer tool:

- validar identidade/autorização;
- resolver tenant de fonte confiável;
- validar input;
- minimizar acesso;
- auditar mutações relevantes;
- usar idempotência quando efeito puder repetir;
- não retornar segredo/PII desnecessária;
- preferir operações semânticas do domínio a SQL genérico.

## 14. Relay e-mail -> WhatsApp

Fluxo integrado:

```text
ChatGPT/cliente autorizado
 -> endpoint interno de notificação
 -> valida secret/identidade da integração
 -> resolve destino autorizado
 -> conversa/contato CRM
 -> envio pelo canal WhatsApp
```

Foi confirmado em produção em 2026-09-02. Em 2026-09-03 entrou conector MCP/OAuth para aproximar o fluxo de uma superfície integrada.

Durante a estabilização houve bugs reais de OAuth e serialização Redis; as correções estão em `main`. Não reintroduzir parsing manual/duplo sem entender o comportamento do SDK `@upstash/redis`.

## 15. OAuth/MCP relay

Achado recente importante: o SDK Upstash já pode devolver valor desserializado. Código que faz `JSON.parse()` incondicional em valor retornado pelo SDK pode quebrar com `[object Object]`.

Outro achado recente: o caminho `req.formData()` foi substituído por parsing explícito de `application/x-www-form-urlencoded` nas rotas afetadas devido ao comportamento observado no runtime/versão atual. Não "simplificar" de volta sem teste de produção/integração correspondente.

## 16. Rate limiting

Rate limit existe em várias superfícies, mas a cobertura é histórica e evolui. Antes de afirmar "sem rate limit" ou "totalmente protegido":

- procure helper atual;
- verifique chamada real na rota;
- verifique chave de identidade usada;
- confirme Redis distribuído vs fallback em memória;
- confira comportamento multi-instância.

O fallback in-memory não equivale a limite distribuído.

## 17. Segurança de outbound webhook

Há guard anti-SSRF dedicado para webhook de saída. Trate como boundary crítico. Mudança em parsing/redirect/DNS/URL validation precisa de unit tests e E2E apropriado.

## 18. Privacidade / RGPD

A operação atual é orientada a RGPD/GDPR. Elementos históricos podem ainda usar nomes `lgpd` por compatibilidade de schema/harness.

Princípios do código/doutrina:

- anonimização irreversível quando aplicável;
- preservar histórico necessário sem reter PII indevida;
- export/redact por worker onde definido;
- audit de operações sensíveis;
- não logar PII/secrets;
- mudança legal/compliance precisa seguir fonte canônica, não opinião do agente.

## 19. Observabilidade

Sentry + logger estruturado. Regras:

- `console.log` temporário não fica merged;
- scrub de PII deve ser preservado;
- erro operacional importante não deve ser engolido;
- request/event/tenant correlation deve permanecer possível sem expor dados sensíveis;
- audit de negócio e telemetria técnica são conceitos diferentes.

## 20. Website institucional

`website/` é projeto separado dentro do mesmo repo.

Em 2026-09-03 recebeu alterações recentes de:

- SEO/GEO;
- metadata/Open Graph;
- segurança/FETCH metadata/anti-CSRF/CSP;
- acessibilidade;
- performance e redução de hidratação;
- telemetria diferida;
- nova área de serviços;
- limpeza com `knip`;
- Lighthouse e E2E do website.

Não usar comandos/dependências do root automaticamente no `website/`; conferir `website/package.json`.

## 21. Voz

Há documentação de diferentes etapas e escolhas técnicas. Antes de tocar voz:

1. leia o status canônico mais recente em `docs/voice/` e handoffs atuais;
2. identifique o que está em `main` vs branch histórica/POC;
3. não copiar config real contendo segredo;
4. garantir tenant/identity bridge;
5. manter Agent OS como cérebro;
6. medir latência/qualidade em prova live quando a alteração toca áudio real.

Documentação de arquitetura menciona POCs/branches com Asterisk/ARI/Pipecat e outras fases com Telnyx/LiveKit/Patter. Isso é sinal de evolução: **não escolher stack apenas pelo primeiro doc encontrado**.

## 22. Self-host / deploy

Fresh install é caso de uso principal. Runbook é autoridade operacional.

Pontos que historicamente causaram problemas:

- container saudável mas reverse proxy/roteamento errado;
- código atualizado no checkout mas imagem/container antigo ainda rodando;
- build pesado em VPS pequena causando pressão/OOM;
- baseline/migrations divergentes;
- configuração hospedada do Supabase (ex.: templates Auth) não refletida automaticamente por arquivos locais.

Não operar produção por memória. Ler `docs/runbooks/deploy.md`.

## 23. Test architecture

### Unit

Vitest. Bom para helpers, regras, parsing, policy, adapters.

### DB/invariants

`pnpm test:db` e invariantes. Essencial para RLS/schema/isolation. Não está implicitamente coberto por `test:unit`.

### E2E

Playwright. Necessário para jornadas/UI e alguns guards ponta-a-ponta.

### Harness

`test:harness` / `harness:check` protege consistência de instruções/doutrina.

### Specialized

Voice QA, journeys, AI evals e benchmarks têm comandos próprios. Consultar package atual.

## 24. Arquivos de alto risco

Trate mudanças com revisão reforçada:

```text
supabase/baseline.sql
supabase/migrations/**
supabase/migrations/MANIFEST.md
lib/database.types.ts
lib/supabase/admin.ts
lib/auth/public-paths.ts
lib/env.ts
lib/api/wrappers.ts
lib/api/errors.ts
proxy.ts
app/api/v1/webhooks/**
app/api/v1/cron/**
app/api/internal/**
app/api/mcp/**
lib/ai/**
lib/waha/**
lib/automation/outbound-url.ts
docker-compose*.yml
hostgator-setup-kit/**
docs/runbooks/deploy.md
loop/**
.env*
```

## 25. Como navegar sem varrer tudo

Para uma tarefa, comece pelo domínio:

```text
Auth/RBAC        -> CLAUDE + security/multi-tenancy rules + spec 01 + lib/auth + guards
DB/RLS           -> DB rules + spec + migrations/baseline + invariants
WhatsApp         -> whatsapp rule + spec 03 + lib/waha/channels + webhook routes
Agents           -> specs 05/10/11/12/14/16 + lib/ai + workers + tool gateway
Memory/RAG       -> memory architecture + lib/ai/rag/memory + migrations relacionadas
Automation       -> event spec + automation libs + event_log consumers
Privacy          -> privacy/LGPD rule + specs + workers + migrations
Deploy           -> runbook + compose + kit + env contract
Website          -> website package + website tests + design system
Voice            -> docs/voice + canonical handoff/status + worker/runtime correspondente
```

Depois siga imports/calls reais. Não faça busca global de 1.500 arquivos antes de construir esse mapa.
