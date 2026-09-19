# CURRENT_ARCHITECTURE — Phase 0 factual audit

- Auditoria: business-os/phase-0-audit
- Checkout: /home/claude/src/Lumenva
- SHA auditado: e45bdc4f1b18c063473e9bccdafd0d056329037a
- Blueprint: ~/master-blueprint-IMPLEMENTAVEL.md; PHASE 0 nas linhas 613–621; Wave/section 17 nas linhas 9558–9588; ordem de criação nas linhas 7440–7480.
- Data: 2026-09-11.
- Escopo: inventário factual; nenhum pacote, runtime ou schema estrutural foi criado.

## Control plane

apps/crm é a aplicação Next.js principal (apps/crm/package.json:1-20); apps/site existe como segunda aplicação. A doutrina confirma Next.js App Router, Route Handlers, workers por event_log/scheduler, Supabase/Postgres, Upstash, Zod e Sentry (CLAUDE.md:29-41). Tenancy exige organization_id confiável e filtro explícito ao usar service role (CLAUDE.md:71-82).

## Dados, eventos e workers

supabase/migrations/ contém 145 arquivos; baseline.sql, MANIFEST.md e tipos gerados são os artefactos canónicos (CLAUDE.md:96-108). event_log tem dispatcher/registro de consumidores em apps/crm/lib/event-log/dispatcher.ts:1-90; o drain vive na rota cron (dispatcher.ts:8-12). EventRow inclui organization_id, payload, metadata, consumed_by e attempts (dispatcher.ts:17-36).

Há 42 arquivos em apps/crm/workers/, incluindo agent-worker, resposta, sentimento, handoff, RAG, memória e LGPD. O worker de agente inicializa env/schema check, drain, cron, health e loops (apps/crm/workers/agent-worker/main.ts:1-15, :35-46). workers/ na raiz contém apenas voice-worker.

## Agent OS, routers, memory e tools

apps/crm/lib/agent-engine/ tem 340 arquivos. O contrato Agent OS define estados e terminalidade (apps/crm/lib/agent-engine/contracts/agent-os.ts:1-30), transições (agent-os.ts:32-55), autonomia off→autopilot_expanded (agent-os.ts:57-66) e limites de loop (agent-os.ts:68-85).

O router de intenção resolve a configuração em cada turno, filtra organization_id e usa defaults defensivos (apps/crm/lib/agent-engine/agent/router-config.ts:1-12, :58-90). RAG possui adapters native/LlamaIndex e seleção feature-gated (apps/crm/lib/ai/rag/ingestion/resolve-adapter.ts:1-20, :53-82). Mem0/Graphiti têm ports/clients e fallback Null no worker (apps/crm/workers/agent-worker/main.ts:24-33, :73-88). Tools têm registry com owner, risco, schema, side-effect, idempotência, timeout e retries (apps/crm/lib/agent-engine/tools/registry.ts:1-22); gateway está em apps/crm/lib/agent-engine/tools/gateway.ts. MCP interno está em apps/crm/lib/mcp/server.ts, auth.ts, audit.ts e tools/.

## Packages e planos

Não há arquivos packages/*/package.json e a árvore packages canónica do blueprint não existe como implementação. A separação atual é apps/crm/lib, apps/crm/workers e apps/site; packages shared, agent-runtime, model-router, memory, evidence e agent-factory previstos nas Waves 1–3 são target, não estado atual.

## Infraestrutura e observabilidade

docs/, supabase/, docker/, ops/, services/, loop/ e .claude/ estão versionados. docs/harness-audit.md:20-29 registra GitHub Actions inativo e validação local/Preview; :33-58 classifica H4 com H5 parcial. docs/threat-model.md:27-49 inventaria superfícies públicas; :55-89 registra limites em webhooks, fallback in-memory e lacunas residuais.

Este é um snapshot do SHA acima. Não prova runtime live, credenciais, deploy, provider externo ou execução de todos os gates.
