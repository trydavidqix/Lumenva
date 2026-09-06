# Project Context — Lumenva

> Contexto condensado para agentes. Validar contra fontes canônicas antes de editar.  
> Snapshot: 2026-09-06, atualizado contra `main @ ed70187c` (origin/main e VPS).

## 1. Identidade do projeto

- **Produto:** Lumenva.
- **Repo:** `trydavidqix/CRM` (privado no GitHub do dono).
- **Tipo:** sistema operacional de vendas open source/self-host com agentes de IA nativos.
- **Canal histórico principal:** WhatsApp via WAHA; há abstração/caminhos para Meta Cloud API e evolução omnichannel.
- **Modelo operacional:** multi-tenant, RLS, RGPD/GDPR by-design, self-host em VPS como parte do produto.
- **Objetivo de evolução:** funcionário virtual de IA multimodal 24/7, com memória por cliente, ferramentas reais de CRM, handoff humano, roteamento econômico de modelos e voz/telefonia compartilhando o mesmo Agent OS.
- **Não é:** um chatbot isolado, um CRM paralelo para voz, ou um runtime de agente separado por canal.

## 2. Fontes de verdade

Antes de tomar decisões:

1. `CLAUDE.md` — doutrina soberana.
2. `.claude/rules/` — regras por domínio.
3. `docs/specs/` — contratos técnicos.
4. `docs/prd/` + `docs/business-rules/` — intenção/regras de negócio.
5. `docs/current-state.md` e handoffs — estado temporal, sempre conferir data/SHA.
6. `README.md` / `ARCHITECTURE.md` — visão e mapa resumido.

Nunca transforme texto de um handoff antigo em regra permanente.

## 3. Stack canônica atual

### Aplicação principal

- Next.js 16 App Router.
- React 19.
- TypeScript 6 em modo estrito.
- Tailwind CSS + componentes Radix/shadcn-like.
- Node >= 22.
- pnpm 9.15.9.

### Backend / dados

- Route Handlers Next.js no mesmo repo.
- Supabase/Postgres.
- Supabase Auth via `@supabase/ssr`.
- Supabase Realtime.
- Supabase Storage.
- RLS em tabelas tenant-aware.
- pgvector para RAG/embeddings.
- `event_log` + workers/cron para side effects e processamento assíncrono.

### IA / agentes

- Vercel AI SDK v7.
- Providers Anthropic, OpenAI e Google via adapters oficiais.
- Os seis agentes de produção estão publicados em `openai/gpt-5.6-terra` por provider direto, com credencial BYOK em `ai_agent_versions.credential_id`.
- `AI_GATEWAY_API_KEY` e `OPENROUTER_API_KEY` estão vazias na produção; `OPENAI_API_KEY` é usada pelos agentes, embeddings/RAG e transcrição; Anthropic permanece fallback.
- O editor expõe `openai/gpt-5.6-terra` e `openai/gpt-5-mini` em `AGENT_MODELS`.
- Mudança de modelo publicada é sempre `draft -> fn_publish_ai_agent_version`; UPDATE direto é bloqueado pelo trigger de imutabilidade.
- LangGraph / LangChain presentes.
- LlamaIndex presente.
- Composio presente para tools externas.
- MCP SDK presente; CRM expõe ferramentas via MCP.
- LangSmith opcional para eval/observabilidade.
- Mem0/Graphiti e outras camadas de memória/AI Platform são opcionais, governadas por rollout/kill switches onde aplicável.

### Canais / comunicação

- WAHA Plus, NOWEB por padrão.
- WhatsApp Cloud API / Meta existe como seam opcional.
- Resend para e-mail transacional.
- Relay e-mail -> WhatsApp integrado e testado em produção em 2026-09-02.
- Conector MCP/OAuth para relay integrado em `main` em 2026-09-03.

### Infra / observabilidade

- Upstash Redis para rate limit/debounce/idempotência em superfícies específicas; há fallbacks que precisam ser entendidos antes de alterar.
- Sentry com scrub de PII.
- Docker/Docker Compose para self-host/serviços.
- Vercel usado em superfícies web/app conforme runbooks; GitHub Actions está desabilitado por decisão do dono.
- Verificação automatizada remota não deve ser presumida: gates são executados localmente/Preview conforme doutrina.

### Voz

Existem múltiplos documentos históricos/experimentais. A regra arquitetural estável é:

- voz é **outro canal** para o mesmo CRM/Agent OS;
- CRM é autoridade de tenant, identidade, memória, políticas, ferramentas, handoff e audit;
- nunca criar um segundo cérebro de negócio dentro do runtime de voz;
- arquitetura e implementação de voz evoluíram por branches/POCs, portanto sempre conferir o status canônico mais recente antes de implementar.

## 4. Dependências principais observadas no `package.json`

Entre outras:

- `next`, `react`, `react-dom`, `typescript`;
- `@supabase/supabase-js`, `@supabase/ssr`, `pg`;
- `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`;
- `@langchain/core`, `@langchain/langgraph`, checkpoint Postgres;
- `llamaindex`, `langsmith`, `@composio/core`, `@composio/vercel`;
- `@modelcontextprotocol/sdk`;
- `@upstash/redis`;
- `zod`;
- `@sentry/nextjs`;
- `resend`;
- `inngest` e `workflow` para experimentos/benchmarks duráveis;
- Vitest + Playwright + axe-core para QA.

Não introduza biblioteca nova sem verificar se o problema já tem solução no stack atual.

## 5. Estrutura mental do repositório

```text
CRM/
├── app/                    # App Router + APIs do CRM
│   └── api/                # /api/v1, /api/internal, /api/mcp, OAuth etc.
├── components/             # UI do CRM
├── hooks/                  # hooks React
├── lib/                    # auth, Supabase, AI, channels, API, env, ferramentas
├── workers/                # workers/consumers/runtimes
├── supabase/
│   ├── migrations/         # migrations versionadas
│   ├── baseline.sql        # baseline self-host
│   └── migrations/MANIFEST.md
├── tests/
│   ├── unit/
│   ├── invariants/
│   ├── e2e/
│   └── journeys/
├── scripts/                # QA, manutenção, evals, benchmarks
├── docs/                   # PRDs, specs, regras, runbooks, handoffs, planos
├── loop/                   # gov-loop / governança especializada
├── plan/                   # backlog/progresso histórico do gov-loop
├── hostgator-setup-kit/    # instalação self-host
├── ops/                    # artefatos operacionais especializados
├── website/                # site institucional Lumenva, projeto separado dentro do repo
├── CLAUDE.md               # doutrina final
├── AGENTS.md               # contrato portátil
├── ARCHITECTURE.md         # mapa arquitetural resumido
└── package.json            # app principal
```

### Importante: CRM x website

`website/` é o site institucional e possui dependências/build próprios. Não confundir otimizações do website com o runtime principal do CRM. Antes de uma auditoria, classifique o escopo:

- **CRM/app principal**;
- **website institucional**;
- **workers/runtimes de voz**;
- **infra/self-host**;
- **documentação/harness**.

## 6. Fluxo principal do CRM

### Requisição autenticada

```text
request
  -> proxy.ts
     -> request id / public-path decision / sessão Supabase
  -> Route Handler
     -> Zod
     -> guard/RBAC
     -> resolve organização de fonte confiável
     -> query com RLS ou filtro tenant manual quando service role
     -> mutação / side effect controlado
     -> audit
     -> ok()/fail()
```

### Turno do agente

```text
mensagem inbound
  -> validação/HMAC/idempotência
  -> resolve tenant + contacto
  -> event_log / dispatcher
  -> memória/RAG/contexto
  -> Agent OS / runAgentTurn
  -> tools autorizadas
  -> guardrails/políticas
  -> adapter de canal
  -> resposta
  -> memória/observabilidade/audit
  -> handoff humano quando necessário
```

### Automações

```text
evento de negócio
  -> event_log
  -> consumer/cron
  -> regra QUANDO/SE/ENTÃO
  -> ação
  -> audit/resultado/retry
```

Trigger Postgres nunca deve fazer HTTP.

## 7. Multi-tenancy: regra de sobrevivência

- Toda entidade tenant-aware deve preservar `organization_id`.
- `organization_id` não vem do body como autoridade.
- RLS é obrigatório conforme contrato da tabela.
- `service_role` bypassa RLS: query tenant-aware com admin client deve filtrar tenant manualmente.
- Alteração que toca tenancy/RLS exige prova cross-tenant.
- Platform admin é exceção controlada pelo contrato canônico, não licença para ignorar isolamento.

O pior modo de falha do produto é vazamento cross-tenant. Trate isso como severidade máxima.

## 8. Auth / API

- Backend usa `getUser()`, não `getSession()` como prova de identidade.
- RBAC tenant: `viewer < agent < manager < admin`.
- MFA TOTP obrigatório para perfis administrativos conforme contrato vigente.
- Autorização é server-side.
- Bearer/API key nunca em query string.
- Tokens persistidos devem seguir hash/representação não recuperável quando o contrato assim define.
- API `/api/v1/` usa `snake_case` e wrappers `ok()` / `fail()`.
- UUID v4, datas ISO-8601 UTC, dinheiro em `_cents` + `currency`.
- Idempotência depende da superfície; não assumir que todo POST já está coberto.

## 9. Banco / migrations

Mudança de schema deve andar em tripla:

1. migration nova em `supabase/migrations/`;
2. mudança idempotente correspondente em `supabase/baseline.sql`;
3. entrada em `supabase/migrations/MANIFEST.md`.

Quando o contrato muda, regenerar tipos. Não editar `lib/database.types.ts` manualmente.

Nunca editar migration já aplicada: usar forward-fix.

Fresh install é produto. Uma alteração que funciona no banco do desenvolvedor mas quebra `baseline.sql` é bug grave.

## 10. WhatsApp / canais

- WAHA Plus / NOWEB como default histórico.
- Webhooks WAHA usam assinatura/HMAC conforme configuração vigente.
- Inbound deve ser idempotente.
- Respeitar throttling/jitter/janelas/warm-up/opt-out do contrato atual.
- STOP/opt-out inclui vocabulário canônico atual; consultar business rules antes de mudar.
- Mídia usa Storage/URLs no caminho normal, com exceções explicitamente documentadas.
- Provider/canal deve ficar atrás do boundary canônico; `pnpm lint:channels` existe para proteger isso.

## 11. Memória e Customer Memory

Princípio arquitetural: Postgres/CRM é fonte de verdade. Camadas de memória são projeções ou índices reconstruíveis, não autoridade de negócio.

Objetivo do plano multimodal:

- contexto rápido e estruturado por cliente;
- histórico detalhado consultado sob demanda;
- evitar reenviar conversa inteira a cada turno;
- resolver identidade por telefone/contato + tenant;
- atualizar memória com auditoria e sem misturar organizações;
- não duplicar Customer Memory por canal.

## 12. Model routing / custo

A direção de produto documentada é free/cheap-first quando a qualidade permite, com fallback por capacidade, disponibilidade e risco. Entretanto:

- não trocar o provider do agente por simplesmente preencher uma env global;
- tool calling, multimodalidade e estabilidade importam mais que preço nominal em tarefas operacionais;
- modelo premium deve ser reservado a casos que justifiquem custo conforme política;
- custo/latência/provider/modelo devem ser observáveis por organização quando o fluxo suportar isso.

## 13. Integrações externas importantes

- Supabase — obrigatório para o app principal.
- WAHA — WhatsApp histórico/produção.
- Meta Cloud API — canal opcional.
- Upstash/Redis — rate limit/debounce/estado efêmero distribuído.
- Provider OpenAI direto dos agentes em produção (`gpt-5.6-terra`) via credencial BYOK; AI Gateway e OpenRouter são opcionais e não estão ativos na produção.
- Nuvemshop — integração opcional de e-commerce.
- Sentry — observabilidade.
- Resend — e-mail.
- MCP — ferramentas/integração de agentes.
- Composio — ferramentas externas.
- Mem0 / Graphiti / LangSmith — opcionais conforme rollout.
- Voz/SIP/PSTN — evolução especializada; conferir docs canônicos antes de operar.

## 14. Variáveis de ambiente

A `.env.example` já documenta um conjunto grande de variáveis. Agente deve usar apenas **nomes**, nunca valores. Grupos relevantes incluem:

- Supabase (`NEXT_PUBLIC_SUPABASE_*`, service role, DB URL);
- secrets internos/cron;
- relay/MCP relay;
- chaves de criptografia;
- WAHA/Meta;
- Redis;
- AI Gateway/providers/OpenRouter/embeddings;
- AI Platform/Composio/Mem0/Graphiti/LangSmith;
- Sentry;
- Nuvemshop;
- URLs do app/admin;
- Agent Engine / dispatch consumer;
- branding/white-label;
- flags e kill switches.

Antes de adicionar env nova, conferir `.env.example` + `lib/env.ts` e seguir a doutrina de self-host.

## 15. Comandos canônicos do app principal

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:unit
pnpm test:db
pnpm test:e2e
pnpm test:journeys
pnpm test:harness
pnpm harness:check
pnpm lint:channels
pnpm lint:tenant-filter
pnpm gov:verify
```

Existem comandos especializados de eval, voice QA e benchmarks. Consulte `package.json` atual antes de executar.

### Limite importante

`pnpm gov:verify` é um gate rápido, não prova tudo. Não substitui automaticamente:

- `test:db` para schema/RLS;
- `test:e2e` para jornadas/UI;
- prova live de integração externa;
- build/deploy de produção.

## 16. Git / branches

- `main` = produção/fonte de integração.
- Não editar diretamente `main`.
- Criar branch a partir de `main` atual.
- Nunca reset destrutivo, clean, force-push ou overwrite de trabalho alheio.
- Não mergear em `main` sem autorização explícita para o merge.
- Branches observadas no snapshot de 2026-09-03:
  - `main`;
  - `feat/mcp-relay-connector` — já atrás de main e sem commits exclusivos no snapshot, pois a funcionalidade foi integrada;
  - `feat/website-form-a11y-phosphor` — branch divergente com trabalho próprio de website, requer reconciliação antes de qualquer merge.

Branches históricas citadas em docs podem já ter sido integradas/removidas. Nunca assumir existência só porque um handoff cita o nome.

## 17. Estado recente confirmado no Git em 2026-09-06

Main avançou além do snapshot de `docs/current-state.md` de 2026-09-01. Entre as mudanças recentes:

- relay e-mail -> WhatsApp integrado e confirmado em produção;
- conector MCP/OAuth do relay integrado;
- correções de OAuth/Redis e parsing em produção após investigação de causa raiz;
- atualização do Vercel AI SDK para linha 7.0.91 no repo atual;
- website institucional recebeu hardening SEO/GEO, segurança, UX, acessibilidade e performance;
- estado atual: `main`, `origin/main` e VPS em `ed70187c`; os seis agentes publicados usam OpenAI `gpt-5.6-terra` via provider direto.

Isto significa que `docs/current-state.md` é útil, mas seu cabeçalho/audited_against não representa sozinho o HEAD de 2026-09-03.

## 18. Segurança / privacidade

Não negociável:

- não vazar secrets/PII em log, screenshot, teste, commit ou docs;
- inputs externos com Zod;
- comparar secrets de borda de modo seguro conforme helper/código canônico;
- preservar anti-SSRF em webhooks de saída;
- garantir tenant em uso de service role;
- audit append-only onde exigido;
- RGPD/GDPR é o vocabulário legal atual da operação europeia;
- anonimização preferida a delete físico quando há dependências históricas, conforme contrato;
- operações de dados sensíveis precisam de audit;
- não inventar implementação de compliance além do que as fontes canônicas dizem.

## 19. Definition of Done prática para agente

Antes de declarar uma mudança pronta:

1. escopo pedido foi respeitado;
2. fonte canônica foi lida;
3. nenhum invariante foi violado;
4. tipos passam no escopo aplicável;
5. lint aplicável passa;
6. unit tests relevantes passam;
7. DB/RLS foi testado se schema/tenant foi tocado;
8. E2E/jornada foi testada se UI/fluxo foi tocado;
9. build passa quando necessário;
10. não há secrets/PII/logs temporários;
11. docs e env contract foram atualizados quando mudaram;
12. comportamento self-host/fresh install foi considerado;
13. foi dito explicitamente o que **não** foi testado.

## 20. Regra para agentes que vão auditar o projeto

Primeiro ler. Depois provar. Só então propor.

Não transformar busca textual em bug. Não chamar código morto sem provar ausência de referências dinâmicas/configuração/route discovery. Não remover dependência apenas porque um import não apareceu numa busca simples. Não mudar arquitetura porque "parece melhor" sem comparar com specs e restrições de self-host/multi-tenant.

Para protocolo detalhado, use `docs/ai/AUDIT_RULES.md`.
