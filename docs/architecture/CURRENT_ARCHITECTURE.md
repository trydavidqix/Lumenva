# CURRENT_ARCHITECTURE — Phase 0 factual audit

- Auditoria: business-os/phase-0-audit
- Checkout: /home/claude/src/Lumenva
- SHA auditado: e45bdc4f1b18c063473e9bccdafd0d056329037a
- Blueprint: ~/master-blueprint-IMPLEMENTAVEL.md; PHASE 0 nas linhas 613–621; Wave/section 17 nas linhas 9558–9588; ordem de criação nas linhas 7440–7480.
- Data: 2026-09-11.
- Escopo: inventário factual; nenhum pacote, runtime ou schema estrutural foi criado.

## Control plane

apps/crm é a aplicação Next.js principal (apps/crm/package.json:1-20); apps/website é a aplicação pública e de blog. A arquitetura também mantém Social Brain em apps/social-web, apps/social-worker e apps/social-mcp, além dos executáveis de voz e composição em apps/voice-worker e apps/video-composer. A doutrina confirma Next.js App Router, Route Handlers, workers por event_log/scheduler, Supabase/Postgres, Upstash, Zod e Sentry (CLAUDE.md:29-41). Tenancy exige organization_id confiável e filtro explícito ao usar service role (CLAUDE.md:71-82).

## Dados, eventos e workers

infra/supabase/migrations/ contém 145 arquivos; baseline.sql, MANIFEST.md e tipos gerados são os artefactos canónicos (CLAUDE.md:96-108). event_log tem dispatcher/registro de consumidores em apps/crm/lib/event-log/dispatcher.ts:1-90; o drain vive na rota cron (dispatcher.ts:8-12). EventRow inclui organization_id, payload, metadata, consumed_by e attempts (dispatcher.ts:17-36).

Há 42 arquivos em apps/crm/workers/, incluindo agent-worker, resposta, sentimento, handoff, RAG, memória e LGPD. O worker de agente inicializa env/schema check, drain, cron, health e loops (apps/crm/workers/agent-worker/main.ts:1-15, :35-46). O voice worker independente agora está em apps/voice-worker/.

## Agent OS, routers, memory e tools

apps/crm/lib/agent-engine/ tem 340 arquivos. O contrato Agent OS define estados e terminalidade (apps/crm/lib/agent-engine/contracts/agent-os.ts:1-30), transições (agent-os.ts:32-55), autonomia off→autopilot_expanded (agent-os.ts:57-66) e limites de loop (agent-os.ts:68-85).

O router de intenção resolve a configuração em cada turno, filtra organization_id e usa defaults defensivos (apps/crm/lib/agent-engine/agent/router-config.ts:1-12, :58-90). RAG possui adapters native/LlamaIndex e seleção feature-gated (apps/crm/lib/ai/rag/ingestion/resolve-adapter.ts:1-20, :53-82). Mem0/Graphiti têm ports/clients e fallback Null no worker (apps/crm/workers/agent-worker/main.ts:24-33, :73-88). Tools têm registry com owner, risco, schema, side-effect, idempotência, timeout e retries (apps/crm/lib/agent-engine/tools/registry.ts:1-22); gateway está em apps/crm/lib/agent-engine/tools/gateway.ts. MCP interno está em apps/crm/lib/mcp/server.ts, auth.ts, audit.ts e tools/.

## Packages e planos

O código compartilhado fica em packages, organizado por domínio. Os pacotes de Social Brain e operating-core estão sendo consolidados sob packages/core; integrações, observabilidade e plataforma permanecem em seus grupos. Capacidades futuras de agent-runtime, model-router, memory, evidence e agent-factory continuam sendo target quando ainda não houver implementação correspondente.

## Infraestrutura e observabilidade

docs/, infra/, knowledge/, evidence/, tooling/ e .claude/ seguem a organização registrada em REPOSITORY_LAYOUT.md. Dockerfiles, Compose e Cloud Build permanecem na raiz por dependerem do contexto raiz de build; apps, packages, scripts e stacks de deployment usam seus destinos canônicos.

Este é um snapshot do SHA acima. Não prova runtime live, credenciais, deploy, provider externo ou execução de todos os gates.
