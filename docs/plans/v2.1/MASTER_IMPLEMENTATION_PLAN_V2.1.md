# LUMENVA — MASTER IMPLEMENTATION PLAN V2.1

**Escopo:** Lumenva somente  
**Repositório:** `trydavidqix/Lumenva`  
**Princípio:** `PRESERVE FIRST → PROVE SECOND → CHANGE LAST`

Classificação:
```text
IMPLEMENTED
IN_PROGRESS
PLANNED
CONFIG_REQUIRED
SUPERSEDED
```

Blueprint não prova implementação. Branch não prova produção. Somente evidence + gates permitem promoção de estado.

## FASE 0 — Baseline e proteção

**Estado:** IMPLEMENTED / CONTINUOUS

- registrar HEAD
- inventariar branches/PRs/worktrees
- preservar Recovery
- mapear migrations/providers/workers
- classificar failures
- PREEXISTING != REGRESSION
- impedir force-push main
- impedir reset/clean destrutivo
- impedir fake receipts

Estado de referência:
```text
main: 3fbe74a3...
v2.1: criada diretamente da main
implementation/unified: árvore restaurada igual à main
```

## FASE 1 — Operating Core / Data Authority

**Estado:** IMPLEMENTED / PARTIAL

Preservar organization_id, RLS, PostgreSQL, event_log, job_queue, approvals, audit, evidence e idempotency.

### Gate adicional — bounded leasing

Criar teste de concorrência:
```text
claim(limit=N)
→ nunca selecionar/processar > N
```

Só alterar SQL se a falha for reproduzida.

## FASE 2 — Company Intelligence

**Estado:** PLANNED

Implementar Mission Engine, Goal Engine, KPI Engine, Priority Engine e Autonomous Planner.

```text
Mission
→ Goal
→ Initiative
→ Project
→ Epic
→ Job
→ Task
→ Step
```

## FASE 3 — Goal Integrity

Criar Goal Envelope com goal, constraints, owner, policy, risk, success criteria e integrity metadata.

External content nunca altera authority.

## FASE 4 — Maestri Core

**Estado:** PLANNED / PARTIAL

Construir mínimo:
- Intent Router
- Goal Router
- Task Router
- Dependency Manager
- Execution Strategy Router
- Agent Router
- Runtime Router
- Provider Router
- Capability Router
- Context Router
- Resource Router
- Risk Router
- Approval/Policy Engine
- Workflow Engine
- Recovery
- Evidence
- Memory
- Notification

Não criar segunda fila/banco/event bus.

## FASE 5 — Outer / Inner Loops

Outer:
```text
goal → task → strategy → runtime → execute → verify → eval → update
```

Inner:
```text
think → act → observe → verify → retry/pass
```

Todo loop com budget, iteration limit, timeout, checkpoint, stop condition e escalation.

## FASE 6 — Verification / Maker–Checker

Prioridade: tests, lint, typecheck, schemas, build, security, policy e health.

R3/R4 exigem independent verification + human gate.

## FASE 7 — Fresh Context

```text
execute → checkpoint → close runtime → fresh runtime
```

Novo runtime recebe apenas goal, checkpoint, relevant memory, evidence e minimum skills.

## FASE 8 — Context Engineering + Lifecycle

Context Pack canônico.

Adicionar cutoff, soft reset, hard reset autorizado, summary checkpoint, retention, TTL, provenance e fresh re-entry.

Gate: context reset jamais apaga CRM fact, Evidence, Audit ou Official Memory.

## FASE 9 — Agent Harness

**Estado:** IMPLEMENTED/PARTIAL

```text
Model
Instructions
Context
Skills
Tools
MCP
Environment
Permissions
Sandbox
Memory
Evidence
Verification
Evals
Loops
Checkpoint
Recovery
```

Preservar CLAUDE.md curto, AGENTS.md, path-scoped rules, lazy skills, hooks e provider adapters.

## FASE 10 — Agent Platform / Builder

Builder:
```text
DRAFT
→ VALIDATE
→ RESOLVE_MISSING
→ COMPILE
→ TEST
→ CERTIFY
→ DEPLOYABLE
```

Persistir estado e retry budget.

## FASE 11 — Autonomy + Risk

Implementar L0–L5 autonomy e R0–R4 risk. Um não altera o outro.

## FASE 12 — Reputation + A2A

Implementar reputation metrics e A2A com Discovery, Agent Cards, Delegation, Task Transfer, Context Transfer, Artifact Transfer, Evidence Transfer e Result Contract.

## FASE 13 — Capability OS

Consolidar Tool Hub em Capability OS + Tool Gateway.

Registries lógicos:
- Capabilities
- Agents
- Providers
- Skills
- Plugins
- MCP
- Tools
- Hooks
- Policies
- Trust

## FASE 14 — Tool Gateway

Implementar gateway único.

Adicionar ProviderConnection Core:
```text
provider
tenant
scopes
guard
callback validation
token lifecycle
revocation
health
```

## FASE 15 — Trust Registry

Implementar trust T0–T4 e data-boundary T0–T4.

Aplicar em Memory, Browser, Tools, External content, Egress e Approvals.

## FASE 16 — Memory Platform

Implementar namespaces + firewall:
```text
candidate
→ provenance
→ validate
→ dedupe
→ conflict
→ poison
→ sensitivity
→ TTL
→ promotion
```

## FASE 17 — Evidence + ActionReceipt + Artifact Registry

Implementar Evidence Platform.

ActionReceipt mínimo:
```text
action_type
provider
organization_id
actor
run_id
external_id
normalized_result
idempotency_key
evidence_ref
timestamp
```

Artifact Registry versionado.

## FASE 18 — Enterprise Knowledge Graph

Criar projection layer sobre dados/evidence/memory. Nunca substituir PostgreSQL.

## FASE 19 — Durable Workflow Engine

Workflow state completo.

Adicionar:
- execution_channel
- external_event_inbox
- parked_state
- resume_state
- ActionReceipt[]

Gate: external event deve retomar o mesmo run quando necessário.

Testar dedupe, ordering, lease, late event, retry e concurrency.

## FASE 20 — Compensation / Undo

Implementar metadata reversible, rollback e compensation.

Obrigatório para mutações sensíveis.

## FASE 21 — Failure / Recovery

Implementar typed retry boundary.

```text
validation/config/policy → non-retryable
timeout/429/5xx/network → retryable
```

Adicionar fallback, degraded mode, circuit breaker, incident, root cause e learning.

## FASE 22 — Security Platform

Expandir Goal Integrity, Prompt Injection, Least Privilege, Memory Firewall, Approval Integrity, Loop detection, Spend limits, Agent isolation, Supply chain, Secrets e Incident containment.

## FASE 23 — Egress + Sandbox

Implementar Egress Gateway.

Sandbox para browser, terminal, filesystem, code, downloads e external content.

## FASE 24 — Hooks

Usar hooks existentes.

Obrigatórios:
- before destructive
- before production
- after code → tests
- before commit → lint/typecheck
- before PR → tests/security
- after deploy → health
- error → incident
- repeated failure → learning

## FASE 25 — Eval + Tracing

Eval Platform.

Tracing:
```text
metadata = default ON
sensitive content = default OFF
```

Aplicar DLP/Privacy/Egress.

## FASE 26 — Controlled Self-Improvement

```text
execution
→ telemetry
→ eval
→ finding
→ proposed change
→ sandbox
→ eval
→ security
→ approval
→ promotion
```

Nunca self-permission escalation.

## FASE 27 — Digital Twin

Criar sandbox company simulation. Usar antes de autonomia elevada.

## FASE 28 — Shadow Mode

```text
Observe → Recommend → Draft → Execute+Approval → Autonomous
```

Promotion gate por evidence.

## FASE 29 — Workforce Runtime

Implementar priority, shift, preemption, slots, handoff, wake/sleep e scheduler.

## FASE 30 — Compute Fabric

Nodes: Google, Cloudflare, VPS e Local Burst.

Implementar heartbeat, drain, checkpoint e fallback.

## FASE 31 — GitHub Source of Definition

**Estado:** IMPLEMENTED/PARTIAL

Tudo versionável fica no GitHub.

GitHub Actions determina PASS/FAIL.

## FASE 32 — Google Managed Plane

**Estado:** IN_PROGRESS

Migrar por domínio:
```text
inventory
schema mapping
backfill
shadow
compare
auth/RLS parity
rollback
cutover
production proof
```

## FASE 33 — Cloudflare Edge

Adicionar edge agents/ingress/workflows quando apropriado. Sem mover business truth.

## FASE 34 — Backup / DR / IaC

Implementar DB backup, configuration backup, artifact backup, restore test, RPO/RTO, IaC e DR package.

## FASE 35 — Legal / Privacy / Compliance

Criar camada transversal com agents/funções jurídicas conforme blueprint.

## FASE 36 — Legal Impact + Regulatory Watch

Todo job relevante passa por legal impact classification.

Regulatory Watch sugere updates; humano aprova alterações críticas.

## FASE 37 — Finance / FinOps / ERP Foundation

Implementar Finance + FinOps.

Adicionar modelo ERP inspirado no Oryh:
- vendors
- stock
- quotations
- orders
- invoices
- payments
- settlement
- payroll
- expenses

Tudo multi-tenant.

## FASE 38 — People / HR

Human + Agent lifecycle operations.

## FASE 39 — Procurement

Vendor/capability procurement pipeline completo.

MCP externo precisa de security/legal/privacy/license/eval.

## FASE 40 — Browser Gateway / BrowserMesh

Convergir Agent Browser requirements no BrowserMesh. Não criar execution plane paralelo.

## FASE 41 — Project Factory

```text
MISSION
→ DISCOVERY
→ RESOURCE MANIFEST
→ ARCHITECTURE
→ REVIEW
→ COMPILER
→ DAG
→ TEAM
```

Adicionar builder reliability state machine.

## FASE 42 — Commerce OS

Implementar sem duplicar Marketing/Finance/Security. Social Commerce = channel.

## FASE 43 — Social OS

Implementar Social Director + specialist agents.

Adicionar deterministic intelligence:
```text
source
→ rejection
→ ranking
→ dedupe
→ AI
→ validation
→ staged candidate
```

## FASE 44 — Phone / Voice

Reconciliar runtime existente antes de provider change.

Preservar requirements, não antigas arquiteturas.

## FASE 45 — Fast Decision Engine

```text
deterministic
→ state
→ fast reasoning
→ retrieval
→ capability
→ deep reasoning gate
```

## FASE 46 — Notification Router

Centralizar decisão, dedupe, prioridade e policy.

## FASE 47 — Ops Watcher / Operations Center

Monitorar empresa e runtime.

## FASE 48 — Observability / Usage / Quotas

Adicionar fleet, runs, actions, park/resume, external event backlog, ActionReceipts, tokens/run, cost/run, provider health e business outcomes.

## FASE 49 — Command Center / Agent Office

Implementar superfícies do Blueprint.

Agent Office = projection, não runtime.

## FASE 50 — Engineering Control Plane

Preservar governança:
```text
branch
→ implement
→ tests
→ PR
→ GitHub Actions
→ review
→ merge
```

Sem merge com regressão nova.

## FASE 51 — CI/CD / Release

```text
CODE
→ static
→ unit
→ integration
→ security
→ build
→ receipts
→ governance evidence
→ merge
→ deploy
→ health
→ release evidence
```

## FASE 52 — Canonical Completion Gate

Capability só fica DONE se houver requirements, correct owner, tests, integration, security, RLS, policy, evidence, observability, rollback, docs e GitHub Actions green.

# PRODUCT EXTENSION TRACK V2.1

## P1 — Messaging Campaign Engine

Owners: CRM + Workflow Engine + Tool Gateway + Channel adapters.

Implementar:
- campaign
- recipient snapshot
- segments
- templates
- suppressions
- opt-out
- channel/session
- timezone
- schedule
- pacing
- anti-ban
- worker
- delivery receipt
- metrics
- pause/resume/cancel

Gate: RLS, opt-out, idempotency, duplicate-send tests, pacing e provider failure.

## P2 — Attribution & Conversion Gateway

Implementar:
- source
- ad
- campaign
- GCLID
- touchpoint
- lead/contact/deal link
- stage conversion
- outcome conversion
- Google Ads upload
- Meta conversions
- dedupe
- provider receipt

CRM continua truth.

## P3 — CRM Automation Engine

Triggers:
- event
- date
- relative date
- stage
- inactivity
- webhook

Actions:
- assign
- move
- transfer
- follow-up
- task
- notification
- capability
- case

Gate: pipeline transfer atomic; nenhum lead duplicado.

## P4 — Context Lifecycle

Implementar cutoff/reset/checkpoint/retention separado de official memory.

## P5 — Case Management

Schema:
```text
Case(
 id,
 organization_id,
 source_type,
 source_id,
 category,
 severity,
 status,
 owner,
 queue,
 sla_due_at,
 resolution,
 evidence_refs
)
```

Flows: open, assign, escalate, snooze, resolve, reopen.

## P6 — Approved Response Registry

```text
global
department/channel
agent override
version
approval
active/inactive
```

Agente não autoaprova.

## P7 — Notification Delivery Layer

Adapters: web, mobile push, sound, email.

Reutilizar Notification Router.

## P8 — Media Completion Barrier

```text
inbound
→ media persist
→ transcription/OCR/derive
→ READY | TIMEOUT
→ agent turn
```

Sem ignorar mídia pendente.

## P9 — Follow-up Upgrades

Adicionar apenas:
- duplicate flow
- rename flow
- fixed-text follow-up
- AI suggestion + human approval
- customer-return resume
- intent classification

Sem segundo scheduler.

## P10 — External MCP / Custom Provider

External MCP por organização:
- tenant
- server
- tools
- permissions
- trust
- auth
- health
- risk

Provider catalog:
- OpenAI
- Anthropic
- Google
- Groq
- NVIDIA
- Requesty
- OpenRouter
- future

Tudo via Capability/Tool Gateway.

## P11 — Optional Backlog

Somente depois do core:
- TV dashboard + pairing
- demo mode
- Remotion product videos
- Dokploy/Easypanel adapters
- SES provider

# REJEITADO

Não adotar:
- bulk conversation-history deletion
- provider-specific control planes
- fork-wide cherry-picks
- duplicate schedulers
- duplicate queues
- duplicate policy engines
- duplicate MCP registries

Privacy deletion deve seguir canonical retention/anonymization/evidence policy.

# ORDEM REAL DE EXECUÇÃO

```text
A. baseline / CI / docs drift
B. resolver PR #74 corretamente
C. Operating Core / data authority
D. Company Intelligence + Maestri Core
E. Context / Harness / Verification
F. Capability OS + Tool Gateway
G. Trust / Memory / Evidence / Artifacts
H. Durable Workflow + Event Resume + ActionReceipt
I. Recovery / Compensation / Retry semantics
J. Evals / Shadow / Digital Twin
K. Workforce / Compute Fabric
L. Security / Legal / FinOps
M. Browser / Project Factory
N. Context Lifecycle
O. CRM Automation
P. Messaging Campaign Engine
Q. Case Management
R. Attribution & Conversion
S. Approved Responses
T. Media Completion Barrier
U. External MCP / Provider Catalog
V. Social / Commerce / ERP
W. Phone / FDE
X. Notification Delivery / Operations Center
Y. Command Center
Z. gradual autonomy based on evidence
```

# DEPENDENCY GRAPH

```text
Operating Core
      ↓
Engineering Harness
      ↓
Maestri
      ↓
Task / Workforce / Resource
      ↓
Capability OS + Tool Gateway
      ↓
Trust + Memory + Evidence
      ↓
Durable Workflow
      ↓
Evals + Security
      ↓
CRM Extensions
      ↓
Commerce / Social / ERP / Voice
      ↓
Autonomous Departments
```

# MATRIZ LOSSLESS

Preservado:
- Mission / Goal / KPI
- Outer/Inner Loop
- Maker–Checker
- Fresh Context
- Agent Lifecycle
- Certification
- Autonomy
- Risk
- Reputation
- A2A
- Trust
- Memory Firewall
- Artifact Registry
- Knowledge Graph
- Durable Workflow
- Compensation
- Recovery
- Egress
- Sandbox
- Hooks
- Evals
- Self-Improvement
- Digital Twin
- Shadow Mode
- Finance
- FinOps
- HR
- Procurement
- Legal
- Regulatory Watch
- Notification Router
- Ops Watcher
- Project Factory
- Commerce
- Social
- Phone
- FDE

Adicionado V2/V2.1:
- Run-owned Channel
- External Event Inbox
- ActionReceipt
- Provider-neutral Connection Core
- Agent Builder State Machine
- Typed Retry Boundary
- Fleet/Run/Action Observability
- Trace Policy
- Bounded Leasing Audit
- Agent-facing API
- ERP System-of-record Expansion
- Messaging Campaign Engine
- Attribution & Conversion Gateway
- CRM Automation Engine
- Context Lifecycle
- Case Management
- Approved Response Registry
- Notification Delivery Layer
- Media Completion Barrier
- Follow-up Upgrades
- External MCP per Organization
- Custom Provider Catalog

# NÃO REINTRODUZIR

- Tool Hub separado
- Brain separado
- Agent Browser separado
- event buses paralelos
- domain-specific durable queues
- unlimited autonomy
- always-on agents
- all skills loaded
- PC mandatory
- single-state VPS
- provider-locked Phone architecture
- Convex replacing Postgres
- single-tenant ERP model

# OPEN LOOPS ATUAIS

1. Resolver PR #74 sem reduzir gates.
2. Mapear Maestri blueprint → código/testes.
3. Completar Capability OS + Tool Gateway sem duplicação.
4. Provar Google cutover por domínio.
5. Reconciliar Browser requirements → BrowserMesh.
6. Reconciliar Phone/FDE → voice runtime atual.
7. Auditar job_queue bounded leasing.
8. Definir schema ActionReceipt.
9. Definir external_event_inbox.
10. Definir trace metadata/content policy.
11. Adaptar ERP/Oryh para multi-tenant.
12. Definir Agent API style guide.
13. Implementar Context Lifecycle.
14. Implementar CRM Automation.
15. Implementar Campaign Engine.
16. Implementar Attribution Gateway.
17. Implementar Case Management.
18. Implementar Approved Responses.
19. Implementar Media Completion Barrier.
20. Consolidar external MCP/custom providers.
21. Integrar Follow-up gaps.
22. Corrigir docs drift conforme estado real.

# REGRA FINAL

```text
PRESERVE FIRST
→ PROVE SECOND
→ CHANGE LAST
```

Para qualquer novo pattern:
```text
DISCOVER
→ MAP OWNER
→ REUSE?
→ DESIGN CONTRACT
→ IMPLEMENT
→ TEST
→ SECURITY
→ GITHUB ACTIONS
→ EVIDENCE
→ MERGE
```

Para autonomia:
```text
SHADOW
→ EVIDENCE
→ EVAL
→ POLICY
→ APPROVAL
→ PROMOTION
```

Nada vira DONE porque um blueprint disse que deveria existir.
