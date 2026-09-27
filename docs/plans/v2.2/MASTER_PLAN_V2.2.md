# LUMENVA — MASTER PLAN V2.2

**Status:** proposed canonical architecture + execution roadmap  
**Base:** V2.1  
**Scope:** Lumenva only; Nexus remains a separate project  
**Rule:** PRESERVE FIRST → PROVE SECOND → CHANGE LAST

---

# 1. Canonical identity

## Lumenva

**Lumenva = AI Business OS.**

Lumenva operates the business:

- CRM
- customers, leads, deals and pipelines
- unified inbox
- WhatsApp / Instagram / Facebook / email
- campaigns
- CRM automations and follow-ups
- cases / tickets / SLA
- voice and telephony
- social intelligence
- Content OS / Studio
- commerce
- billing
- finance / ERP-light
- people / HR
- business agents
- Agent Birth / Builder
- memory / context
- approvals
- evidence / ActionReceipt
- attribution
- compliance
- observability / Ops Center

## Nexus

**Nexus = AI Engineering & Execution OS.**

Nexus owns technical execution:

- Claude / Codex / Gemini / Jules engineering orchestration
- BrowserMesh
- computer use
- terminal / filesystem / code execution
- technical workforce
- engineering control plane
- worktrees / branches / PR automation
- software Project Factory
- technical compute routing
- engineering hooks and technical sandbox

## Boundary rule

```text
LUMENVA = OPERATE THE BUSINESS
NEXUS = BUILD AND OPERATE THE TECHNOLOGY
```

No duplicated ownership.

---

# 2. Desktop / .exe

**Decision: REMOVE from product architecture.**

Lumenva is:

```text
Web + Cloud + optional self-host
```

Do not design or maintain:

- .exe product
- Electron
- Tauri
- Avalonia
- Uno
- WinUI
- desktop installer/release pipeline

This does not remove Windows support from development or tests.

---

# 3. Google as primary cloud platform

Google becomes the official target cloud architecture.

```text
Google Cloud
├── Firebase Auth
├── Cloud SQL PostgreSQL
├── Cloud Storage
├── Cloud Run
├── Pub/Sub
├── Cloud Tasks
├── Cloud Scheduler
├── Secret Manager
├── Cloud Logging
├── Cloud Monitoring
├── Backup / DR
├── Gemini
└── Vertex AI when justified
```

Canonical authorities:

```text
Firebase Auth = identity truth
PostgreSQL / Cloud SQL = business truth
organization_id = tenant identity inside business data
```

Cloudflare is not a mandatory second control plane. It may be used only for a concrete future requirement that does not duplicate Google.

---

# 4. Orchestration boundary

V2.1 mixes business orchestration with technical engineering orchestration.

V2.2 separates them.

## Lumenva business orchestration

Responsible for flows such as:

```text
customer request
→ classify intent
→ select business agent
→ load CRM context
→ choose allowed capability
→ execute
→ verify
→ record result
```

This may retain the Maestri name only as a **business control plane**.

## Nexus technical orchestration

Responsible for:

- choosing Claude/Codex/Gemini/Jules
- engineering tasks
- computer/browser execution
- worktrees
- code runtime
- technical CI orchestration
- engineering agents

---

# 5. Command Center

## Keep in Lumenva

Business surfaces:

- Dashboard
- Customers
- CRM
- Sales
- Campaigns
- Cases
- Inbox
- Agents
- Approvals
- Social
- Content
- Voice
- Commerce
- Finance
- Automations
- Knowledge
- Memory
- Analytics
- Incidents
- Usage
- Settings

## Move to Nexus

Do not expose as Lumenva business architecture:

- Git branches
- worktrees
- Codex sessions
- Claude sessions
- engineering CI internals
- BrowserMesh internals
- computer nodes
- technical engineering workers

---

# 6. CRM Core

**KEEP — core product.**

Canonical business entities include:

- organizations
- contacts
- customers
- leads
- deals
- pipelines
- conversations
- activities
- tasks
- appointments
- products
- orders
- billing references

Everything tenant-scoped by `organization_id`.

---

# 7. Unified Inbox

**KEEP.**

Normalize:

- WhatsApp
- Instagram
- Facebook
- Email
- Voice
- Internal

Canonical conversation model:

- conversation
- participant
- channel
- message
- attachment
- assignment
- handoff
- SLA

---

# 8. CRM Automation + Durable Workflow

**KEEP, but consolidate.**

One business execution hierarchy:

```text
EVENT
→ WORKFLOW
→ JOB
→ ACTION
```

Do not keep multiple competing schedulers/queues.

Google infrastructure roles:

```text
Pub/Sub = events
Cloud Tasks = async delivery / retries
Cloud Scheduler = time / cron
Lumenva Workflow Engine = business state and orchestration
```

Workflow capabilities:

- durable state
- retry / backoff
- timeout
- pause / resume / cancel
- human wait
- compensation
- recovery

CRM automation triggers:

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
- create task
- notify
- invoke capability
- open Case

Follow-up remains inside this engine; no second scheduler.

---

# 9. External Event Inbox + same-run resume

**KEEP.**

Required for long-running external workflows.

Example:

```text
workflow sends payment request
→ PARKED
→ provider event arrives later
→ event is matched to owner run
→ SAME workflow resumes
```

Must support:

- tenant scope
- dedupe
- ordering
- lease
- late events
- unowned events
- retries
- idempotency

---

# 10. ActionReceipt + Evidence

**KEEP and simplify.**

Every meaningful external action creates an ActionReceipt.

Minimum fields:

- action_type
- provider
- organization_id
- actor
- run_id
- external_id
- normalized_result
- idempotency_key
- evidence_ref
- timestamps

Evidence stores proof.

Audit stores changes/access.

Avoid creating overlapping proof systems.

---

# 11. Messaging Campaign Engine

**KEEP.**

Capabilities:

- recipient snapshot
- segments
- templates/versioning
- suppressions
- opt-out
- channel/session
- timezone
- schedule
- pacing/rate limits
- anti-duplicate / anti-ban controls
- pause/resume/cancel
- delivery receipts
- metrics

---

# 12. Attribution & Conversion

**KEEP.**

Track:

- source
- ad
- campaign
- GCLID / provider identifiers
- touchpoint
- lead/contact/deal relationship
- stage conversion
- final outcome
- Google Ads upload
- Meta conversion integration
- dedupe
- provider receipt

CRM remains the truth for the business outcome.

---

# 13. Case Management

**KEEP.**

Canonical Case:

- id
- organization_id
- source_type / source_id
- category
- severity
- status
- owner
- queue
- sla_due_at
- resolution
- evidence_refs

Flows:

- open
- assign
- escalate
- snooze
- resolve
- reopen

---

# 14. Approved Response Registry

**KEEP.**

Approved business answers may be scoped by:

```text
Global
→ Department / Channel
→ Agent override
```

Always versioned and approved.

Agents do not self-approve sensitive policy.

---

# 15. Media Completion Barrier

**KEEP.**

```text
inbound message
→ persist media
→ transcription / OCR / derivation
→ READY | TIMEOUT
→ agent turn
```

Do not let the agent respond while required media is still pending.

---

# 16. Agent Platform

**KEEP — core product.**

Business Agent identity:

- agent_id
- department
- role
- service identity
- permissions
- allowed_tools
- allowed_data
- delegation_scope
- spending_scope
- audit_identity
- autonomy level
- risk ceiling
- model policy
- knowledge
- memory

---

# 17. Agent Birth / Builder / Certification

**KEEP and prioritize.**

Builder state machine:

```text
DRAFT
→ VALIDATE
→ RESOLVE_MISSING
→ COMPILE
→ TEST
→ CERTIFY
→ DEPLOYABLE
```

Certification covers:

- capability tests
- tool tests
- permission tests
- prompt-injection tests
- security tests
- policy tests
- evals

---

# 18. Autonomy, risk and shadow mode

**KEEP, simplified.**

Autonomy:

```text
L0 Observe
L1 Recommend
L2 Draft
L3 Execute with approval
L4 Autonomous within policy
```

L5 autonomous department remains future vision, not near-term dependency.

Risk remains independent:

```text
R0 Read
R1 Safe Write
R2 External Action
R3 Sensitive
R4 Critical
```

Promotion path:

```text
Observe
→ Recommend
→ Draft
→ Execute with Approval
→ Limited Autonomous Operation
```

No self-permission escalation.

---

# 19. Context + Memory

**KEEP.**

Context Pack includes only what the job needs:

- agent identity
- job
- goal
- current state
- relevant customer/company context
- relevant memory
- checkpoint
- evidence
- required skills
- required tools
- permissions
- success criteria

Rule:

```text
LOAD ONLY WHAT THE JOB NEEDS
```

Context Lifecycle supports:

- cutoff
- summarization
- checkpoint
- soft reset
- authorized hard reset
- retention
- TTL
- fresh-context re-entry

Context reset never deletes official CRM facts, evidence, audit or approved memory.

Memory namespaces:

- Company
- Customer
- Project
- Agent
- Decision
- Incident
- Evidence

Memory Firewall:

```text
candidate
→ source/provenance
→ validation
→ dedupe
→ conflict detection
→ poison/sensitivity checks
→ TTL
→ promotion
```

---

# 20. Capability OS + Tool Gateway

**KEEP, simplify.**

Do not reintroduce a separate Tool Hub.

Canonical path:

```text
Agent
→ capability discovery
→ permission/policy
→ credential/provider selection
→ execution
→ normalized result
→ ActionReceipt / Evidence
```

Capability = what must be done.  
Provider = who performs it.

---

# 21. Provider-neutral connections + MCP per organization

**KEEP.**

Provider connection contract:

- provider
- organization_id
- scopes
- auth guard
- callback validation
- token lifecycle
- revocation
- health

External MCP is tenant-scoped:

```text
organization
→ MCP server
→ allowed tools
→ permissions
→ trust
→ authentication
→ health
→ risk
```

AI provider catalog may include:

- Google / Gemini
- OpenAI
- Anthropic
- Groq
- NVIDIA
- Requesty
- OpenRouter
- future providers

Google/Gemini is first-class, but agent identity remains provider-neutral.

---

# 22. Social + Content

**KEEP, with strict ownership.**

## Social Brain / Social OS

Owns:

- metrics
- performance analysis
- audience/channel intelligence
- opportunity detection
- learning
- recommendations

## Content OS / Studio

Owns:

```text
research
→ idea
→ copy
→ image/video
→ review
→ approval
→ publication
```

Rule:

```text
SOCIAL ANALYZES AND LEARNS
CONTENT CREATES AND PUBLISHES
```

---

# 23. Voice / Phone

**KEEP.**

Inbound:

```text
call
→ identify customer
→ CRM context
→ AI conversation
→ tools
→ result
→ CRM record
→ human handoff when required
```

Outbound:

```text
lead
→ AI call
→ conversation
→ outcome
→ CRM update
→ follow-up
```

Reconcile the current runtime before replacing providers.

---

# 24. Commerce + Billing

**KEEP.**

Commerce:

- products
- orders
- customers
- inventory where justified
- Nuvemshop current integration
- Shopify / VTEX future

Billing:

- subscriptions
- plans
- entitlements
- usage
- payments
- Stripe/provider adapters

Future providers must not block the core.

---

# 25. Finance / ERP-light / People / Procurement

**KEEP, but scope progressively.**

Do not attempt to build a full SAP-class ERP before product need exists.

Initial backoffice scope:

- vendors
- expenses
- invoices
- payments
- orders
- settlement
- basic finance
- people / departments / ownership
- procurement workflows

Expand only when justified.

---

# 26. Legal / Privacy / Compliance

**KEEP.**

Covers:

- GDPR / LGPD
- consent
- retention
- deletion/anonymization policy
- sensitive data
- agent action policy
- audit
- legal impact classification

Regulatory Watch remains future-capable:

```text
detect
→ propose
→ human approval for critical changes
```

---

# 27. Notifications + Operations

**KEEP.**

Notification Router decides:

- who
- why
- priority
- when

Delivery layer handles:

- in-app
- push
- email
- channel-specific delivery

Ops Center shows business/runtime problems:

- WhatsApp offline
- provider failures
- campaign stalled
- workflow stuck
- SLA overdue
- business agent failures
- cost/quota incidents

Do not show Nexus engineering internals here.

---

# 28. Observability

**KEEP.**

Track:

- agents
- workflows
- runs
- actions
- ActionReceipts
- tokens
- costs
- provider health
- queue backlog
- campaigns
- SLA
- errors
- business outcomes

Trace metadata ON by default.  
Sensitive trace content OFF by default.

---

# 29. Knowledge Graph + Digital Twin + A2A

## Enterprise Knowledge Graph

Keep in backlog. It is a projection/retrieval layer, not business truth.

## Digital Twin

Keep for testing elevated autonomy with fake/sandbox business data. Not an early blocker.

## A2A

Keep only the business-agent delegation needed by real use cases. Do not build a giant protocol before demand exists.

---

# 30. BrowserMesh

**MOVE TO NEXUS.**

Lumenva may request a browser capability:

```text
Lumenva
→ capability request
→ Nexus / BrowserMesh
→ execution
→ result + evidence
→ Lumenva
```

Do not embed the browser execution plane inside Lumenva.

---

# 31. Project Factory

**SPLIT.**

Move to Nexus:

```text
mission
→ architecture
→ code
→ tests
→ deploy
```

Keep in Lumenva only business creative production:

- campaigns
- posts
- images
- videos
- landing/sales material

---

# 32. Engineering Control Plane / technical hooks / compute

**MOVE TO NEXUS.**

Nexus owns:

- branch/worktree engineering
- Codex / Claude / Jules technical work
- engineering tests/PR/merge automation
- technical compute routing
- engineering hooks
- technical sandbox
- BrowserMesh
- computer/terminal/filesystem execution

Lumenva still has normal CI/CD as a software repository, but intelligent engineering orchestration belongs to Nexus.

---

# 33. Workforce split

## Lumenva workforce

Business roles:

- sales
- support
- marketing
- social
- finance
- operations

## Nexus workforce

Technical roles:

- engineering
- QA
- DevOps
- architecture
- technical browser/computer execution

---

# 34. Security split

## Lumenva

Business-agent security:

- tenant isolation
- least privilege
- RLS
- tool permissions
- approvals
- egress policy
- DLP
- spend limits
- prompt-injection defense
- memory safety
- incident containment

## Nexus

Technical execution isolation:

- terminal
- filesystem
- code
- browser
- machine access
- engineering secrets

---

# 35. What is explicitly removed from Lumenva V2.1 architecture

- desktop/.exe product
- Cloudflare as mandatory parallel agent plane
- technical Maestri responsibilities
- BrowserMesh internals
- technical Compute Fabric
- Engineering Control Plane
- software Project Factory
- engineering hooks
- duplicate queues
- duplicate schedulers
- separate Tool Hub
- separate Lumenva Brain
- separate Agent Browser
- conflicting legacy auth architectures
- unlimited autonomy
- always-on agent fleet
- all-skills-loaded behavior

---

# 36. Canonical roadmap V2.2

The V2.1 roadmap of 53 phases plus extension tracks is consolidated into 26 phases.

## Phase 0 — Current Truth

- baseline current code
- current tests/builds
- resolve current CI/documentation drift
- handle PR #74 without weakening gates
- inventory implemented vs planned

## Phase 1 — Canonical V2.2 Documentation

Create/maintain:

- canonical blueprint
- canonical implementation plan
- sources/lineage
- changelog

Old plans become historical references only.

## Phase 2 — Google Foundation

Establish:

- Firebase Auth
- Cloud SQL
- Cloud Storage
- Cloud Run
- Pub/Sub
- Cloud Tasks
- Cloud Scheduler
- Secret Manager
- Logging/Monitoring
- backup/DR

## Phase 3 — Tenant / Identity / Permissions

Canonical flow:

```text
Firebase identity
→ organization membership
→ role
→ permissions
→ PostgreSQL/RLS
```

## Phase 4 — Operating Core

Consolidate:

- organization_id
- event_log
- job_queue
- approvals
- audit
- evidence
- ActionReceipt
- bounded leasing validation

## Phase 5 — CRM Core

Close the core CRM data model and flows.

## Phase 6 — Unified Inbox

Normalize channels, assignments, handoff and SLA.

## Phase 7 — Durable Workflow Engine

Implement one durable business execution engine.

## Phase 8 — Event Resume + ActionReceipt

Implement:

- external_event_inbox
- same-run resume
- idempotency
- retry boundaries
- compensation
- receipts

## Phase 9 — CRM Automation

Consolidate triggers, follow-ups, tasks, pipeline actions and notifications.

## Phase 10 — Capability OS + Tool Gateway

Consolidate capabilities, providers, tools, MCP, permissions, credentials and health.

## Phase 11 — Agent Platform

Implement Agent Identity, Builder, Birth, Certification, Autonomy/Risk and minimum reputation.

## Phase 12 — Context + Memory

Implement Context Lifecycle, fresh context, memory namespaces and Memory Firewall.

## Phase 13 — Evidence + Approval

Consolidate Evidence, receipts, approvals, audit and relevant artifacts.

## Phase 14 — Customer Service Intelligence

Implement:

- Case Management
- Approved Responses
- Media Completion Barrier
- SLA/escalation

## Phase 15 — Campaign Engine

Implement messaging campaign execution and safety controls.

## Phase 16 — Attribution

Implement campaign/source/touchpoint/conversion attribution.

## Phase 17 — Voice

Reconcile and close the current voice runtime.

## Phase 18 — Social + Content

Finalize ownership boundaries and production flows.

## Phase 19 — Commerce + Billing

Close Nuvemshop/products/orders/payments/billing/entitlements.

## Phase 20 — Business Backoffice

Progressively implement Finance, ERP-light, People, Procurement and compliance needs.

## Phase 21 — Safety + Evals

Implement:

- Shadow Mode
- evals
- trust
- egress/DLP
- business-agent sandbox
- Digital Twin when justified

## Phase 22 — Operations

Consolidate notifications, observability, costs, quotas, incidents and Ops Center.

## Phase 23 — Nexus Integration

Define stable contracts for:

- BrowserMesh
- technical execution
- engineering
- software Project Factory
- technical agents/compute

Lumenva consumes capabilities; it does not absorb these systems.

## Phase 24 — Business Command Center

Deliver the consolidated business-facing operating UI.

## Phase 25 — Production Completion Gate

A capability is DONE only when it has:

- implementation
- tests
- security
- tenant isolation
- policy
- evidence
- observability
- rollback/recovery
- documentation
- CI green
- production proof when applicable

---

# 37. V2.1 open loops mapped into V2.2

| V2.1 open loop | V2.2 destination |
|---|---|
| PR #74 | Phase 0 |
| Maestri blueprint → code | split Business Orchestration vs Nexus |
| Capability OS + Tool Gateway | Phase 10 |
| Google cutover | Phase 2 |
| Browser requirements → BrowserMesh | Phase 23 / Nexus |
| Phone/FDE | Phase 17 |
| bounded leasing | Phase 4 |
| ActionReceipt | Phase 8 |
| external_event_inbox | Phase 8 |
| trace policy | Phase 22 |
| ERP/Oryh | Phase 20, reduced scope |
| Agent API | Phase 10/11 |
| Context Lifecycle | Phase 12 |
| CRM Automation | Phase 9 |
| Campaign Engine | Phase 15 |
| Attribution | Phase 16 |
| Case Management | Phase 14 |
| Approved Responses | Phase 14 |
| Media Completion Barrier | Phase 14 |
| external MCP/providers | Phase 10 |
| Follow-up gaps | Phase 9 |
| docs drift | Phase 0/1 |

No V2.1 open loop is left without an owner or destination.

---

# 38. Final canonical rules

```text
LUMENVA = OPERATE THE BUSINESS

NEXUS = BUILD AND OPERATE THE TECHNOLOGY

GOOGLE = PRIMARY CLOUD PLATFORM

FIREBASE AUTH = IDENTITY TRUTH

POSTGRESQL = BUSINESS TRUTH

WORKFLOW ENGINE = DURABLE BUSINESS EXECUTION

BUSINESS AGENTS = LUMENVA

TECHNICAL AGENTS = NEXUS
```

For every new capability:

```text
DISCOVER
→ MAP OWNER
→ REUSE?
→ DESIGN CONTRACT
→ IMPLEMENT
→ TEST
→ SECURITY
→ EVIDENCE
→ CI
→ PRODUCTION PROOF
```

For autonomy:

```text
SHADOW
→ EVIDENCE
→ EVAL
→ POLICY
→ APPROVAL
→ PROMOTION
```

Nothing becomes DONE because the blueprint says it should exist.
