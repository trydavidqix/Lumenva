# CAPABILITY_MAP — atual versus Business OS blueprint

Auditoria: business-os/phase-0-audit, SHA e45bdc4f1b18c063473e9bccdafd0d056329037a, /home/claude/src/Lumenva, 2026-09-11.

Legenda: EXISTS = código/contrato identificável; PARTIAL = parte existente; MISSING = não identificado; UNKNOWN = exigiria prova externa. Ação: REUSE, EXTEND, REFACTOR, CREATE, DEPRECATE.

| Capacidade | Evidência real | Estado | Ação |
|---|---|---|---|
| CRM/control plane | apps/crm/package.json:1-20; CLAUDE.md:21-41 | EXISTS | REUSE |
| tenancy/RLS/auth/LGPD | CLAUDE.md:71-108; supabase/migrations/ | EXISTS | REUSE |
| event_log/event contracts | apps/crm/lib/event-log/dispatcher.ts:1-90 | EXISTS | EXTEND por contrato |
| Job Engine/workers | apps/crm/lib/agent-engine/queue; apps/crm/workers/agent-worker/main.ts:1-15 | PARTIAL | EXTEND |
| Evidence como package | apps/crm/lib/agent-engine/obs e lib/audit | PARTIAL | REFACTOR/EXTEND; packages/evidence MISSING |
| Policy/Approval | apps/crm/lib/agent-engine/policies; contracts/approval-contract.test.ts | PARTIAL | EXTEND |
| AgentDefinition/versioning | apps/crm/lib/agent-engine/agent/agent-config.ts; migrations 0050/0051 | PARTIAL | EXTEND |
| Universal Agent Birth | sem packages/agent-factory; config/skills/contracts em apps/crm | PARTIAL | CREATE após gate |
| Prompt compiler | apps/crm/lib/ai/render-system-prompt.ts | PARTIAL | EXTEND |
| Skill registry | apps/crm/lib/ai/skills e agent/skills.ts | PARTIAL | EXTEND |
| Tool registry/runtime | apps/crm/lib/agent-engine/tools/registry.ts:1-22 e gateway.ts | EXISTS | REUSE/EXTEND |
| Session-aware runtime | apps/crm/lib/agent-engine/context, execution, runtime | PARTIAL | EXTEND |
| Model router | agent/router-config.ts:1-12; lib/ai/gateway.ts | PARTIAL | EXTEND |
| Handoff engine | lib/ai/handoff; agent/human-handoff.ts; workers/ai-handoff-from-sentiment.handler.ts | EXISTS | REUSE |
| Memory/Hermes | agent-engine/memory, customer-memory, ai/rag; Mem0/Graphiti ports | PARTIAL | EXTEND |
| MCP + CLI | apps/crm/lib/mcp existe; CLI lumenva não identificada | PARTIAL | EXTEND; não criar CLI aqui |
| BrowserMesh | human-browser/docs; runtimes/browsermesh não existe | PARTIAL | CREATE/EXTEND em Wave 4 |
| Shift OS/resource router | package dedicado não identificado | MISSING | CREATE em Wave 4 |
| Command Center | superfícies apps/crm existem parcialmente | PARTIAL | EXTEND em Wave 5 |
| Studio/Factory/Delivery | docs/PRDs descrevem intenção; packages dedicados ausentes | MISSING | CREATE Waves 6–10 |
| Integrations OS | lib/nuvemshop, channels, waha, mcp/tools | PARTIAL | REUSE/EXTEND isolado |
| Governance/audit/incidents/cost | lib/audit, policies, migration 0021 e docs | PARTIAL | EXTEND por contrato |
| CI/verification | scripts/workflows versionados; Actions inativo (docs/harness-audit.md:20-29) | PARTIAL | REUSE local; não alegar CI live |
| Official provider intake | blueprint PHASE 0:613-621; cópias oficiais ausentes | UNKNOWN | DOCUMENT antes de provider |

A leitura de convergência é deliberadamente conservadora: a base CRM/Agent OS existe dentro de apps/crm, mas os packages e waves do blueprint são target. Aplicar DIRC e a ordem Phase 0 → Wave 1 → Wave 2 → Wave 3; esta auditoria não cria scaffolding estrutural.
