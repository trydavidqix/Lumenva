# LUMENVA — MASTER BLUEPRINT CANÔNICO V2.1

**Escopo:** Lumenva / CRM / Business OS somente
**Repositório:** `trydavidqix/Lumenva`
**Princípio:** `PRESERVE FIRST → PROVE SECOND → CHANGE LAST`

## 0. Autoridade deste Blueprint

Este é o blueprint arquitetural consolidado da Lumenva.

Ele incorpora:
- planos Lumenva enviados por e-mail entre 23–25/09/2026;
- Master Blueprint Maestri;
- Mega Blueprints V3/V4/V5/V6;
- Lean Blueprint;
- Workforce;
- Loop/Harness;
- Capability OS;
- Tool Gateway;
- Browser;
- Commerce;
- Social;
- Phone/FDE;
- Project Factory;
- Legal/Privacy/Compliance;
- Finance/FinOps/People/Procurement;
- consolidação lossless;
- Comp AI CRM;
- OpenCompany;
- Oryh;
- crmkit;
- mineração de branches/forks do DeskcommCRM.

As referências externas são fontes de padrões, nunca autoridades da arquitetura.

O código real determina o que está implementado. GitHub Actions determina PASS/FAIL técnico.

## 1. Identidade da Lumenva

```text
LUMENVA
=
AI-FIRST AGENTIC COMPANY OS
```

Construído sobre:

```text
BUSINESS SYSTEM OF RECORD
+
MAESTRI CONTROL PLANE
+
DURABLE EXECUTION
+
CAPABILITY OS
+
TOOL GATEWAY
+
CONTEXT ENGINEERING
+
AGENT HARNESS
+
EVIDENCE
+
EVALS
+
OBSERVABILITY
+
POLICY-BOUNDED AUTONOMY
```

## 2. Autoridades canônicas

```text
David = autoridade humana final
CRM / PostgreSQL = verdade operacional de negócio
organization_id = tenant identity
Maestri = control plane da empresa
Claude Code = engineering orchestrator
Codex = CTO Engineering / execução complexa
Gemini / Antigravity = intelligence / Google lane
Jules = executor/reviewer especializado
GitHub Actions = autoridade técnica de PASS/FAIL
BrowserMesh = browser execution plane
```

Nenhum provider pode aumentar a própria autoridade, autoaprovar, desligar gates, reduzir testes, alterar governance ou promover as próprias mudanças.

## 3. Estado Git de referência

Na criação desta versão:

```text
main SHA: 3fbe74a3ff7b7a99538d1e53aa55688294b7ba99
branch v2.1: criada diretamente da main
```

A antiga `implementation/unified` foi restaurada para árvore idêntica à `main`; ela não é source of truth deste plano.

PR #74 `chore/orchestration-gate` permanece separado e não canônico enquanto gates obrigatórios não estiverem verdes.

## 4. Arquitetura global

```text
DAVID / OWNER
        │
        ▼
COMMAND CENTER
        │
        ▼
COMPANY INTELLIGENCE
Mission / Goals / KPIs / Priorities / Planning
        │
        ▼
MAESTRI CONTROL PLANE
        │
        ├── Task Router
        ├── Dependency Manager
        ├── Policy Engine
        ├── Approval Engine
        ├── Risk Router
        ├── Legal Router
        ├── Privacy Router
        ├── Security Router
        ├── Workforce Scheduler
        ├── Resource Router
        ├── Quota Router
        ├── Capability Router
        ├── Context Router
        ├── Provider Router
        ├── Workflow Engine
        ├── Recovery
        └── Learning Loop
                │
                ▼
EXECUTION STRATEGY
Native → Skill → Tool → Durable Workflow → Specialist Agent
                │
                ▼
CAPABILITY OS + TOOL GATEWAY
                │
                ▼
EXECUTION PLANE
Agents / Workers / Browser / Providers
                │
                ▼
BUSINESS DOMAINS
CRM / Inbox / Automation / Campaigns / Cases / Attribution
Commerce / Social / Voice / Finance / Legal / Operations
                │
                ▼
OPERATING CORE
PostgreSQL / event_log / job_queue / evidence / audit
```

## 5. Company Intelligence

```text
Company Mission
→ Annual Goals
→ Quarterly Goals
→ Department Goals
→ Project Goals
→ KPIs
→ Initiatives
→ Projects
→ Epics
→ Jobs
→ Tasks
→ Steps
```

Goal mínimo:

```yaml
goal_id:
owner:
objective:
priority:
constraints:
budget:
deadline:
risk:
success_criteria:
kpis:
status:
```

## 6. Goal Integrity

Todo trabalho recebe um Goal Envelope:

```text
original_goal
authorized_constraints
owner
policies
success_criteria
integrity_metadata
```

Conteúdo externo é DATA, nunca AUTHORITY.

## 7. Maestri Control Plane

Maestri não é um LLM e não é um banco.

Componentes:
- Intent Parser
- Goal Router
- Task Router
- Planning Engine
- Dependency Manager
- Agent Router
- Model Router
- Runtime Router
- Provider Router
- Execution Strategy Router
- Capability Router
- Context Router
- Skill Router
- Plugin Router
- MCP Router
- Tool Router
- Resource Router
- Quota Router
- Node Router
- Risk Router
- Legal Router
- Privacy Router
- Security Router
- Approval Engine
- Policy Engine
- Workforce Scheduler
- Workflow Engine
- Fallback Engine
- Recovery Manager
- Evidence Engine
- Eval Router
- Memory Manager
- Artifact Manager
- Notification Router
- Learning Loop

## 8. Decision Guard antes do modelo

Incorporado das branches DeskcommCRM/Jev, sem criar outro sistema.

```text
REQUEST / EVENT
→ task-level routing
→ source/trust classification
→ manipulation detection
→ deterministic policy
→ risk checks
→ intent/follow-up classification
→ MODEL somente quando necessário
```

## 9. Outer Loop / Inner Loop

### Maestri Outer Loop

```text
GOAL
→ select task
→ select execution strategy
→ select runtime
→ execute
→ verify
→ evaluate
→ update state
→ next DAG node
```

### Agent Inner Loop

```text
TASK
→ THINK
→ ACT
→ OBSERVE
→ VERIFY
├── FAIL → feedback → retry
└── PASS → result
```

Todo loop declara budget, iteration_limit, timeout, verification, checkpoint, stop_condition e escalation.

## 10. Maker–Checker

```text
Maker
→ result
→ independent checker
→ accept / reject
```

- R0/R1 → self verification possível
- R2 → independent verification quando necessário
- R3/R4 → independent verification + human gate

## 11. Fresh Context

```text
iteration
→ work
→ artifact
→ checkpoint
→ close runtime
```

Novo runtime recebe fresh runtime + goal + checkpoint + relevant memory + relevant evidence + minimum skills.

## 12. Context Engineering

Context Pack:
- Agent Identity
- Job
- Goal
- Goal Integrity
- Current State
- Relevant Memory
- Previous Checkpoint
- Relevant Evidence
- Relevant Artifacts
- 2–5 Skills
- Required Tools
- Permissions
- Success Criteria

Regra: `LOAD ONLY WHAT THE JOB NEEDS`.

## 13. Context Lifecycle

Novo requisito vindo de `pr121`.

Suportar:
- context cutoff
- soft reset
- hard reset autorizado
- summarization
- checkpoint
- retention
- TTL
- provenance
- fresh-context re-entry

Context reset nunca apaga CRM facts, Evidence, Audit ou Official Memory.

## 14. Agent Platform

`AGENT != MODEL != RUNTIME`

Agent Identity:
- agent_id
- department
- role
- service_identity
- permissions
- allowed_tools
- allowed_data
- delegation_scope
- spending_scope
- audit_identity
- autonomy_level
- risk_ceiling

Lifecycle:

```text
REGISTER
→ PROVISION
→ TEST
→ CERTIFY
→ ACTIVATE
→ OBSERVE
→ UPDATE
→ SUSPEND
→ REVOKE
→ RETIRE
```

## 15. Agent Certification

```text
Sandbox
→ Capability Tests
→ Tool Tests
→ Permission Tests
→ Prompt Injection Tests
→ Security Tests
→ Policy Tests
→ Evals
→ CERTIFIED
```

## 16. Agent Builder Reliability

Incorporado do Comp CRM.

```text
DRAFT
→ VALIDATE
→ RESOLVE_MISSING
→ COMPILE
→ TEST
→ CERTIFY
→ DEPLOYABLE
```

Persistir builder_state, checkpoint, retry_budget, missing_inputs e validation_errors.

## 17. Workforce Runtime

```text
50+ roles registered
→ 2–5 active workers
→ execute
→ checkpoint
→ sleep
```

Estados: ACTIVE, WORKING, WAITING, BLOCKED, PAUSED, SLEEPING, ERROR, OFFLINE.

## 18. Autonomy Levels

```text
L0 Observe
L1 Recommend
L2 Draft
L3 Execute + Approval
L4 Autonomous within policy
L5 Autonomous Department
```

## 19. Risk Levels

```text
R0 READ
R1 SAFE WRITE
R2 EXTERNAL ACTION
R3 SENSITIVE
R4 CRITICAL
```

Autonomy e Risk são eixos separados.

## 20. Reputation

Medir success_rate, eval_score, hallucination_rate, rollback_rate, incident_rate, cost, latency, human_corrections e domain_performance.

Reputation alimenta routing, nunca permission escalation.

## 21. A2A

- Agent Discovery
- Agent Cards
- Capabilities
- Delegation
- Task Transfer
- Context Transfer
- Artifact Transfer
- Evidence Transfer
- Result Contract

`A2A = Agent ↔ Agent`
`MCP = Agent ↔ Tool/Data`

## 22. Capability OS

Tool Hub separado fica superseded.

Canonical:

```text
Capability OS
+
Tool Gateway
```

Registries semânticos:
- Capability
- Agent
- Provider
- Skill
- Plugin
- MCP
- Tool
- Hook
- Policy
- Trust

Pipeline:

```text
Need
→ Discover
→ Verify
→ Trust
→ Security
→ License
→ Evaluate
→ Register
→ Provision on demand
→ Observe
→ Reuse / Deprecate / Remove
```

## 23. Tool Gateway

```text
Agent
→ capability discovery
→ permission/policy
→ credential broker
→ provider selection
→ execution
→ normalized result
→ evidence
```

Inclui auth, credential broker, rate limiting, timeout, retry, circuit breaker, health, scoring, provider contracts, webhook security e observability.

## 24. Provider-neutral Connection Core

Extraído do Comp CRM.

```text
ProviderConnection
├── provider
├── organization_id
├── scopes
├── connection guard
├── callback validation
├── token lifecycle
├── revocation
└── health
```

Adapters: Google, Meta, Slack, HubSpot, Zoho, QuickBooks, WAHA, Resend, Stripe etc.

## 25. Agent-facing API

Inspirado no crmkit.

API para agentes deve ser:
- plain HTTP first
- curta
- estável
- token-cheap
- IDs estáveis
- JSON on demand
- erros instrutivos
- documentação compacta
- generic MCP bridge quando útil

## 26. Durable Workflow Engine

```text
workflow_id
state
steps
checkpoints
retry
timeout
backoff
compensation
pause
resume
cancel
human_wait
recovery
```

Workflows usam o `job_queue`. Não criar filas por domínio.

## 27. Run-owned Execution Channel

Extraído das branches do Comp CRM.

```text
WorkflowRun
├── execution_channel
├── external_event_inbox
├── event_lease
├── parked_state
├── resume_state
├── action_receipts
└── trace/evidence
```

```text
run
→ espera evento
→ PARKED
→ evento chega
→ encontra owner run
→ resume SAME run
```

## 28. External Event Inbox

Precisa de dedupe, ordering, lease, retry_window, late_event_handling, unowned_event_handling e tenant_scope.

Eventos: WhatsApp, Slack, Email, Browser, Approval, Payment, Webhook etc.

## 29. ActionReceipt

Extraído do Comp CRM.

```text
ActionReceipt
├── action_type
├── provider
├── organization_id
├── actor
├── run_id
├── external_id
├── normalized_result
├── idempotency_key
├── evidence_ref
└── timestamps
```

## 30. Retry Semantics

Incorporado do OpenCompany/Temporal.

Non-retryable:
- validation
- bad user input
- policy denied
- credential invalid
- configuration invalid

Retryable:
- timeout
- connection failure
- 429
- 5xx
- transient provider error

Ações mutáveis exigem idempotency, bounded retry e compensation.

## 31. Compensation / Undo

Toda ação mutável relevante declara:
- reversible?
- rollback?
- compensation?

## 32. Operating Core

PostgreSQL permanece business truth.

```text
organization_id
RLS
event_log
job_queue
approvals
evidence
audit
```

Invariantes:
- PRODUCT FACT != MODEL CONTEXT
- EVENT FACT != EXECUTION JOB

## 33. Bounded Leasing Audit

Testar se `claim(limit=N)` pode afetar mais que `N` registros sob concorrência/planner variance. Só alterar SQL se a falha for reproduzida.

## 34. Memory Platform

Namespaces: Company, Project, Customer, Agent, Decision, Incident, Skill, Evidence.

## 35. Memory Firewall

```text
Candidate
→ Source Trust
→ Provenance
→ Validation
→ Deduplication
→ Conflict Detection
→ Poison Detection
→ Sensitivity
→ TTL
→ Promotion
```

Lumenva Brain fica superseded como cérebro independente.

## 36. Evidence Platform

Distinguir:
- SOURCE FACT
- MODEL INFERENCE
- BUSINESS DECISION
- TOOL RESULT
- HUMAN DECISION

Cada claim relevante precisa de provenance.

## 37. Artifact Registry

Tipos: Documents, Code, Reports, Images, Videos, Contracts, Research, Presentations, Datasets, Builds.

Metadata:
- artifact_id
- version
- creator_agent
- job
- project
- sources
- evidence
- status
- approved_by
- created_at
- supersedes

## 38. Enterprise Knowledge Graph

Entidades: Documents, Policies, Customers, Projects, Decisions, People, Agents, Products, Regulations, Evidence, Artifacts, Relationships.

É retrieval/projection. Não substitui Postgres.

## 39. Trust Registry

```text
T0 Lumenva Internal
T1 Official Provider
T2 Official Partner
T3 Audited Community
T4 Untrusted / Blocked
```

Data boundary:
- T0 Trusted Internal
- T1 Verified External
- T2 External
- T3 User Generated
- T4 Untrusted

## 40. Security Platform

Inclui Goal Integrity, Prompt Injection Defense, Memory Firewall, Approval Integrity, Least Privilege, Agent Isolation, Supply Chain Security, Spend Limits, Secrets Management e Incident Containment.

## 41. Egress Gateway

- Domain Allowlist
- API Allowlist
- Destination Policy
- Data Classification
- DLP
- Secret Filtering
- Request Logging
- Response Inspection

## 42. Agent Sandbox

Isolar Browser, Terminal, Filesystem, Code, Downloads e External Content.

## 43. Eval Platform

Avaliar Agent, Skill, Model, Tool, Workflow, Regression, Security, Cost, Latency e Business Outcome.

Também output, trajectory, tool usage, policy compliance, cost, latency e business result.

## 44. Tracing

Extraído do Comp CRM.

```text
Telemetry != Trace Content
```

Default:
- trace metadata = ON
- trace sensitive content = OFF

## 45. Controlled Self-Improvement

```text
Execution
→ Telemetry
→ Evaluation
→ Problem Detection
→ Improvement Agent
→ Proposed Change
→ Sandbox
→ Eval
→ Security
→ Approval
→ Promotion
```

Nunca self-permission escalation.

## 46. Digital Twin

Replica agents, policies, skills, workflows, permissions e tools usando fake customers, fake emails, sandbox DB e test infrastructure.

## 47. Shadow Mode

```text
Observe
→ Recommend
→ Draft
→ Execute with approval
→ Autonomous within policy
```

## 48. Notification Router

Único sistema de decisão/roteamento de notificações para approvals, blockers, incidents, SLA, customer handoff, CI/deploy, security, legal, quota, cost e job completion.

## 49. Notification Delivery Layer

Novo V2.1.

Adapters:
- web/in-app
- mobile push
- sound cue
- email
- channel-specific

Cada entrega registra status, retry, provider_receipt e correlation_id.

## 50. Ops Watcher / Operations Center

Monitorar Health, Jobs, Agents, Workflows, Models, MCP, Tools, Queues, Incidents, Costs, Security, Compliance e SLA.

## 51. Compute Fabric

Nodes:
- Google Cloud
- Cloudflare
- Thin VPS
- Local Burst Compute

`PC OFF != LUMENVA OFF`

## 52. GitHub Source of Definition

GitHub armazena source, policies, workforce configuration, workflows, skills, MCP definitions, IaC, docs, tests e CI/CD.

## 53. Google Managed Plane

Target:
- Cloud SQL
- Cloud Storage
- Firebase Auth
- Cloud Run
- Pub/Sub
- Cloud Tasks
- Cloud Scheduler
- Secret Manager
- Observability
- Backups

Cutover apenas domain-by-domain.

## 54. Cloudflare Agent Edge

Uso: Ingress, Workers, Workflows, Durable Objects, AI Gateway, Agents, Browser/Sandbox Edge, Realtime e MCP connectivity.

Sem duplicar Postgres.

## 55. Browser Gateway / BrowserMesh

Agent Browser separado fica superseded.

Preservar warm sessions, persistent profiles, hibernation, session locks, engine routing, site capability registry, snapshots, perception, WebMCP, code mode, flow compiler, workflow registry, credentials, browser pool, downloads/uploads, screenshots, logs, artifacts, evidence, recording/replay e multi-agent isolation.

## 56. Command Center

```text
/command
├── Dashboard
├── Chat
├── Voice
├── Goals
├── Projects
├── Jobs
├── Workflows
├── Agent Office
├── Activity Stream
├── Customers
├── CRM
├── Unified Inbox
├── Approvals
├── Evidence
├── Memory
├── Knowledge
├── Artifacts
├── Legal
├── Compliance
├── Finance
├── FinOps
├── Procurement
├── Evals
├── Digital Twin
├── Incidents
├── Infrastructure
├── Workforce
├── Nodes
├── Usage
├── Costs
└── Settings
```

## 57. CRM Core

Preservar organizations, contacts, customers, leads, deals, pipelines, conversations, activities, tasks, appointments, products, orders e billing references.

## 58. Unified Inbox

Normalizar WhatsApp, Instagram, Facebook, Email, Voice e Internal.

Modelo: conversation, participant, channel, message, attachment, assignment, handoff e SLA.

## 59. CRM Automation Engine — V2.1

Triggers:
- domain event
- absolute date
- relative date
- stage transition
- inactivity
- webhook
- external event

Actions:
- assign
- move
- transfer pipeline
- follow-up
- task
- notify
- call capability
- open Case

Transferência entre pipelines deve ser atômica e sem duplicar lead.

## 60. Messaging Campaign Engine — V2.1

```text
Campaign
├── recipient snapshot
├── segment
├── template/version
├── suppressions
├── opt-out
├── channel/session
├── timezone
├── schedule
├── pacing/rate policy
├── worker
├── delivery receipts
└── metrics/outcomes
```

WhatsApp é primeiro vertical. Modelo é omnichannel. Não criar `campaign_queue`; usar `job_queue`.

## 61. Case Management — V2.1

```text
Conversation/Event
→ Case
→ category
→ severity
→ SLA
→ owner/queue
→ actions
→ evidence
→ resolution
```

Cases != infrastructure incidents.

## 62. Approved Response Registry — V2.1

Scopes:
- global
- department/channel
- agent-specific

Cada resposta possui version, approval, status e provenance.

## 63. Media Completion Barrier — V2.1

```text
message received
→ media persist
→ derive/transcribe/OCR
→ READY → agent turn
ou
TIMEOUT → explicit degraded path → agent turn
```

Nunca ignorar mídia silenciosamente.

## 64. Attribution & Conversion Gateway — V2.1

Ledger:
- source
- campaign
- ad
- GCLID
- equivalent provider IDs
- touchpoint
- contact
- lead
- deal
- stage
- outcome
- conversion receipt

Adapters: Google Ads Offline Conversion, Meta Conversion Events e futuros providers.

CRM continua source of truth.

## 65. Follow-up Engine Extensions

Somente gaps reais do Deskcomm:
- duplicate flow
- rename flow
- fixed-text follow-up
- AI suggested follow-up + human approval
- customer-return resume
- deterministic intent classification

## 66. External MCP per Organization

Implementar em Capability Registry + Tool Gateway.

Config por tenant:
- MCP server
- permissions
- allowed tools
- trust
- auth
- health
- risk

## 67. Custom AI Providers

Suportar provider catalog extensível: OpenAI, Anthropic, Google, Groq, NVIDIA NIM, Requesty, OpenRouter etc.

Model provider != agent identity.

## 68. ERP / System of Record Expansion

Referência: Oryh.

Incorporar customers, vendors, products, stock, quotations, sales orders, purchase orders, incoming invoices, outgoing invoices, payments, settlement ledger, payroll, expenses, timesheets, purchase documents, audit e custom objects.

Obrigatório adaptar para organization_id + RLS + multi-tenant.

Princípio:
```text
SERVER = FACTS + PERMISSIONS + STATE TRANSITIONS
AGENT = DECISIONS WITHIN POLICY
```

## 69. Commerce OS

Commerce Brain, Commerce Director, Merchandising, Sales & Conversion, Pricing, Marketplace, Order Operations, Customer & Retention e Commerce Intelligence.

Adapters: UCP, storefronts, marketplaces, Google commerce, shipping, tax, payments.

Social Commerce é canal.

## 70. Social OS

```text
Maestri
→ Social Director
→ Researcher
→ Strategist
→ Creator
→ Media
→ Community
→ Analyst
→ QA
```

Preservar Social Brain, Hook Engine, Humanizer, Proof/Claim Engine, Content Evals, Brand/Audience/Content/Performance/Experiment Memory, Repurpose, Trend Intelligence, Media Engine, Approval Engine, Social Gateway, Community Inbox e Learning Engine.

## 71. Deterministic Lead Intelligence

Extraído do Comp.

```text
source
→ source units
→ deterministic rejection
→ deterministic ranking
→ dedupe
→ AI extraction
→ schema validation
→ staged candidate
→ review
→ CRM promotion
```

Não usar `web → LLM → CRM` como padrão.

## 72. Phone / Voice

Preservar incoming, outgoing, telephony bridge, customer identification, CRM context, orders, appointments, ETA, human transfer, history, analytics, fast acknowledgement e fallback.

Arquiteturas provider-locked antigas ficam superseded.

## 73. Fast Decision Engine

```text
Deterministic Engine
→ Stateful Context
→ Fast Reasoning
→ Conditional Retrieval
→ Capability Routing
→ Deep Reasoning Gate
```

FDE não substitui Maestri.

## 74. Project Factory

```text
MISSION
→ DISCOVERY
→ RESOURCE MANIFEST
→ ARCHITECTURE
→ INDEPENDENT REVIEW
→ PROJECT COMPILER
→ DAG
→ DYNAMIC TEAM BUILDER
```

Preservar Project Mission, Project Cell, Resource Discovery, Research Pack, Architecture Team, Task Contract, Tool Packs, Dependency Manifest, Ephemeral Environments, Integration Agent, Independent Reviewer, Verification Pyramid, Project Memory, Project Ledger, CEO Report, Human Exception Gate, Auto-Recovery, Dynamic Replanning, Stop Conditions e Retrospective.

Build vs Buy vs Reuse:
```text
Need
→ already exists? REUSE
→ official provider? USE
→ trusted OSS? EVALUATE
→ otherwise BUILD
```

## 75. Legal / Privacy / Compliance

Estrutura:
- Legal Director / General Counsel
- EU Regulatory
- AI Governance
- Privacy/GDPR
- DPO
- Contracts
- Country Legal Agents
- Consumer Law
- Employment
- IP/Licensing
- Corporate Compliance
- Legal Research
- Legal Escalation

Jurisdictions iniciais: EU, PT, ES, FR, DE, NL, LU, DK, CH.

## 76. Legal Impact Check

Todo job relevante passa por jurisdiction, personal data, regulated AI, consumer, employment, contract, IP e sensitive sector checks.

## 77. Customer Compliance Profile

Campos: country, operating_countries[], customer_type, industry, data_categories, AI_systems, applicable_rules e compliance_profile.

## 78. Regulatory Watch

```text
regulation.changed
→ research
→ impact analysis
→ affected customers
→ affected workflows
→ Legal Director
→ policy proposal
→ human approval
→ policy/skill update
```

## 79. Finance

Finance Director, Accounts Receivable, Accounts Payable, Invoice, Revenue, Expense, Cashflow, Forecast, Tax Preparation e Finance Evidence.

## 80. FinOps

AI Cost, Cloud Cost, Budget, Usage, Forecast, Vendor Cost e Optimization.

Budgets por job, project, customer, department, daily e monthly.

## 81. People / HR

Recruitment, Onboarding, Training, Performance Operations, Contractor Management, Access Provisioning e Offboarding.

Também Agent Onboarding, Agent Training, Agent Evaluation e Agent Offboarding.

## 82. Procurement

```text
Vendor Discovery
→ Evaluation
→ Security
→ Legal
→ DPA
→ Cost
→ Approval
→ Procurement
→ Renewal
→ Termination
```

MCP/capability externa precisa de security, legal, privacy, license, sandbox e eval.

## 83. Observability

Correlation fields: trace_id, organization_id, goal_id, task_id, job_id, run_id, agent_id, provider, model, capability, tool, duration, tokens, cost, result e error.

Dashboards: Agent Usage, Provider Usage, Session Usage, Infra, GitHub Dev, Security, Incidents e Business Operations.

## 84. Fleet / Run / Action Observability

Extraído do Comp.

Monitorar fleet, active runs, parked runs, resumed runs, actions, event inbox, receipts, tokens/run, cost/run, provider health e business outcome.

## 85. Engineering Control Plane

```text
David = Owner
Claude = orchestrator
Codex = engineering
Gemini = intelligence
Jules = scoped executor
GitHub Actions = technical gate
```

Regras:
- branch + PR
- main protegida
- same-SHA evidence
- TDD
- PREEXISTING != REGRESSION
- não enfraquecer testes
- não inventar receipts
- não expor secrets
- não destruir estado sem prova
- produção/custo/billing só com autorização

## 86. Hooks permanentes

- before destructive action
- before production write
- after code change → tests
- before commit → lint/typecheck
- before PR → tests/security
- after deploy → health check
- on agent error → incident
- on repeated failure → learning loop

## 87. Referências externas incorporadas

### Comp AI CRM
Usar para durable runtime, same-run resume, execution channels, ActionReceipt, agent observability, tracing, provider-neutral connections, builder reliability, marketing automation, lead intelligence e bounded leasing regression pattern.

### OpenCompany
Usar para AI employee/team, lead-specialist delegation, persistent execution, plugin model e typed retry semantics.

### Oryh
Usar para ERP/system-of-record domains, server=facts, agent=decisions, plain HTTP/skills e financial records. Não copiar single tenancy.

### crmkit
Usar para agent-first API, plain HTTP, stable handles, token-cheap responses, compact agent manual e instructive errors.

## 88. DeskcommCRM Mining — V2.1

Branches incorporadas semanticamente:
- `feat/jev-onda-4` → Decision Guard / routing / manipulation detection
- `resgate/1651...` → custom provider catalog
- `resgate/cvf/followup-cliente-voltou` → follow-up upgrades
- `resgate/triagem/1392...` → Messaging Campaign Engine
- `tri37/agenda-p2-nova` → date automation + pipeline transfer
- `pr121` → Context Lifecycle gaps

Fork patterns:
- jmpo → push/sound/Cases/attribution
- enediscremim95 → SES + human-approved follow-up
- nexo0650-glitch → external MCP + Groq/NVIDIA
- Johnatan-Freire → agent activation/permissions/fail-closed
- KIRAzinx566 → media wait + provider adapters
- vgamkt → AI commands + catalog/RAG patterns
- hiperbold → MCP + WhatsApp connection alerts
- pcluke24-sys → org AI controls + Meta stage events
- VST-EXPRESS → approved response registry
- automatikpg-ux → GCLID + Google Ads conversions
- ScriptCamilo → setup/deploy UX
- GilbertoCidral → optional TV dashboard
- leonardusrosa → demo/Remotion
- faxamkt → API ideas; bulk history deletion REJECTED

## 89. Não duplicar

Deve existir somente:
- 1 Maestri
- 1 Task Router
- 1 Workforce Runtime
- 1 Resource Router
- 1 Capability Registry
- 1 Tool Gateway
- 1 Policy/Approval system
- 1 Memory Platform
- 1 Evidence/Artifact Platform
- 1 durable job substrate
- 1 event substrate
- 1 Browser execution plane
- 1 tenant identity
- 1 observability substrate

## 90. Superseded — NÃO REINTRODUZIR

- V3/V4/V5/V6 como arquiteturas concorrentes
- Tool Hub separado
- Lumenva Brain separado
- Agent Browser separado
- Social Commerce como agente
- filas duráveis por domínio
- event buses concorrentes
- autonomia ilimitada
- PC obrigatório
- VPS com estado único
- modelo fixo por agente
- todas as skills carregadas
- Phone provider-locked
- Convex substituindo Postgres
- Oryh single-tenant aplicado diretamente

## 91. Architectural Done

Uma capability só fica DONE quando:
- requirements satisfied
- correct semantic owner
- tests
- integration
- security
- tenant isolation
- policy
- evidence
- observability
- rollback/recovery
- documentation
- GitHub Actions green

Status por domínio:
```text
PLANNED
APPROVED
IN_PROGRESS
IMPLEMENTED
TESTED
PRODUCTION
```

## 92. Regra final

```text
PRESERVE FIRST
→ PROVE SECOND
→ CHANGE LAST
```

Para qualquer ideia externa:

```text
EXTERNAL PATTERN
→ MAP TO LUMENVA OWNER
→ ADAPT TO CANONICAL GOVERNANCE/DATA
→ IMPLEMENT ON BRANCH
→ TEST
→ GITHUB ACTIONS
→ EVIDENCE
→ MERGE
```

Nunca criar um segundo control plane apenas porque outro projeto possui uma implementação interessante.
