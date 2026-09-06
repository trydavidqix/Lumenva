# AI Project State — Lumenva

> Snapshot operacional rápido para iniciar uma sessão sem reler todo o histórico.  
> **Data:** 2026-09-06
> **Fonte principal:** GitHub `trydavidqix/Lumenva`
> **Main/VPS auditada:** `ed70187c`

## 1. Estado do Git

### Repositório

- privado;
- owner: `trydavidqix`;
- default branch: `main`;
- permissões do dono incluem admin/push;
- `main` é produção/fonte de integração e a única branch de entrega;
- `origin/main` e VPS devem permanecer no mesmo SHA;
- `upstream/*` é o fork upstream e permanece somente leitura.

### Branches observadas antes desta camada de contexto

- `main`;
- `feat/mcp-relay-connector`;
- `feat/website-form-a11y-phosphor`.

### Situação relativa

`feat/mcp-relay-connector`:

- `ahead_by: 0` contra main no compare observado;
- `behind_by: 10`;
- funcionalidade principal já integrada em `main`.

`feat/website-form-a11y-phosphor`:

- divergente;
- 3 commits próprios no compare observado;
- 18 commits atrás de main;
- toca formulário, design/iconografia e vários arquivos do website;
- precisa reconciliação seletiva antes de qualquer integração.

### Estado atual de agentes e providers

Os seis agentes de produção estão publicados em `openai/gpt-5.6-terra`, com
credencial BYOK e provider direto. Gateway e OpenRouter não estão ativos na
cadeia de produção; Anthropic permanece fallback. O campo consumido pelo
runtime é a versão apontada por `ai_agents.published_version_id`, não
`ai_agents.model`.

## 2. Últimos commits relevantes observados em main

### 2026-09-03 — website/performance

`ed70187c`

- otimização do site institucional;
- logo grande substituído por asset otimizado;
- redução de hidratação;
- telemetria diferida;
- melhora de Lighthouse mobile reportada no commit;
- typecheck/lint/build reportados verdes pelo autor do commit.

### 2026-09-03 — website overhaul

`03c29e7012acd842543d295a74b04ad732c15404`

- SEO/GEO/metadata/Open Graph;
- correções de aria/accessibility;
- segurança Fetch Metadata/anti-CSRF/CSP/security.txt;
- performance/dead deps;
- UX/design system;
- rota `/servicos`;
- `knip`/limpeza;
- E2E e Lighthouse reportados no commit.

### 2026-09-03 — OAuth/Redis root cause

`4b83a6c141f9c5ddeaf5f3e72665835bd3f221c0`

- corrigido JSON.parse duplo sobre valor já desserializado pelo `@upstash/redis`;
- causa raiz encontrada com instrumentação passo a passo em produção.

### 2026-09-03 — OAuth form-urlencoded

`0dba06b3983f8dcd4d455950e57566dfa7a8410c`

- trocado `req.formData()` por parsing manual `req.text()` + `URLSearchParams` nas rotas afetadas.

### 2026-09-03 — OAuth exposure/discovery

`ff0ad750e12a556207abcc3506801ea82e000072`

- exposição das rotas de handshake OAuth.

`853cdcc2ffa6bf2121c008c821ffc13a664db061`

- ajuste de public paths/discovery OAuth.

### 2026-09-03 — AI SDK tests

`c6d986559c0d0993f8492b9b89e44b8fae8f4f71`

- estabilização de teste que dependia de comportamento ambiental de AI Gateway/Vercel.

`15a8ad8f603fd5e3d8056f9739017f07c62b364b`

- removida dependência de mensagem de erro interna volátil do SDK.

`0175a452ebacd3aa3ecac7ad6348f5005741e545`

- atualização do `ai` SDK para 7.0.91 e providers relacionados.

### 2026-09-03 — MCP relay

`477734175ad76e230e48b53a6b89404b538caa29`

- merge do conector MCP com OAuth 2.0 + PKCE para o relay e-mail->WhatsApp.

`02198feb1fd3585d197ffbed871992dc8d42d845`

- implementação original da feature.

### 2026-09-02 — relay produção

`b74ad8397b3e8807e3c948d757ff3e6accf57616`

- documentação de relay confirmado ponta a ponta;
- registro de deploy stale container;
- contato sem `phone_number` como causa de falha fechada;
- atualização de recomendação operacional de swap/build na VPS.

`8798ae894f7c737bb24178d06570f9bc537a0dbe`

- merge da feature de relay e-mail->WhatsApp.

## 3. Identidade e visão atuais

Lumenva é um sistema operacional de vendas self-host com:

- CRM multi-tenant;
- atendimento WhatsApp;
- agentes de IA nativos;
- RAG/memória;
- ferramentas que executam operações reais;
- automações;
- governança/handoff humano;
- integrações;
- evolução para omnichannel/voz;
- observabilidade e políticas de custo/model routing.

A meta de arquitetura é um único Agent OS operando múltiplos canais, não vários bots independentes.

## 4. Stack atual observada

Root `package.json`:

- Node >=22;
- pnpm 9.15.9;
- Next 16.3.x;
- React 19.2.x;
- TypeScript 6.0.x;
- Supabase SSR/JS;
- Postgres `pg`;
- AI SDK 7.0.91 range atual;
- Anthropic/OpenAI/Google adapters;
- MCP SDK;
- LangChain/LangGraph;
- Composio;
- Upstash Redis;
- Sentry;
- Inngest/workflow para benchmarks/experimentos;
- Vitest 4;
- Playwright 1.62;
- Zod 4.

Valores de patch envelhecem; conferir `package.json` antes de qualquer decisão de compatibilidade.

## 5. Comandos importantes observados

Root:

- `pnpm dev`;
- `pnpm build`;
- `pnpm build:docker`;
- `pnpm lint`;
- `pnpm format` / `format:check`;
- `pnpm typecheck`;
- `pnpm test:unit`;
- `pnpm test:db`;
- `pnpm test:e2e`;
- `pnpm test:journeys`;
- `pnpm test:harness`;
- `pnpm test:voice:qa`;
- `pnpm lint:channels`;
- `pnpm lint:tenant-filter`;
- `pnpm gov:verify`;
- AI eval commands;
- phase 7 benchmark commands.

GitHub Actions não deve ser presumido ativo.

## 6. Estado documental

### `CLAUDE.md`

É a autoridade final e está muito mais atualizado do que vários snapshots antigos. Contém:

- stack;
- invariantes;
- multi-tenancy;
- auth/RBAC;
- migrations;
- idempotência;
- audit;
- RGPD;
- API;
- WAHA;
- modelagem;
- paths sensíveis;
- deploy;
- testes/DoD.

### `AGENTS.md`

Contrato portátil para Codex/Cursor/Copilot/outros. Deve continuar leve e apontar para a doutrina, sem duplicar tudo.

### `docs/current-state.md`

Útil, mas `audited_against` principal está defasado em relação a `main` de 2026-09-03. Reconciliar antes de usar como estado exato.

### `docs/harness-audit.md`

Boa fonte de riscos de processo, mas alguns itens foram corrigidos depois de 2026-08-28. Exemplo: env vars antes ausentes agora aparecem na `.env.example`.

### `docs/threat-model.md`

Boa base de superfície de ataque, mas também precisa revalidação de pontos que evoluíram, especialmente login/rate limit.

## 7. Estado do `.env.example`

O template atual está significativamente completo e inclui grupos para:

- Supabase;
- cron/internal;
- relay e MCP relay;
- encryption keys;
- WAHA;
- Redis;
- AI Gateway/providers/OpenRouter;
- AI Platform;
- Content OS;
- workers;
- Sentry;
- impersonate;
- privacy/LGPD naming legado;
- Nuvemshop;
- app URLs;
- Agent Engine;
- dispatch ownership;
- flywheel;
- branding;
- Meta Cloud API;
- override de login IP somente para E2E.

Nunca copiar valores reais para docs/agente.

## 8. Estado do relay e-mail -> WhatsApp

### Confirmado

- código integrado em main;
- endpoint interno existe;
- fluxo real chegou ao WhatsApp do dono em produção em 2026-09-02;
- documentação de handoff existe;
- depois foi criado/integrado conector MCP/OAuth.

### Armadilhas conhecidas

- código no checkout da VPS não garante container atualizado;
- contato/destino precisa ter telefone resolvido no CRM;
- OAuth passou por bugs de parsing/Redis já corrigidos;
- regressão precisa de testes que representem runtime atual.

## 9. Estado do website institucional

Separado em `website/`.

Em 2026-09-03 recebeu forte ciclo de:

- SEO/GEO;
- segurança;
- acessibilidade;
- design/UX;
- performance;
- dead code/deps;
- E2E/Lighthouse.

Existe branch divergente com mudanças de formulário/a11y/Phosphor que precisa comparação seletiva com main atual.

## 10. Estado do Agent OS

Há bastante implementação e documentação já integradas, mas o estado por "Fase N" é histórico e mudou em várias ondas.

Confirmado por fontes:

- conceitos de Kernel/Agent OS estão presentes na documentação e testes;
- fases 2/4/5 foram citadas como integradas no snapshot de 2026-09-01;
- planos posteriores incluem memory, model routing, voz, flywheel, durable execution;
- commits de 2026-09-02 mencionam contratos/evolution de fases posteriores.

**Não confirmado neste snapshot:** mapa exato módulo-a-módulo de Fases 3/6/7 no HEAD de 2026-09-03.

Antes de implementar Agent OS, fazer inventário real do código.

## 11. Estado de memória/RAG

Direção arquitetural:

- Postgres = source of truth;
- RAG institucional separado de dado transacional;
- memória rápida por cliente para reduzir tokens;
- histórico completo sob demanda;
- Mem0/Graphiti e afins opcionais/projeções;
- tenant isolation obrigatório em todas as camadas.

Auditoria prioritária: inconsistência de memória, stale data, privacy cleanup e namespace cross-tenant.

## 12. Estado de voz

A arquitetura oficial do root afirma que voz deve compartilhar CRM/Agent OS. Documentos e POCs registram evolução por várias stacks/branches.

O que um novo agente deve assumir:

- voz **não** é um subsistema de negócio independente;
- existe trabalho real/POC e evidência de chamadas/bridge em histórico;
- estado de integração em `main` precisa inspeção antes de alteração;
- áudio live/infra deve ser provado separadamente de unit/provider-free tests;
- documentos datados podem representar decisões substituídas.

## 13. Estado de segurança

Proteções arquiteturais fortes documentadas:

- RLS;
- tenant filter;
- RBAC server-side;
- HMAC em webhooks;
- tokens/bearers em header;
- anti-SSRF;
- Zod;
- Sentry scrub;
- audit;
- RGPD;
- lint de tenant/channel.

Áreas que continuam merecendo auditoria máxima:

- service role dataflow;
- public paths;
- OAuth/MCP/internal;
- rate limits distribuídos;
- secret/PII em evidence;
- fresh install/schema;
- memory isolation;
- tool authorization.

## 14. Estado do harness

Pontos fortes:

- doutrina muito detalhada;
- AGENTS portátil;
- specs/PRDs extensos;
- invariantes DB;
- unit/E2E;
- harness checks;
- gov-loop;
- runbooks.

Pontos fracos/operacionais:

- GitHub Actions desabilitado;
- `gov:verify` não cobre tudo;
- integrações live dependem de ambiente;
- docs de estado envelhecem rápido;
- não há scanner de secrets integrado observado;
- evidência visual exige revisão manual de PII.

## 15. Backlog inferido mais importante para uma auditoria nova

Não é backlog oficial; é ordem de investigação recomendada:

1. service-role/cross-tenant;
2. auth/public paths/OAuth/MCP;
3. baseline/migrations/fresh install;
4. event_log/idempotency/races;
5. Agent OS tools/autonomy;
6. model router capability/fallback/custo;
7. memory/RAG privacy/tenant;
8. relay regression tests/preflight;
9. deployment drift/runtime SHA;
10. secret/PII prevention;
11. voice canonical-state reconciliation;
12. branch divergente do website;
13. dead code/dependency cleanup após bugs críticos.

## 16. O que não foi executado para gerar este snapshot

Este documento foi criado por leitura via GitHub e comparação de branches/commits. **Não foram executados localmente** nesta sessão:

- `pnpm install`;
- `typecheck`;
- lint;
- unit tests;
- DB invariants;
- E2E;
- build;
- deploy;
- pentest;
- chamadas de produção.

Portanto, "observado no Git" não significa "executado e verde agora".

## 17. Próxima atualização deste arquivo

Atualizar quando ocorrer um destes eventos:

- merge relevante em main;
- mudança grande de Agent OS/voice/model routing;
- nova auditoria profunda;
- mudança de deploy/topologia;
- incidente de segurança/produção;
- atualização de stack maior;
- branch importante integrada/removida;
- alteração dos invariantes canônicos.
