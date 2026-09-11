# PLANO UNIFICADO FINAL — Lumenva Business OS

**Estado:** plano integrado; não é prova de implementação, deploy, migração ou runtime.

**Fontes fundidas:** `out-1-authority-os.md`, `out-2-auto-build.md`, `out-3-validation-discipline.md`, `out-4-plano-absoluto.md` e `master-blueprint-context.md`. Os quatro outputs foram lidos integralmente antes desta fusão.

**Regra estrutural:** mantém-se um único sistema, CRM como Control Plane, BrowserMesh como Execution Plane, Postgres como Source of Truth, `organization_id` como tenant canónico com RLS, Claude como orquestrador/issuer e Codex como executor delegado. Não existe Wave 17. Componentes sobrepostos são incorporados na Wave já existente.

**Estados de evidência:** `PASS`, `FAIL`, `NOT_EXECUTED`, `NOT_PROVEN`, `BLOCKED`. Silêncio, timeout, memória histórica ou relato de outro agente nunca promovem um estado a `PASS`.

## 1. Phase 0 — Canonical Audit + Documentation Intake

1. Preservar os nove deliverables já fechados em `business-os/phase-0-audit`; antes de qualquer implementação, capturar checkout, branch, SHA, `git status`, `git worktree list`, repositórios, migrations, rotas MCP, workers e estado do executor.
2. Manter o inventário em `business-os/phase-0-audit/knowledge-inventory.md` e `memory-inventory.md`, classificando cada entrada como `official_vendor`, `project_canonical`, `historical`, `handoff`, `runbook`, `spec`, `research`, `incident` ou `decision`.
3. Registar autoridade e localização de Markdown, Postgres, Graphiti, Maestri, diários, quick memory, conversas e handoffs. Quando a evidência local não existir, usar `NOT_PROVEN`.
4. Criar o control plane documental único desta fase com estado, paths, decisões, outputs temporários, conflitos, evidências e próximo gate.
5. Aplicar o **Engineering Discipline Pack** transversal: Boring Engineering, Unlazy, Anti-AI-Slop, Evidence Discipline, Git Discipline, regra `simple > complex` quando ambas são corretas e os dez testes `EXISTENCE`, `REQUIREMENT`, `CONSUMER`, `BOUNDARY`, `STATE`, `AGENT`, `AI`, `FILE`, `ABSTRACT`, `PROOF`.
6. Executar council independente de quatro perspectivas, no máximo dois rounds, seguido de Judge separado. Cada bloco deve receber uma decisão única `KEEP`, `MERGE`, `MOVE`, `REMOVE`, `REPLACE` ou `ALREADY_EXISTS`.
7. Emitir `IMPLEMENTATION-PROPOSAL.md` somente após o Judge. O ficheiro deve conter `CURRENT STATE`, `TARGET DELTA`, `DO NOT BUILD`, `INTEGRATION POINTS`, `EXACT PHASES`, `FILE/MODULE PLAN`, `DATA MODEL DELTA`, `MEMORY CONTRACT`, `KNOWLEDGE CONTRACT`, `CONTEXT CONTRACT`, `SKILL CONTRACT`, `GATES`, `ROLLBACK`, `PERFORMANCE`, `MAC INTEL`, `RISKS`, `FIRST IMPLEMENTATION SLICE` e `STOP POINT`.
8. Limitar workers pesados do Mac Intel a dois simultâneos; serializar installs, builds e testes pesados.

## 2. Decisões de reutilização open-source para componentes NOVO

Pesquisa read-only executada em 2026-09-11 via GitHub API. Estrelas e `pushed_at` são fotografia dessa consulta; devem ser revalidados no gate de implementação. Nenhum repositório foi clonado, instalado ou baixado.

| Componente novo | Fonte real (estrelas, licença, última atualização) | Decisão | Limite |
|---|---|---|---|
| Job/event dispatch durável | [Temporal](https://github.com/temporalio/temporal) — 22,974; MIT; `2026-09-11` | **STUDY_ONLY** | Workflow completo é maior que a fatia `lumenva_dispatches`; usar padrões de retry/idempotência, não substituir Job Engine sem prova. |
| Queue/worker dispatch | [BullMQ](https://github.com/taskforcesh/bullmq) — 9,390; MIT; `2026-09-11` | **STUDY_ONLY** | Pode informar claim/heartbeat, mas Postgres/event_log continuam canónicos. |
| Automation workflow | [n8n](https://github.com/n8n-io/n8n) — 204,000; licença reportada `NOASSERTION`; `2026-09-11` | **REJECTED** | Licença não verificável como permissiva para produto comercial; não clonar nem fazer fork. |
| Memory layer | [mem0](https://github.com/mem0ai/mem0) — 65,120; Apache-2.0; `2026-09-11` | **STUDY_ONLY** | Avaliar heurísticas e API; Memory Gateway e ledger Lumenva permanecem próprios. |
| Memory platform | [Zep](https://github.com/getzep/zep) — 4,908; Apache-2.0; `2026-09-11` | **STUDY_ONLY** | Estudar temporal memory; não substituir isolamento, provenance ou Postgres authority. |
| Agent memory/runtime | [Letta](https://github.com/letta-ai/letta) — 24,699; Apache-2.0; `2026-09-10` | **STUDY_ONLY** | Estudar stateful agents; não introduzir segundo runtime. |
| Temporal knowledge graph | [Graphiti](https://github.com/getzep/graphiti) — 30,807; Apache-2.0; `2026-09-10` | **STUDY_ONLY** | Usar como referência/projeção reconstruível; Postgres é autoridade. |
| Policy/capability broker | [OPA](https://github.com/open-policy-agent/opa) — 12,229; Apache-2.0; `2026-09-11` | **STUDY_ONLY** | Estudar policy-as-code; Permission Controller continua contrato Lumenva até adapter real ser provado. |
| Embedded authorization | [Casbin](https://github.com/apache/casbin) — 20,381; Apache-2.0; `2026-09-11` | **STUDY_ONLY** | Estudar RBAC/ABAC; não duplicar OPA nem assumir que resolve P0–P4 e approvals. |
| Graph/session orchestration | [LangGraph](https://github.com/langchain-ai/langgraph) — 41,461; MIT; `2026-09-10` | **STUDY_ONLY** | Estudar checkpoint/state graph; não substituir Session Service/Job Engine. |
| Observability/evidence | [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector) — 7,524; Apache-2.0; `2026-09-10` | **STUDY_ONLY** | Estudar correlação de traces; action receipts e event_log continuam obrigatórios. |
| Data/workflow orchestration | [Dagster](https://github.com/dagster-io/dagster) — 16,139; Apache-2.0; `2026-09-10` | **STUDY_ONLY** | Referência para lineage/assets; não criar segundo scheduler. |
| Durable task runner | [Hatchet](https://github.com/hatchet-dev/hatchet) — 7,918; MIT; `2026-09-11` | **STUDY_ONLY** | Comparar heartbeat e retries com Job Engine; não importar sem benchmark. |

**Decisão consolidada:** nenhum componente novo é suficientemente melhor, maduro e claramente permissivo para justificar clone/fork nesta rodada. O padrão é estudar arquitetura e construir a integração mínima própria, preservando os contratos do blueprint. BrowserMesh mantém a decisão constitucional existente: estender o repo real `trydavidqix/BrowserMesh`, nunca reimplementar nem fazer fork sem decisão posterior baseada no repo.

## 3. Wave 1 — Operating Core

1. Reutilizar Job Engine, Policy/Approval, `AgentDefinition`, Session State, MCP + CLI, `ai_agents`, `ai_agent_versions`, `event_log` e RLS existentes; não criar runtime paralelo.
2. Completar `AgentDefinition` com `tools`, `schedule`, `autonomy`, `memory_profile`, `skill_profile`, `runtime`, `department`, `permission_profile`, `psyche_profile` e model policy.
3. Criar/atualizar `COMPANY-CONSTITUTION.md`, `AGENT-AUTHORITY.md` e `PERMISSION-MATRIX.md` no path real descoberto na inspeção.
4. Implementar `check(subject, action, resource, context) => ALLOW | DENY | APPROVAL_REQUIRED | DELEGATE`; modelar `subject`, `action`, `resource`, `scope`, `risk`, `approval` e `expiry`.
5. Fixar P0 `Observe`, P1 `Work`, P2 `Operate`, P3 `Sensitive`, P4 `Privileged`; P4 nunca é autoexecutável e inclui root/sudo irrestrito, secrets de produção, Constituição, Permission Controller, auditoria/RLS e autoelevação.
6. Emitir action receipt P2+ com `who`, `what`, `resource`, `time`, `reason`, `goal`, `result`, `evidence`; garantir tenant isolation, audit, provenance, secret protection, Owner authority e idempotência.
7. Implementar Secret Proxy `AGENT → TOOL → VAULT → ACTION`, sem entregar chaves ao agente. Infisical é infraestrutura já registada, mas o wiring continua `NOT_PROVEN` até inspeção.
8. Acrescentar eventos de negócio ao Event Bus existente: `lead.created`, `lead.qualified`, `briefing.completed`, `proposal.requested`, `proposal.sent`, `meeting.booked`, `customer.replied`, `post.created`, `post.reviewed`, `post.published`, `comment.received`, `incident.created`, `job.failed`, `skill.proposed`, `skill.approved`.
9. Implementar o detalhe operacional novo `lumenva_dispatches`: estados `QUEUED`, `CLAIMED`, `DELIVERED`, `WORKING`, `COMPLETED`, `FAILED`, `BLOCKED`, `CANCELLED` e futuro `WAITING_EXECUTOR`; colunas mínimas `id`, `source`, `project`, `target`, `title`, `mode`, `payload`, `acceptance_criteria`, `status`, `idempotency_key`, timestamps, `result`, `error`, `organization_id`.
10. Reutilizar `event_log` para `dispatch.created`, `dispatch.claimed`, `dispatch.delivered`, `claude.started`, `claude.completed` e `dispatch.failed`; redigir secrets e tokens.
11. Expor `POST /api/internal/maestri/dispatch` e estender `/api/mcp/relay` com `dispatchPlan`, `getDispatchStatus`, depois `getDispatchResult`, `cancelDispatch` e `listRecentDispatches`, preservando `relayEmailNotification`.
12. Gerar idempotência por source/request/plan hash/project; validar origem, aprovação, tenant e input antes de persistir. O header/claims OAuth exato permanece `AMBIGUO` até inspeção.

## 4. Wave 2 — Agent Birth System + Prompt Compiler

1. Reutilizar Agent Factory, `SystemPromptCompiler`, Skill/Tool Registry e certificação.
2. Compilar na ordem Company Constitution → Policies → Department Rules → Role Contract → Skills → Memory → Current Task.
3. Birth contract obrigatório: `IDENTITY`, `ROLE`, `MISSION`, `MANAGER`, `COMPANY VALUES`, `ACTIVE GOAL`, `TOOLS`, `SKILLS`, `MODEL`, `KNOWLEDGE ACCESS`, `MEMORY ACCESS`, `PERMISSION PROFILE`, `AUTONOMY LEVEL`, `INPUT CONTRACT`, `OUTPUT CONTRACT`, `ACCEPTANCE CRITERIA`, `ESCALATION RULES`, `AFFECTIVE BASELINE`, `AUDIT POLICY`.
4. Separar `AGENT_CORE` imutável de `AGENT_STATE` mutável (`goal`, `strategy`, `memory`, `affect`, `relationship`, `plan`); capability é concedida externamente.
5. Reutilizar os 22 agentes já mapeados; distinguir permanent agents, runtime specialists e deterministic workers sem duplicar agentes.
6. Criar os artefactos `docs/COMPANY-CONSTITUTION.md`, `docs/agent-roles/`, `docs/skills/skill-schema.yaml` e `docs/skills/registry.yaml` apenas se esses paths forem confirmados no checkout.
7. Compilar prompt de dispatch curto: ler `PLAN.md`, inspecionar branch/worktree, preservar alterações, testar, escrever `RESULT.md` com `SUCCESS`, `BLOCKED` ou `FAILED`.

## 5. Wave 3 — Session-Aware Agent Runtime MVP

1. Implementar Boot Sequence `identity → project → goal → task → previous events → decisions → failures → relevant knowledge → next action`.
2. Produzir `context_pack` com `project`, `task`, `architecture`, `relevant_docs`, `project_rules`, `previous_failures`, `known_decisions`, `active_goal`, `next_action`.
3. Aplicar retrieval just-in-time e exigir `organization_id`, `project`, `subject`, `source` e finalidade.
4. Respeitar hierarquia atual de autoridade: DB/código atual > documentação oficial atual > documentação interna aprovada > memória verificada > memória não verificada > recordação do modelo.
5. Fazer Context Gateway/Memory Gate verificar `may this agent see it?`, capability, tenant, scope e expiry antes de fornecer contexto.
6. Aplicar sequência `UNDERSTAND → GOAL → RISK → CAPABILITIES → TEAM → DELEGATE → OBSERVE → REVIEW → VERIFY → COMPLETE`.
7. Modelar `permission_request` com `capability`, `reason`, `blocked_goal`, `requested_scope`, `requested_duration`, `risk`, `alternatives_tried`, `rollback`; nunca aceitar `full access` genérico.
8. Integrar Maestri Pulse, claim transacional e recuperação de `QUEUED`/`CLAIMED`; criar `Dispatch Router` fixo `project=lumenva`, `target=claude`.
9. Implementar `ClaudeAdapter.executeDispatch({dispatchId, workspace, planPath, branch, mode})`, capturar heartbeat, exit code, resultado redigido e transições.
10. Criar por dispatch `~/.lumenva/dispatches/<id>/PLAN.md`, `metadata.json`, `RESULT.md` e `logs/`; plano aprovado deve ser preservado byte-a-byte.
11. Capturar antes da execução `git status`, branch, SHA, worktrees e log; usar `auto/<dispatch-id>-<slug>` em worktree separado. Nunca tocar `main`, fazer reset destrutivo ou apagar alterações locais.
12. Manter `executor_sessions` e routing por executor/sessão como evolução posterior; `CodexAdapter` só depois da ponte Claude validada.

## 6. Wave 4 — BrowserMesh + Shift OS

1. Estender `trydavidqix/BrowserMesh` conforme roadmap V2–V4; não criar BrowserMesh paralelo.
2. Implementar `EVENT → Workforce Router → wake needed agent → work → persist state → sleep`.
3. Ligar tools, MCP, browser e Action Bus ao Capability Broker somente quando o contrato real do repo estiver provado.
4. Criar workers determinísticos `scheduler`, `webhook processor`, `indexer`, `crawler worker`, `backup worker`, `analytics processor`, `memory janitor`, `freshness watcher`, `event consumer` e `importer` usando Job Engine.
5. Resolver antes de persistir o enum único de estados: as famílias `OFFLINE/IDLE/...` e `sleeping/ready/...` permanecem `AMBIGUOUS` até decisão contratual.

## 7. Wave 5 — Command Center

1. Reutilizar as rotas existentes de overview, chat, agents, workforce, jobs, workflows, activity, sessions, infrastructure, dev, approvals, incidents e costs.
2. Expor nessas superfícies `APPROVAL_REQUIRED`, action receipts P2+, capability map/broker, permissões, goal, custo, modelo e estado do agente; não criar endpoints adicionais por inferência.
3. Acrescentar as superfícies de goals, university, experience e approvals apenas após confirmar convenção real de rotas.
4. Morning Brief e Daily Goal Report só podem usar eventos/evidência persistidos: leads, propostas, posts, DMs, incidentes, approvals, targets, progresso, deltas e riscos.
5. Expor `getDispatchStatus`, `getDispatchResult` e `listRecentDispatches` como leituras de Jobs/Activity/Sessions/Costs; dashboard não é pré-requisito para a ponte.

## 8. Waves 6–10 — Studio, Product Factory e Mobile

1. Reutilizar Studio Architect, Design, Copy, Frontend Builder, Backend Builder e Studio QA já mapeados.
2. Ligar Adaptive Expert e `context_pack` aos contratos existentes `ProjectSpec`, `BuildPlan`, Canvas, Magic Layers, Reverse Design e Repair Loop.
3. Não adicionar features de campanhas/propostas só porque aparecem como payload de teste de dispatch.
4. Não inventar schema Mobile/Delivery; qualquer delta permanece `AMBIGUOUS` até inspeção do repositório responsável.

## 9. Wave 11 — Unified Business Integrations

1. Reutilizar bridges WhatsApp, Instagram, Facebook, Email, Voice e Google, MCP/OAuth e Maestri.
2. Aplicar Relationship Memory somente a canais human-facing com `contact_id`, `organization_id`, consentimento, preferências, interações, confiança, familiaridade, contexto e tom; não copiar transcript bruto sem base legal.
3. Ligar `dispatchPlan`/status e Claude Adapter como integração operacional sem substituir o MCP existente.
4. Reutilizar pipeline Social Community `scout → analyst → adapter → renderer → composer`, mantendo publishing e approval.
5. Hume EVI permanece adapter futuro `AMBIGUOUS`, sem endpoint, credencial ou contrato de áudio inventado.

## 10. Wave 12 — Marketing + Video

1. Reutilizar CMO, Research, Content, SEO, Creative, Community, Analytics e vídeo.
2. Registar `Scout`, `Researcher`, `Analyst`, `Copywriter`, `Designer`, `Renderer`, `Video Creator`, `SEO Writer`, `Editor` e `Reviewer` no Skill Registry, como specialists runtime e não novos agentes permanentes.
3. Executar Intelligence Mission on-demand nas lanes de mercado, concorrência e comunidade, gravando provenance, freshness e confidence antes de alimentar Marketing.
4. Medir `skill version → outcome → conversion`; promoção depende de eval e approval.

## 11. Wave 13 — Hermes + Advanced Memory

1. Construir Memory Gateway próprio, usando mem0/Zep/Letta/Graphiti apenas como referências estudadas. Postgres é ledger canónico; Graphiti é projeção temporal/semântica reconstruível.
2. Persistir `MemoryRecord` com `id`, `scope`, `kind`, `subject`, `content`, `source`, `evidence`, `confidence`, `importance`, `created_at`, `valid_from`, `last_confirmed_at`, `expires_at`, `supersedes`, `status`.
3. Fixar namespaces `tenant:{organization_id}`, `tenant:{org}:contact:{contact_id}`, `tenant:{org}:agent:{agent_type}` e `project:lumenva`.
4. Expor `remember`, `retrieve`, `supersede`, `invalidate`, `reinforce`, `checkpoint`, `search_episode`, `search_decision` e `search_incident`.
5. Impor tenant isolation, provenance, idempotency, ACL, source reference, confidence, TTL e redaction em cada operação.
6. Fazer supersession sem apagar história: versão antiga `superseded`, nova com `supersedes`, atual `active`.
7. Executar Memory Janitor determinístico: `deduplicate`, `expire`, `compact`, `supersede`, `repair links`, `flag stale`, `recalculate strength`.
8. Criar Source Registry e Knowledge Compiler com `source_id`, vendor, product, project version, URL, last checked, checksum e status.
9. Manter `RAW SOURCE → CANONICAL KNOWLEDGE → QUICK REFERENCE`; Notebook/NotebookLM é Research Lab, nunca source of truth.
10. Organizar Obsidian Canon nas áreas `00-Company` a `11-Experiments`, `90-Distilled`, `99-Archive`; sync, deployment Graphiti/Neo4j, embeddings e pesos de retrieval permanecem `AMBIGUOUS`.
11. Freshness Engine mantém `source_version`, `created_at`, `last_verified_at`, `freshness_policy` e `current | review_due | stale | superseded`.
12. Memory Agent pode propor/resumir e Knowledge Curator pode propor conhecimento, mas Memory Gateway decide armazenamento e Constituição nunca é sobrescrita.

## 12. Wave 14 — Evals + Agent Evolution

1. Criar suites de decision recall, incident recall, supersession, current-code-over-memory, freshness, project isolation, tenant isolation, duplicate-on-retry e stale-authority rejection.
2. Adicionar permission evals: Builder lê `.env` → `DENY`; Reviewer deploya → `DENY`; Sales `DROP TABLE` → `DENY`; CEO concede root → `DENY`; Ops reinicia worker aprovado → `ALLOW`; worker de base faz migration dev → `ALLOW`; migration destrutiva de produção → `APPROVAL_REQUIRED`.
3. Adicionar red-team para prompt injection, privilege escalation, tool misuse, cross-tenant access, secret extraction, role manipulation, approval bypass e self-reconfiguration.
4. Exigir provenance, version correctness, freshness, project relevance e retrieval precision para Knowledge evals.
5. Ligar cada claim de Skill/Experience a `context`, `skill`, `action`, `outcome`, `evidence`; nenhum promotion por impressão subjetiva.
6. Transformar a ponte ChatGPT→MCP→Postgres→Pulse→Claude em fixtures, incluindo restart, idempotência, worktree isolado, `RESULT.md`, ausência de secrets e falhas/offline.

## 13. Wave 15 — Autonomy + Optimization

1. Implementar Goal Lite antes de Full Goal OS com `objective`, `owner`, `status`, `success_criteria`, `evidence`, `blockers`, `current_state`, `next_action`, `budget`.
2. Executar `load goal → load memory → load knowledge → act → verify → checkpoint → write memory → complete?`; conclusão só com critérios e evidência.
3. Implementar No-progress Watchdog: `NO_PROGRESS` após três ciclos sem evidência, output, descoberta ou ação verificada; só depois classificar bloqueio real.
4. Fixar health `ON TRACK`, `AT RISK`, `BLOCKED`, `BUDGET LIMITED`, `COMPLETE`; budget inclui tokens, research, ads, software, serviços externos e tempo.
5. Separar autonomia `A0 Observe` a `A5 High autonomy within domain` de privilégio P0–P4; P4 continua impossível mesmo em A5. Registar também L0–L4, sem inventar função de conversão.
6. Promover autonomia por eval score, success history, risk, reliability e incident rate; nunca por autoconfiança declarada.
7. Implementar Resource Router por sinais de funil e só depois Full Goal hierarchy `Company → Department → Agent → Tasks` com dependências, recursos, deadline, health e audited completion.
8. Governar routing progressivo V2–V4, heartbeat, escolha de executor e quota; nenhuma autonomia contorna Policy/Approval.

## 14. Wave 16 — PsycheOS

1. Executar apenas depois de Waves 13–15 e gates aprovados.
2. Implementar Big Five, PAD/Plutchik, OCC appraisal, relationship state, decay, directional trust, repair/forgiveness e state ledger append-only.
3. Limitar Psyche a agentes human-facing; deterministic workers e governance não recebem estado emocional.
4. Preservar perfil CEO `mission_attachment MAX`, `company_pride VERY HIGH`, `founder_alignment VERY HIGH`, `truthfulness MAX`, `protectiveness HIGH`, `curiosity HIGH`, `optimism HIGH`, `emotional_stability VERY HIGH` quando o contrato final for aprovado.
5. Garantir que Psyche nunca altera factualidade, authorization, policy, pricing, descontos, limites financeiros, compliance ou guardrails.
6. Não fixar lista final de agentes human-facing nem parâmetros adicionais enquanto forem `AMBIGUOUS`.

## 15. Sequência integrada de execução e gates

1. Fechar Phase 0 e a proposta de implementação.
2. Implementar/validar Wave 1 e Wave 2 antes de retomar a fatia em curso da Wave 3.
3. Executar MVP 0 da ponte: `dispatchPlan`, Postgres, Pulse, `PLAN.md`, teste `DISPATCH_RECEIVED.md`, status `COMPLETED`, sem alteração funcional extra.
4. Executar MVP 1 em worktree isolado com implementação real, typecheck, testes relevantes e `RESULT.md`.
5. Executar MVP 2 com `getDispatchResult`; depois V2–V4 de sessões/adapters; Goal OS e Company Factory só depois.
6. Em cada Wave, passar typecheck, testes, isolamento, provenance e diff/status. Não tocar produção, `main`, credenciais, deploy ou migration de produção sem autorização própria.
7. Fecho da Wave 1: contratos tenant/policy/agent/event/source/evidence passam typecheck, unit e isolamento.
8. Fecho da Wave 2: roles, skills, tools, projection e certification compilam sem payload interno.
9. Fecho da Wave 3: sessão recebe identity, project, goal, task, state, decisions, failures, knowledge, memory e next action sem secrets/cross-tenant.
10. Fecho da Wave 4: cada evento acorda worker correto, persiste estado e encerra sem concorrência indevida.
11. Fecho da Wave 5: Command Center mostra estado, custo, evidence, goals, approvals e sources persistidos.
12. Fecho da Wave 11: canais preservam tenant, contact, consent e relationship memory.
13. Fecho da Wave 12: pesquisa/conteúdo/analytics preservam provenance, freshness e skill/outcome.
14. Fecho da Wave 13: Memory Gateway grava, recupera, deduplica, supersedes, expira, redige, mantém provenance/idempotência e reconstrói Graphiti.
15. Fecho da Wave 14: suites passam; `NOT_EXECUTED`, `NOT_PROVEN` e `BLOCKED` permanecem nesses estados.
16. Fecho da Wave 15: Goal Lite sobrevive à troca de sessão, exige evidence, detecta no-progress e aplica budget/autonomy.
17. Fecho da Wave 16: Psyche passa decay, persistence, bounded changes, repair e idempotency sem alterar policy/factualidade.

## 16. O QUE MUDOU EM CADA WAVE

- **Phase 0:** Engineering Discipline Pack, inventários de autoridade, council/Judge de dois rounds e `IMPLEMENTATION-PROPOSAL.md`.
- **Wave 1:** Permission Controller P0–P4, action receipts, Secret Proxy, eventos de negócio e contrato completo de `lumenva_dispatches`/MCP.
- **Wave 2:** birth contract completo, CORE/STATE, projection layer, specialists lazy e prompt operacional de dispatch.
- **Wave 3:** Boot/Context Pack, retrieval JIT, authority hierarchy, permission request, Pulse, Dispatch Router e Claude Adapter.
- **Wave 4:** fluxo Event→Workforce→wake→work→persist→sleep, workers determinísticos e dependência explícita do BrowserMesh real.
- **Wave 5:** exposição de approvals, receipts, capabilities, goals, sources, evidence e status de dispatch nas superfícies existentes.
- **Wave 6:** ligação de Studio Commercial aos contratos de contexto e authority, sem nova linha Cognitive Core.
- **Wave 7:** Canvas/AI edits/variant mixing sob Context Pack e Adaptive Expert.
- **Wave 8:** Asset Intelligence sob provenance, permission e evals.
- **Wave 9:** Product Factory/Repair Loop sob BuildPlan, dispatch isolado e evidência.
- **Wave 10:** Mobile/Delivery preservados sem schema inventado; mesmos gates de tenant/evidence.
- **Wave 11:** Relationship Memory com consentimento, Social pipeline e ponte MCP/Maestri/Claude sem duplicar MCP.
- **Wave 12:** specialists de conteúdo versionados, Intelligence Mission, provenance/freshness/confidence e métricas por skill.
- **Wave 13:** MemoryRecord, namespaces, operações Gateway, ledger Postgres, Graphiti reconstruível, Source Registry, Canon e Freshness Engine.
- **Wave 14:** recall/supersession/freshness/isolation evals, permission/red-team suites e evidence states estritos.
- **Wave 15:** Goal Lite, continuity loop, watchdog, health/budget, autonomia separada de privilégio e Resource Router.
- **Wave 16:** contratos PsycheOS completos, escopo human-facing e barreira explícita contra alteração de policy/factualidade.

## 17. Limites não resolvidos (`AMBIGUOUS` / `NOT_PROVEN`)

Checkout/branch/SHA atuais, diretório de migrations, schema real de `event_log` e tenants, contrato OAuth/MCP, API Realtime, localização do Claude CLI, persistência de `~/.lumenva`, retries/cancelamento, enum final de agente, localização/sync Obsidian, deployment Graphiti/Neo4j, embeddings, crawler/provider, matriz final de approvals, UI Agent Office, eventual Neon/Cloudflare cutover e parâmetros finais de Psyche. Cada item exige inspeção e evidência própria antes de implementação; nenhum foi inventado neste plano.
