# IMPROVE-5 — BUSINESS OPS + GOVERNANCE + SEQUENCING (IMPLEMENTÁVEL)

## 0. Escopo, convenções e esforço

Este documento concretiza as secções 4.1, 5, 6.4, 10, 12, 17, 18, 19, 21, 24, 25 e 27 do master blueprint. Não introduz produto fora delas. Cada item é uma task com owner, dependências, DoD e estimativa em engineer-days (ED). Um ED é um dia de trabalho de um engenheiro, sem paralelismo presumido.

## 1. CRM control plane: rotas reais

| Área | Rota | Dono funcional | Ações e prova |
|---|---|---|---|
| Command Center | `/command` | Claude Orchestrator | overview, chat read-first, atividade; trace/run/evidence |
| Jobs | `/command/jobs` | Job Engine | queue, claim, retry, blocked, cancel; state transition audit |
| Sessions | `/command/sessions` | Session Agent | estado, epoch, context hash, handoff pack; snapshot/event log |
| Agents | `/command/agents` | Agent Architect | versões candidate/approved/published; eval gate |
| Workforce | `/command/workforce` | Workforce Agent | capacidade, leases, shifts, backpressure |
| Approvals | `/command/approvals` | Governance Agent | requests R2–R4, scope, expiry, decision, evidence |
| Incidents | `/command/incidents` | Incident Agent | severity, owner, timeline, mitigation, postmortem |
| Costs | `/command/costs` | Finance Agent | token/euro budgets, quota, forecast, anomaly |
| Infrastructure | `/command/infrastructure` | DevOps Agent | hosts, health, RAM, worker leases, deploy state |
| Dev | `/command/dev` | Release Agent | branches, checks, migrations, release/rollback |
| Workflows | `/command/workflows` | Automation Agent | trigger → steps → policy → evidence |
| Clients | `/clients` | Account Agent | tenant-safe contact 360, notes, consent, lifecycle |
| Conversations | `/conversations` | Conversation Agent | channels, intent, handoff, transcript, consent |
| Leads | `/leads` | Sales Agent | capture, qualify, assign, stage, next action |
| Sales | `/sales` | Sales Agent | opportunity, quote, proposal, win/loss, revenue |
| Studio projects | `/studio/projects` | Studio Architect | briefing, ProjectSpec, variants, feedback |
| Studio editor | `/studio/projects/[projectId]/editor` | UI Agent | semantic patches, preview, undo/redo |
| Client portal | `/p/[opaqueToken]` | Client Portal Agent | preview, approve, comment, request changes |
| Deployments | `/studio/deployments` | Release Agent | build, preview, deploy, health, rollback |
| Marketing | `/marketing` | Marketing Agent | campaigns, assets, calendar, approval |
| Support | `/support` | Support Agent | ticket, triage, SLA, resolution, escalation |
| Automation | `/automation` | Automation Agent | workflows, schedules, failed runs |
| Email/Social/Agenda | `/email`, `/social`, `/agenda` | Integration Agent | OAuth-scoped actions, idempotency, audit |
| Documents/Memory/Reports | `/documents`, `/memory`, `/reports` | Memory/Reporting Agent | provenance, retrieval, metrics, exports |

## 2. Os 22 agentes de produção

Cada registo usa `AgentDefinition`, versão imutável, `behavior_contract`, `authority_policy`, `autonomy_policy`, `tool_policy`, `skill_policy`, `memory_policy`, `context_policy`, `handoff_policy`, `verification_policy`, `completion_policy`, `guardrails`, `model_policy`, `source_provenance` e golden evals. Nenhum agente pode ganhar autoridade por memória ou handoff.

| # | agent_id / role | ferramentas principais | escalonamento |
|---:|---|---|---|
| 1 | `claude-orchestrator` / CEO | planner, job, evidence, handoff | CTO/dono |
| 2 | `agent-architect` | docs intake, registry, compiler, evals | Governance |
| 3 | `sales-agent` | lead, contact, calendar, proposal | human sales |
| 4 | `support-agent` | ticket, knowledge, customer, email | human support |
| 5 | `conversation-agent` | channel receive/send, intent, handoff | policy/human |
| 6 | `account-agent` | contact 360, consent, organization | privacy officer |
| 7 | `marketing-agent` | campaign, asset, schedule, social draft | approval engine |
| 8 | `automation-agent` | workflow CRUD, trigger, job | CTO |
| 9 | `studio-architect` | ProjectSpec, templates, briefing | product owner |
| 10 | `frontend-product-agent` | UI patch, canvas, preview | studio architect |
| 11 | `backend-agent` | API, schema, worker, migrations | CTO/release |
| 12 | `ai-runtime-agent` | sessions, context, model, tool loop | CTO |
| 13 | `memory-hermes-agent` | memory gate, provenance, retrieval | governance; no auto-promotion |
| 14 | `integration-agent` | OAuth, webhooks, provider adapters | security/integration owner |
| 15 | `voice-realtime-agent` | STT, TTS, WebRTC/SIP | security + human |
| 16 | `browsermesh-agent` | process, sandbox, browser, evidence | infra |
| 17 | `workforce-agent` | shifts, capacity, resource router | CTO |
| 18 | `devops-agent` | hosts, deploy, rollback, monitoring | release/dono |
| 19 | `security-governance-agent` | RLS, RBAC, secrets, injection | security owner |
| 20 | `qa-verification-agent` | unit/integration/E2E/evals | CTO |
| 21 | `release-manager-agent` | branch, migration, release gates | dono para produção |
| 22 | `finance-ops-agent` | quota, costs, invoices, budget | dono financeiro |

### AgentDefinition registry seed (22 entradas)

```ts
export const productionAgentDefinitions = [
  ["claude-orchestrator","principal"],["agent-architect","architect"],["sales-agent","sales"],
  ["support-agent","support"],["conversation-agent","conversation"],["account-agent","account"],
  ["marketing-agent","marketing"],["automation-agent","automation"],["studio-architect","studio"],
  ["frontend-product-agent","frontend"],["backend-agent","backend"],["ai-runtime-agent","runtime"],
  ["memory-hermes-agent","memory"],["integration-agent","integrations"],["voice-realtime-agent","voice"],
  ["browsermesh-agent","browsermesh"],["workforce-agent","workforce"],["devops-agent","devops"],
  ["security-governance-agent","security"],["qa-verification-agent","qa"],["release-manager-agent","release"],
  ["finance-ops-agent","finance"],
].map(([agent_id, role]) => ({ agent_id, version: 1, role, mission: `${role} production responsibility`,
  behavior_contract: `${role}-v1`, authority_policy: "bounded", autonomy_policy: "bounded",
  verification_policy: "evidence-required", guardrails: ["tenant", "budget", "injection"] }));
```

## 3. AgentDefinition seed (TypeScript)

```ts
export const productionAgent: AgentDefinition = {
  agent_id: "sales-agent", version: 1, name: "Sales Agent", role: "sales",
  mission: "Qualify leads and advance CRM opportunities with evidence",
  domain: "crm.sales", identity: {language: "pt-PT", tone: "professional"},
  responsibilities: ["lead qualification", "next action", "proposal draft"],
  non_responsibilities: ["send without approval", "change tenant policy", "deploy"],
  behavior_contract: "sales-v1", authority_policy: "sales-r1", autonomy_policy: "assisted",
  risk_profile: "R2", tool_policy: ["lead.read", "lead.update", "calendar.availability"],
  skill_policy: ["crm-sales", "communication"], memory_policy: "customer-scoped",
  context_policy: "sales-context-v1", handoff_policy: "standard", verification_policy: "crm-write",
  completion_policy: "evidence-required", guardrails: ["tenant", "consent", "injection"],
  model_policy: {default: "session-locked"}, source_provenance: ["docs/business-rules/sales.md"]
};
```

## 4. Integration schema

```sql
create table integrations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references organizations(id),
  provider text not null check (provider in ('google','meta','github','supabase','vercel','cloudflare','payments','whatsapp','email','voice')),
  kind text not null, status text not null check (status in ('pending','active','paused','revoked','error')),
  external_account_id text, scopes text[] not null default '{}', config jsonb not null default '{}',
  credential_ref text not null, last_health_at timestamptz, version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, provider, kind, external_account_id)
);
create table integration_events (
  id uuid primary key default gen_random_uuid(), integration_id uuid not null references integrations(id),
  organization_id uuid not null references organizations(id), event_type text not null,
  idempotency_key text not null, payload_hash text not null, status text not null,
  external_event_id text, received_at timestamptz not null default now(), processed_at timestamptz,
  unique (integration_id, idempotency_key)
);
```

Provider secrets are references only, never values. Every webhook verifies signature, organization binding, replay window and idempotency before mutation.

## 5. RLS templates

```sql
alter table integrations enable row level security;
create policy integrations_tenant_select on integrations for select
  using (organization_id = app.current_organization_id());
create policy integrations_tenant_write on integrations for insert
  with check (organization_id = app.current_organization_id() and app.has_permission('integrations:write'));
create policy integrations_tenant_update on integrations for update
  using (organization_id = app.current_organization_id() and app.has_permission('integrations:write'))
  with check (organization_id = app.current_organization_id());
alter table integration_events enable row level security;
create policy integration_events_tenant on integration_events for select
  using (organization_id = app.current_organization_id());
```

Aplicar o mesmo padrão a leads, contacts, conversations, sessions, jobs, memory, projects, approvals e evidence. `organization_id` vem do contexto autenticado; nunca do request body. Teste obrigatório: user de A não lê/escreve qualquer linha de B.

## 6. RBAC e risco

Roles: `owner`, `admin`, `operator`, `developer`, `reviewer`, `agent`, `viewer`, `client`. Permissions mínimas: `crm:read`, `crm:write`, `agent:run`, `agent:publish`, `integration:manage`, `deployment:run`, `approval:decide`, `cost:read`, `incident:manage`, `studio:approve`. Matriz: agent recebe read e writes reversíveis; operator pode executar R1/R2; admin aprova R2/R3; owner aprova R4, produção, financeiro, credenciais e eliminação. UI nunca substitui policy server-side.

## 7. Governance state machines

- Agent: `DRAFT → INTAKE → DEFINED → COMPILED → EVAL → SHADOW → APPROVAL → PUBLISHED → DEPRECATED`; falha regressa a `DRAFT`, versão estável permanece ativa.
- Integration: `PENDING → ACTIVE → PAUSED → REVOKED`; erro não apaga configuração nem repete side effect.
- Approval: `REQUESTED → APPROVED|REJECTED|EXPIRED`; scope, actor, expiry e evidence obrigatórios.
- Incident: `OPEN → ACKNOWLEDGED → MITIGATING → RESOLVED → REVIEWED`; cada transição auditada.
- Project delivery: `BRIEFED → SPECIFIED → PROPOSED → CLIENT_REVIEW → APPROVED → BUILDING → QA → PREVIEW → DEPLOYED → MAINTENANCE`.

## 8. Business function → owner → escalation

| Função | Agente dono | Escalona quando |
|---|---|---|
| Lead capture/qualification | Sales | missing consent, low confidence, pricing |
| Opportunity/proposal | Sales | discount, commitment, contract |
| Contact 360/consent | Account | LGPD request, conflict, deletion |
| Conversation triage | Conversation | ambiguity, sentiment risk, channel failure |
| Support/SLA | Support | SLA breach, security, refund |
| Campaign draft | Marketing | publish, spend, brand exception |
| Workflow automation | Automation | destructive action, failed retry |
| Briefing/ProjectSpec | Studio Architect | missing requirement, scope change |
| UI implementation | Frontend Product | visual ambiguity, unsupported component |
| API/schema | Backend | migration, data loss, cross-tenant risk |
| Model/session/memory | AI Runtime + Memory | handoff loss, injection, budget |
| Integrations/OAuth | Integration | credential, provider outage, scope |
| Voice/realtime | Voice | consent, carrier, emergency call |
| Browser/CLI execution | BrowserMesh | sandbox escape, timeout, side effect |
| Capacity/queues | Workforce | quota, RAM, starvation |
| Deploy/rollback | DevOps + Release | production, migration, health failure |
| Security/RLS/RBAC | Security Governance | any tenant leak or R4 |
| QA/evals | QA | failed gate or regression |
| Cost/invoice | Finance Ops | budget breach, payment |
| Incident/postmortem | Incident owner | unresolved severity or recurrence |

## 9. Phase 0 → Wave 15

| Fase | Entrega concreta | ED | Dependências | DoD |
|---|---|---:|---|---|
| Phase 0 | audit, docs intake, capability/gap/risk/dependency maps | 8 | nenhuma | artefactos classificados; sem módulo estrutural antes do gate |
| Wave 1 | Job/Event/Evidence/Policy/Approval + core contracts | 20 | P0 | job lifecycle e AgentDefinition versionado passam testes |
| Wave 2 | Agent Factory, compiler, skills/tools, certification | 24 | W1 | agente nasce só via Factory; hash reprodutível |
| Wave 3 | Session runtime, context, memory, model lock/handoff | 30 | W1–W2 | Gemini→tool→429→Groq continuidade mensurada |
| Wave 4 | BrowserMesh + adapters + Shift OS | 24 | W1, W3 | CRM job→Linux→evidence→complete |
| Wave 5 | Command Center routes e read-first chat | 18 | W1–W4 | rotas protegidas, auditadas e tenant-safe |
| Wave 6 | Studio commercial MVP + portal | 28 | W1, W2, W5 | lead→briefing→A/B/C→portal→approve atualiza CRM |
| Wave 7 | Studio editor/canvas/spec patches | 30 | W6 | patch schema, undo/redo, responsive preview |
| Wave 8 | asset intelligence/reverse design | 30 | W7 | LayerManifest/provenance/visual diff |
| Wave 9 | Product Factory web + repair | 32 | W2, W6–W8 | approved spec→repo→tests→preview |
| Wave 10 | mobile + production delivery | 28 | W9, W4 | release/health/rollback comprovados |
| Wave 11 | unified integrations | 30 | W1, W2, W5 | OAuth/webhooks/idempotency/RLS por provider |
| Wave 12 | governance/security hardening | 24 | W1–W11 | RBAC/RLS/injection/secrets/fault tests |
| Wave 13 | observability/reliability/quotas | 22 | W3–W12 | traces, cost, drain, breaker, incident path |
| Wave 14 | business ops/reporting/maintenance | 20 | W5–W13 | KPI, SLA, revenue/cost reports e runbooks |
| Wave 15 | integrated production acceptance | 24 | todas | golden journeys, security, deploy, rollback, owner sign-off |

Paralelos autorizados: Phase 0 é sequencial; W1→W2→W3 são dependentes; W5 pode decorrer em paralelo com W4; W6 depende do core; W7/W8 sequenciais; W9 pode preparar-se após W6; W11 pode dividir providers isolados após W2; W12–W15 são gates. Cada task mantém worktree própria e máximo de dois ciclos review→fix.

## 10. Métricas e release gates

Gate de cada wave: testes relevantes, lint/typecheck, schema/RLS, evidence bundle, risco, custos e rollback. Métricas mínimas: tenant leakage=0; unsafe handoff=0; duplicate side effect=0; session loss=0; handoff continuity ≥95%; identity consistency ≥95%; structured output ≥99%; cost/quota dentro do envelope. Falha mantém estado `BLOCKED`/`FAILED`; não há promoção automática.

## 11. Verificação final

Cada módulo é classificado `EXISTS/PARTIAL/MISSING/OBSOLETE/UNKNOWN` e `REUSE/EXTEND/REFACTOR/CREATE/DEPRECATE`. A entrega só é `COMPLETE` com completion conditions verificadas e evidence item (`claim`, `source`, `tool_call`, `artifact`, `verification`, `timestamp`, `result`, `trace_id`). Documentação, intenção, HTTP 200 ou processo iniciado não fecham gate.
