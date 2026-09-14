# LUMENVA — MASTER CONSOLIDATION PLAN V3

> Status: PLAN ONLY — isolated branch, no implementation and no merge to `main`.
>
> Repository: `trydavidqix/Lumenva`
>
> Base: `main` at `17411bba65e737ce2ec6cc4bb4f338ebe92d29c9`
>
> Branch: `plan/lumenva-master-consolidation-v3-2026-09-14`
>
> This document consolidates the current repository audit plus the architectural decisions made during planning. Before implementation, every assumption must be revalidated against the actual repository, production runtime, Mac control plane, Linux worker and VPS. The plan is not the truth; the current system state is the truth.

---

## 1. Objective

Consolidate the Lumenva architecture into one canonical system without rebuilding the product from zero.

The target is to preserve and integrate the work already present across `main` and the relevant architecture/implementation branches, remove overlapping responsibilities, define canonical ownership for memory/knowledge/personality/runtime, separate engineering agents from customer-facing product agents, and make GitHub the single source of truth for versioned code.

The final system is divided into three planes:

```text
┌──────────────────────────────────────────────────────────┐
│                  1. ENGINEERING PLANE                    │
│                                                          │
│ OWNER → CLAUDE CEO → CTO CODEX → CODEX CLOUD/WORKERS    │
│                              ↓                           │
│                            GitHub                        │
└──────────────────────────────────────────────────────────┘

                           │ develops
                           ▼

┌──────────────────────────────────────────────────────────┐
│                   2. PRODUCT AGENT OS                    │
│                                                          │
│ Event/Customer → Supervisor → Product Agents → Actions   │
│                        │                                 │
│                  Memory / RAG / Tools                    │
└──────────────────────────────────────────────────────────┘

                           │ learns
                           ▼

┌──────────────────────────────────────────────────────────┐
│                    3. LEARNING PLANE                     │
│                                                          │
│ Evidence → Hermes → Candidate → Evaluation → Promotion  │
│                                  ↓                       │
│                    Rule / Skill / Knowledge / Memory     │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Structural rule: engineering agents are not product agents

Never merge these two agent families conceptually or technically.

Engineering/control plane:

```text
OWNER
  ↓
CLAUDE CEO
  ↓
CTO CODEX
  ↓
CODEX CLOUD / WORKERS
```

Product/customer plane:

```text
Supervisor
Atendimento
Sales
Retention
Escalation
CRM Operator
Governance Judge
```

Claude CEO, CTO Codex and Codex workers do not automatically inherit access to customer memory just because they are technical operators. Customer data must only be exposed to engineering tasks when genuinely required and should be sanitized/minimized wherever possible.

---

## 3. Infrastructure source-of-truth model

Target infrastructure:

```text
MAC
│
├── ~/.claude/
├── ~/.codex/
├── ~/.ssh/
└── ~/Desktop/CRM/.maestri/
     control plane only

GITHUB
└── single source of truth for versioned project code/docs/rules

CODEX CLOUD
└── engineering execution
    tests
    branches
    pull requests

VPS
└── production/runtime only

LINUX WORKER
└── temporary migration source
    retired after validation
```

The Mac must not retain a permanent clone of Lumenva after migration is complete.

---

## 4. PHASE 0 — freeze and inventory

Before changing architecture, do a read-only audit.

Audit:

```text
Mac
Linux worker
GitHub
VPS
branches
worktrees
uncommitted changes
untracked files
configs
docs
agents
sessions
runtime dependencies
```

Output:

```text
CURRENT STATE
TARGET STATE
MIGRATION MAP
BRANCH MAP
CONFLICT MAP
DEPENDENCY MAP
```

Forbidden during this phase:

```text
rm -rf
git clean
git reset --hard
force push
merge to main
production mutation
Linux shutdown
VPS service shutdown
silent conflict resolution
```

---

## 5. PHASE 1 — preserve the Linux source

Audit the Linux worker, especially:

```text
/home/claude/src/Lumenva
/home/claude/src/lumenva-social
/home/claude/src/worktrees
other Lumenva-related checkouts/worktrees
```

Inspect:

```text
git status
git remote -v
git branch -avv
git worktree list
git log
git diff
git diff origin/main
git stash list
untracked files
ignored-but-legitimate project assets
```

Preserve legitimate work in migration branches. Never use direct `git add . && git push origin main` as a migration strategy.

Each branch/worktree must be classified as:

```text
ALREADY IN GITHUB
NEEDS MIGRATION
ARCHIVE
OBSOLETE BUT PRESERVE
GENERATED / JUNK
UNKNOWN — INVESTIGATE
```

Secrets must never be committed.

---

## 6. PHASE 2 — GitHub becomes the definitive versioned source

After migration and verification:

```text
GitHub = canonical versioned source
```

Mac, Linux, VPS, Claude sessions and Codex sessions are never authoritative sources of versioned code.

Expected engineering flow:

```text
GitHub branch
      ↓
Codex Cloud
      ↓
implementation
      ↓
tests
      ↓
diff/evidence
      ↓
PR
      ↓
review
      ↓
main
```

---

## 7. PHASE 3 — consolidate the Business OS / Operating Core

Relevant branch family includes:

```text
business-os/wave-1-agent-contracts-2026-09-11
business-os/wave-1-operating-core
business-os/wave-1-operating-core-cli-2026-09-11
business-os/wave-1-operating-core-equivalence-2026-09-11
business-os/wave-1-operating-core-evidence-2026-09-11
business-os/wave-1-event-adapter-2026-09-11
business-os/wave-1-job-engine-events-2026-09-11
business-os/wave-1-policy-edges-2026-09-11
business-os/wave-1-mcp-surface-2026-09-11
business-os/wave-1-acceptance-2026-09-11
```

Do not blindly merge all historical branches.

Use:

```text
AUDIT
  ↓
DIFF
  ↓
SELECT CANONICAL IMPLEMENTATION
  ↓
PORT
  ↓
TEST
  ↓
REVIEW
  ↓
CANONICALIZE
```

Canonical architecture documentation should converge toward:

```text
docs/architecture/
├── CURRENT_ARCHITECTURE.md
├── TARGET_ARCHITECTURE.md
├── AGENT_OS.md
├── MEMORY_OS.md
├── LEARNING_OS.md
└── ENGINEERING_CONTROL_PLANE.md
```

---

## 8. PHASE 4 — Agent Registry

Use the current `product-agents/definitions.ts` model as a source, but converge on one canonical `AgentDefinition` contract.

Each agent definition should describe:

```text
id
name
role
purpose
persona
capabilities
skills
tools
memory policy
knowledge policy
channel policy
voice policy
risk policy
learning policy
model policy
```

Do not scatter canonical agent identity across unrelated files.

---

## 9. PHASE 5 — Agent Birth

Consolidate the implementation from the `business-os/wave-2-agent-birth-2026-09-11` family, including the existing `product-agents/birth.ts` work.

Target lifecycle:

```text
AgentDefinition
      ↓
Agent Birth
      ↓
Validation
      ↓
Profile
      ↓
Capabilities
      ↓
Skills
      ↓
Policies
      ↓
Memory Policy
      ↓
Tool Policy
      ↓
Persona
      ↓
Channel Policy
```

Agent creation must become reproducible and inspectable.

---

## 10. PHASE 6 — Instruction Compiler

Consolidate the `business-os/wave-2-agent-migration-2026-09-11` / prompt-compiler work rather than inventing a new hierarchy.

Target precedence:

```text
SYSTEM / SECURITY
        ↓
OWNER / ORGANIZATION
        ↓
BUSINESS POLICY
        ↓
AGENT ROLE
        ↓
AGENT PERSONA
        ↓
CHANNEL POLICY
        ↓
CUSTOMER CONTEXT
        ↓
TASK
        ↓
SESSION CONTEXT
```

Lower layers must never override higher-level security, organizational or governance policy.

---

## 11. PHASE 7 — Session Runtime

Consolidate:

```text
business-os/wave-3-session-runtime
business-os/wave-3-session-runtime-mvp-2026-09-11
```

Target session construction:

```text
Agent
 ↓
Tenant
 ↓
Customer
 ↓
Channel
 ↓
Memory
 ↓
Knowledge
 ↓
Policies
 ↓
Tools
 ↓
Model
 ↓
Session
```

The Session Runtime prepares context and dependencies; the Kernel executes the agent lifecycle.

---

## 12. PHASE 8 — Agent Kernel

The Agent Kernel becomes the generic operational core.

```text
SESSION RUNTIME
       ↓
AGENT KERNEL
       ↓
Resolver
       ↓
Action
       ↓
Evidence
```

Responsibilities:

```text
context lifecycle
tool execution
decision lifecycle
policy enforcement
evidence
errors
telemetry
result handling
```

Do not embed Sales-specific or Atendimento-specific personality/business logic directly in the Kernel.

---

## 13. PHASE 9 — canonical Product Agents

Initial canonical set from the current system:

```text
Supervisor
Atendimento
Sales
Retention
Escalation
CRM Operator
Governance Judge
```

### Supervisor

Responsibilities:

```text
understand request
classify intent
select agent
route minimum required context
coordinate transitions
```

The Supervisor should not become a monolithic agent that solves every task itself.

### Atendimento

```text
questions
support
information
triage
general conversation
```

### Sales

```text
lead handling
qualification
opportunity
commercial offer
follow-up
pipeline progression
```

### Retention

```text
churn prevention
recovery
relationship
reactivation
retention
```

### Escalation

```text
sensitive situations
human handoff
risk
conflict
failure
incident
```

### CRM Operator

Structured executor for CRM operations:

```text
Agent intent
   ↓
CRM Operator
   ↓
authorization validation
   ↓
execution
   ↓
evidence
```

### Governance Judge

Evaluates:

```text
policy
risk
quality
compliance
evidence
decision correctness
```

It is not a normal customer-service agent.

---

## 14. PHASE 10 — Memory OS

Use the existing `mvp/memory-os` work as an implementation source.

Canonical truth model:

```text
POSTGRES / CRM
│
├── org_memory
├── customer_memory
├── agent_memory
├── episodic events / provenance
└── official CRM data
```

Postgres/CRM remains the operational source of truth.

### org_memory

Tenant-wide rules and learned facts that legitimately apply to the organization as a whole.

### customer_memory

Omnichannel customer/contact memory. WhatsApp, voice, web, email and future channels must resolve to the same logical customer memory rather than creating per-channel copies.

### agent_memory

Private agent + contact memory, used only when the information is genuinely agent-specific. If the information should be shared, promote it to customer memory or org memory rather than duplicating it.

The known runtime gap around `agent_memory` must be audited and resolved, not replaced by another parallel memory subsystem.

---

## 15. Graphiti / Neo4j

Role:

```text
relations
time
events
entities
temporal history
graph context
```

Graphiti is a derived temporal/relationship layer.

```text
Graphiti ≠ source of truth
```

The system must remain able to reconstruct official state without relying on Graphiti as the authoritative database.

---

## 16. Mem0

Role:

```text
semantic extraction
semantic recall
retrieval convenience
behavior/preference search
```

Contract:

```text
Mem0 = optional derived semantic projection
Mem0 ≠ source of truth
```

If Customer Memory + Graphiti + RAG eventually make Mem0 redundant, it must be removable without destroying official data.

---

## 17. Obsidian Knowledge Vault

Obsidian is human knowledge, not customer memory.

Target Mac structure:

```text
~/Desktop/CRM/Knowledge/Lumenva/
├── .obsidian/
├── 00-index/
├── company/
├── products/
├── policies/
├── sales/
├── support/
├── operations/
├── research/
└── archive/
```

Obsidian stores:

```text
policies
FAQ
processes
playbooks
product knowledge
sales knowledge
support knowledge
research
human decisions
```

It must not store:

```text
customer operational memory
credentials
API keys
tokens
real .env files
private runtime state
```

Publishing lifecycle:

```text
DRAFT
  ↓
REVIEW
  ↓
PUBLISHED
  ↓
sanitation
  ↓
RAG ingestion
```

Only `PUBLISHED` knowledge can feed canonical RAG ingestion.

Claude must not preload the entire vault; retrieval should be on-demand and limited to relevant notes.

---

## 18. RAG / pgvector

RAG retrieves published organizational knowledge such as:

```text
documentation
policies
FAQ
products
procedures
knowledge base
```

RAG is not Customer Memory.

RAG indexes are derived from canonical published knowledge and can be rebuilt.

---

## 19. LlamaIndex

Keep LlamaIndex as an optional ingestion/chunking adapter only where it has proven value.

It must not become a second source of truth competing with the canonical RAG/knowledge model.

---

## 20. Graphify

Graphify belongs to the engineering plane.

Purpose:

```text
code map
files
functions
imports
dependencies
architecture
impact analysis
```

Graphify is not Customer Memory, not agent personality and not business knowledge.

---

## 21. PHASE 11 — Personality OS

Do not overload one `personality` field with unrelated concepts.

Canonical separation:

```text
PERSONA
   ↓
CONVERSATION STYLE
   ↓
VOICE DELIVERY
   ↓
RUNTIME AFFECT
```

### Persona

Persistent identity:

```text
who the agent is
role temperament
stable communication traits
professional identity
```

Examples:

```text
calm
competent
polite
analytical
patient
```

### Conversation Style

How the agent communicates textually:

```text
sentence length
humor
vocabulary
formality
question style
text rhythm
```

Use the existing `feat/voice-personality-patter-inline` work as a source rather than creating another parallel implementation.

---

## 22. PHASE 12 — Voice OS

Consolidate the existing voice/personality work including concepts represented by files such as:

```text
conversation-style.ts
delivery-style.ts
voice-output-policy.ts
```

Separate:

```text
Voice Identity
Voice Delivery
Voice Output Policy
```

Voice Delivery can include:

```text
pace
pauses
emphasis
energy
warmth
confidence
```

Channel-specific delivery must not mutate the stable persona definition.

---

## 23. PHASE 13 — Runtime Affect / sentiment

The existing sentiment work is a starting point for a temporary runtime-affect layer.

Example conceptual state:

```json
{
  "confidence": 0.84,
  "warmth": 0.77,
  "urgency": 0.21,
  "formality": 0.36,
  "empathy": 0.81
}
```

This is session/context state, not permanent personality memory.

For example, an upset customer may temporarily cause:

```text
urgency ↑
empathy ↑
```

without permanently changing the agent persona.

---

## 24. PHASE 14 — Channel Layer

The logical agent is independent of channel.

```text
Agent
  ↓
Agent Output
  ↓
Channel Adapter
```

Adapters include:

```text
WhatsApp
Instagram
Facebook
Email
Web
Voice
```

The same Sales agent may express the same intent differently over voice, WhatsApp or email while retaining the same underlying role and business policy.

---

## 25. PHASE 15 — Tools / Capability System

Do not give every agent every tool.

Use explicit capabilities such as:

```text
can_read_contact
can_write_contact
can_send_message
can_create_deal
can_refund
can_publish
can_schedule
can_escalate
```

Examples:

```text
Sales
├── limited CRM read/write
├── calendar
└── messaging

Governance Judge
├── audit
├── policy
└── evidence
```

Least privilege must be enforced by the runtime/tool boundary, not only by prompt instructions.

---

## 26. PHASE 16 — Evidence OS

Every material action must have evidence.

```text
REQUEST
  ↓
DECISION
  ↓
ACTION
  ↓
RESULT
  ↓
EVIDENCE
```

Core doctrine:

```text
CLAIM ≠ EVIDENCE
ACTIVITY ≠ SUCCESS
AGENT REPORT ≠ PROOF
```

Evidence should be machine-verifiable wherever practical.

---

## 27. PHASE 17 — Risk + Approval

Integrate with the Business OS risk model:

```text
R0
R1
R2
R3
R4
```

Conceptual policy:

```text
R0/R1 → automatic
R2    → policy controlled
R3    → explicit approval
R4    → Owner / Security
```

Exact mappings must be validated against the actual existing policy implementation before changing behavior.

---

## 28. PHASE 18 — Hermes Learning OS

Use the existing `design/hermes-unified-learning-os-2026-09-13` architecture as the source for consolidation.

Learning flow:

```text
OUTCOME
   ↓
FEEDBACK
   ↓
HERMES
   ↓
CANDIDATE LEARNING
   ↓
EVALUATION
   ↓
TEST / SIMULATION
   ↓
GOVERNANCE
   ↓
PROMOTION
```

Lifecycle states:

```text
candidate
evaluating
approved
active
rejected
```

Hermes must not directly mutate production policy/personality/memory as truth.

It proposes candidate learnings.

Candidate types may include:

```text
FACT
MEMORY
SKILL
KNOWLEDGE
RULE
POLICY
PERSONA CANDIDATE
```

Each promoted result must be routed to its correct canonical owner.

---

## 29. PHASE 19 — Scenario Lab

Use the existing `feature/scenario-lab-council-oasis-2026-09-13` work as an implementation source.

Scenario Lab is an isolated evaluation environment for:

```text
prompts
agents
policies
personalities
strategies
tools
learning candidates
```

It must not write to live customer state while running simulations.

---

## 30. PHASE 20 — Council

Council is not in the hot path of every customer conversation.

Use it for complex deliberation:

```text
Scenario
   ↓
Council
   ↓
multiple perspectives/agents
   ↓
arguments
   ↓
evidence
   ↓
decision candidate
```

Potential use cases:

```text
architecture
strategy
policy
campaign planning
risk
complex planning
```

---

## 31. PHASE 21 — optional specialized packs

Architectures from branches such as:

```text
implementation/ai-creator-commerce-revenue-os-2026-09-13
wave10/mobile-compliance-guardian-2026-09-13
```

should remain modular unless they prove to be core runtime requirements.

Target pattern:

```text
Agent OS Core
   │
   ├── Commerce Pack
   ├── Creator Pack
   ├── Compliance Pack
   └── Future Packs
```

Do not contaminate the core with optional product-specific responsibilities.

---

## 32. PHASE 22 — Engineering Control Plane

Canonical hierarchy:

```text
OWNER
  ↓
CLAUDE CEO
  ↓
CTO CODEX
  ↓
CODEX WORKERS / CODEX CLOUD
```

### Claude CEO

Responsibilities:

```text
understand objective
decide strategy
decompose work
delegate
monitor
verify
report
```

Claude CEO is an orchestrator and does not become the primary implementation worker.

### CTO Codex

Responsibilities:

```text
technical architecture
technical planning
decomposition
worker selection
review
testing
security
integration
technical acceptance
```

The CTO does not redefine the Owner's business objective.

### Codex workers

Execution workforce for:

```text
implementation
tests
debugging
refactoring
migrations
documentation
security
QA
DevOps
```

Default worker preset currently intended for the control plane:

```text
CODEX_LUNA_MEDIUM
gpt-5.6-luna
reasoning: medium
```

Do not silently change provider/model/reasoning without explicit policy/Owner authorization.

---

## 33. PHASE 23 — Codex Cloud as the engineering factory

Target flow:

```text
Claude CEO
    ↓
CTO CODEX
    ↓
Task
    ↓
Codex Cloud
    ↓
GitHub branch
    ↓
implementation
    ↓
tests
    ↓
evidence
    ↓
PR
    ↓
CTO review
    ↓
CEO acceptance
```

A real end-to-end proof must be performed before declaring Codex Cloud operational:

```text
GitHub
→ Codex Cloud
→ isolated branch
→ controlled change
→ tests
→ diff
→ PR/evidence
```

The Mac should not need a permanent project clone for this cycle.

---

## 34. Claude Code local architecture

Target local Claude architecture:

```text
~/.claude/
├── CLAUDE.md
├── settings.json
├── rules/
│   ├── orchestration.md
│   ├── safety.md
│   ├── evidence.md
│   ├── context-budget.md
│   └── communication.md
├── skills/
├── hooks/
├── output-styles/
└── projects/
```

Ownership:

```text
~/.claude/CLAUDE.md
= minimal universal principles

~/.claude/rules/
= detailed global reusable rules

~/.claude/skills/
= procedural knowledge / how to act

~/.claude/hooks/
= deterministic automation scripts

~/.claude/output-styles/
= presentation/communication style

~/.claude/projects/
= sessions/history/automatic session memory
```

Do not put Lumenva-specific implementation details into the global Claude file.

---

## 35. Claude global CLAUDE.md

Keep it small.

It should contain only universal rules such as:

```text
Owner authority
Claude is orchestrator
Delegate implementation
Evidence before claims
Root-cause diagnosis
Never hide failure
Never expose secrets
No destructive action without authorization
Use minimum necessary context
Concise actionable communication
```

Project architecture belongs in the project repository.

---

## 36. Project CLAUDE.md / AGENTS.md / Rules / Skills

In the Lumenva repository:

```text
Lumenva/
├── CLAUDE.md
├── AGENTS.md
└── .claude/
    ├── rules/
    └── skills/
```

Use:

```text
CLAUDE.md = short project map + invariants
AGENTS.md  = portable agent-facing project doctrine
rules/     = detailed project rules
skills/    = project procedures / how-to workflows
```

Avoid duplicating the same content across `CLAUDE.md`, `AGENTS.md`, rules, skills, Obsidian, docs and handoffs.

For every duplicated concept, choose a canonical owner and replace redundant copies with references where appropriate.

---

## 37. Hooks architecture

Hooks are automation, not memory.

Target categories:

```text
SessionStart
→ minimum essential startup checks/context

PreToolUse
→ critical deterministic safety protections

PostToolUse
→ essential validation only

Stop
→ concise handoff/summary when useful

Notification
→ actionable alerts
```

Do not create hooks for every minor operation; excessive hooks increase latency, noise and maintenance cost.

---

## 38. Context-budget policy

Every agent/system gets only the context it needs.

```text
Global CLAUDE
→ minimal

Project CLAUDE
→ small

Rules
→ contextual/relevant

Skills
→ on demand

Obsidian
→ retrieval on demand

RAG
→ controlled top-k

Memory
→ relevant facts only

Graph
→ relevant entities/relations only

Session
→ recent window + compact summary
```

Never use:

```text
"information exists" → "put all of it in the prompt"
```

---

## 39. Memory ownership matrix

Canonical ownership:

```text
OFFICIAL CRM FACT
→ Postgres / CRM

TENANT-WIDE MEMORY
→ org_memory

CUSTOMER MEMORY
→ customer_memory

AGENT-PRIVATE CUSTOMER MEMORY
→ agent_memory

RELATIONS / TEMPORAL GRAPH
→ Graphiti derived projection

SEMANTIC MEMORY PROJECTION
→ Mem0 optional derived projection

HUMAN ORGANIZATIONAL KNOWLEDGE
→ Obsidian

PUBLISHED KNOWLEDGE RETRIEVAL
→ RAG / pgvector

CODE ARCHITECTURE KNOWLEDGE
→ Graphify / GitHub

PROCEDURE
→ Skill

MANDATORY BEHAVIORAL RULE
→ Rule

ENGINEERING SESSION HISTORY
→ Claude/Codex session systems

PERMANENT ENGINEERING DECISION
→ GitHub docs / ADR

TEMPORARY EMOTIONAL/CONVERSATIONAL STATE
→ Runtime Affect
```

A piece of information should have one canonical owner.

---

## 40. Memory promotion flow

When an agent learns something:

```text
session observation
      ↓
classification
      ↓
if temporary
→ session only

if agent-specific customer fact
→ agent_memory

if shared customer fact
→ customer_memory

if tenant-wide fact/rule
→ org_memory

if organizational knowledge
→ Obsidian/RAG

if technical decision
→ GitHub/ADR

if relation/time event
→ canonical event/CRM first
→ Graphiti as derived projection

if semantic projection
→ Mem0 only after canonical write
```

Derived systems must never silently become the sole copy of important facts.

---

## 41. What each product agent reads/writes

### Supervisor

Reads:

```text
organization policy
minimal customer/session context
routing metadata
```

Writes:

```text
routing decision
handoff metadata
evidence
```

### Atendimento

Reads:

```text
org memory
customer memory
relevant agent memory
relevant RAG knowledge
session context
```

Writes only authorized customer/agent memory changes with provenance.

### Sales

Reads:

```text
org memory
customer memory
commercial CRM data
sales RAG knowledge
session context
```

Writes authorized CRM and memory updates.

### Retention

Reads customer relationship history and relevant knowledge; writes authorized retention/relationship outcomes.

### Escalation

Reads case evidence and policy; writes handoff/incident evidence and escalation state.

### CRM Operator

Reads/writes official CRM state only through allowed capabilities and must return evidence.

### Governance Judge

Reads policy, action evidence and risk context; writes verdict/audit results rather than customer-facing content.

---

## 42. Engineering-agent memory

### Claude CEO

Long-term/permanent material:

```text
approved strategy
canonical architecture
Owner-approved operating policy
high-level organizational decisions
```

Persist permanent artifacts to GitHub/appropriate canonical stores rather than relying on session memory alone.

Session memory:

```text
current objective
open decisions
CTO handoffs
current gate/state
```

Do not load raw worker logs or customer memories by default.

### CTO Codex

Long-term engineering knowledge:

```text
architecture decisions
ADRs
engineering conventions
important incident lessons
validated technical policies
```

Session state:

```text
current plan
workers
branches
tests
blockers
evidence
```

Anything that must survive the session should be promoted to GitHub documentation/rules/skills/ADRs.

### Codex workers

Default memory should be short-lived and task-scoped.

Workers receive:

```text
ROLE
OBJECTIVE
SOURCE OF TRUTH
SCOPE
CONSTRAINTS
DEPENDENCIES
ACCEPTANCE CRITERIA
VALIDATION
EVIDENCE REQUIRED
```

Workers return:

```text
diff
tests
evidence
risks
result
```

A worker does not create permanent organization memory automatically.

---

## 43. PHASE 24 — Observability

Observe at minimum:

```text
agent
session
job
tool
LLM/model
tokens
cost
latency
errors
decision
risk
evidence
memory read
memory write
```

Correlate with identifiers such as:

```text
tenant
agent
session
request
trace
```

Do not log secrets or unnecessary sensitive customer payloads.

---

## 44. PHASE 25 — Agent Office

Runtime states:

```text
ACTIVE
WORKING
WAITING
BLOCKED
PAUSED
SLEEPING
ERROR
OFFLINE
```

The visual office is a projection of runtime truth, not the authoritative state itself.

---

## 45. PHASE 26 — Workforce Scheduler

Responsibilities:

```text
wake
sleep
shift
concurrency
resource
quota
priority
```

Job classes:

```text
TINY
LIGHT
NORMAL
HEAVY
EXCLUSIVE
```

Scheduling decisions must be observable and reversible.

---

## 46. PHASE 27 — Resource Router

Select execution host/provider based on:

```text
capability
cost
load
quota
latency
risk
availability
```

Possible targets:

```text
VPS
Codex Cloud
Linux compute while retained
Mac fallback
external provider
```

Do not silently change provider/model when Owner policy requires explicit control.

---

## 47. PHASE 28 — Session Usage / Quotas

Track provider usage for:

```text
Claude
Codex
Gemini
OpenRouter
other providers
```

State quality:

```text
official
estimated
unknown
```

Routing logic must distinguish measured usage from estimates.

---

## 48. PHASE 29 — Unified Inbox

Normalize channel events:

```text
WhatsApp
Instagram
Facebook
Email
Voice
Web
```

Flow:

```text
CHANNEL EVENT
      ↓
Normalize
      ↓
Contact resolution
      ↓
Conversation
      ↓
Supervisor
```

Customer memory remains channel-independent.

---

## 49. PHASE 30 — Contact 360

One logical customer/contact identity can aggregate:

```text
CRM data
conversations
deals
customer memory
preferences
events
consent
relationships
```

Every field must have provenance and tenant isolation.

---

## 50. PHASE 31 — Human Handoff

SLA model currently intended:

```text
0m
5m
15m
30m
```

Handoff packet should include:

```text
summary
customer context
problem
attempts
risk
suggested next action
evidence
```

Do not dump full raw context when a concise handoff is sufficient.

---

## 51. PHASE 32 — Security, tenancy and privacy

Required invariants:

```text
tenant isolation
RLS where applicable
least privilege
auditability
secret isolation
RGPD/GDPR alignment
```

Audit documentation drift such as stale LGPD naming/content versus the intended RGPD/GDPR doctrine without renaming harness-dependent paths blindly.

Special memory/privacy rule:

`shadow` mode must not be assumed to mean "no data leaves the system". If a provider still receives data during shadow execution, the privacy effect must be treated as real provider processing even if the result does not influence the prompt.

---

## 52. PHASE 33 — Testing

Required layers:

```text
unit
integration
contract
policy
security
migration
agent simulation
scenario
E2E
```

Agent-specific tests should include:

```text
golden conversations
adversarial conversations
tool failure
memory contamination
cross-tenant leakage
prompt injection
policy bypass
hallucinated action
wrong-agent routing
incorrect memory promotion
voice/persona drift
runtime affect persistence bugs
```

---

## 53. PHASE 34 — branch consolidation strategy

Create an isolated integration branch when implementation begins, for example:

```text
integration/agent-os-consolidation
```

Port incrementally:

```text
Wave 1 / Operating Core
        ↓
Agent Birth
        ↓
Instruction Compiler
        ↓
Session Runtime
        ↓
Kernel integration
        ↓
Memory OS
        ↓
Personality
        ↓
Voice
        ↓
Runtime Affect
        ↓
Hermes
        ↓
Scenario/Council
```

Each step:

```text
PORT
  ↓
TEST
  ↓
COMMIT
  ↓
REVIEW
  ↓
VERIFY EVIDENCE
  ↓
NEXT
```

Do not mechanically merge every old branch.

---

## 54. PHASE 35 — canonical main

Only after the consolidated branch passes all gates:

```text
integration/agent-os-consolidation
       ↓
full tests
       ↓
security review
       ↓
architecture review
       ↓
acceptance evidence
       ↓
PR
       ↓
Owner approval
       ↓
main
```

No automatic merge to `main` during consolidation.

---

## 55. PHASE 36 — retire the Linux worker

Linux may only become dispensable when all of the following are verified:

```text
GitHub contains all legitimate versioned work
Codex Cloud works end-to-end
Mac control plane works without local checkout
VPS production remains healthy
production deploy is traceable to GitHub SHA
no job depends on Linux
no cron depends on Linux
no secret/dependency exists only on Linux
no unique branch/worktree/file remains
```

Then:

```text
final inventory
      ↓
backup/checksum
      ↓
shutdown Linux
      ↓
observation period
      ↓
report: LINUX SAFE TO RETIRE
```

Do not delete/destroy the machine without explicit Owner approval.

---

## 56. Mac final state

Target Mac state:

```text
~/.claude/
~/.codex/
~/.ssh/

~/Desktop/
├── CRM/
│   ├── .maestri/
│   └── Knowledge/Lumenva/
└── Pessoais/
```

No permanent Lumenva source checkout.

Before moving/removing anything from Desktop, inspect it first.

Special protections include:

```text
~/.claude
~/.codex
~/.ssh
~/Desktop/CRM/.maestri
recovered Claude CEO session
recovery backups
unknown folders such as scratch/council material until identified
```

Unknown items are never deleted just to make the Desktop visually clean.

---

## 57. VPS final state

VPS remains production/runtime only.

Target deploy relation:

```text
GitHub commit SHA
      ↓
deploy
      ↓
VPS
```

The system must always be able to answer:

> Which exact GitHub commit is running in production?

Before disabling any service, audit:

```text
systemd
Docker if present
Caddy
CRM
WAHA
Redis
scheduler
workers
ports
processes
paths
deploy mechanisms
cron
DB connections
dependencies
```

Classify:

```text
KEEP
MIGRATE
DISABLE LATER
REMOVE LATER
UNKNOWN — INVESTIGATE
```

No production service is disabled during the planning/migration phase without explicit Owner authorization.

---

## 58. Canonical target architecture

```text
                     OWNER
                       │
                       ▼
                  CLAUDE CEO
                       │
                       ▼
                   CTO CODEX
                       │
                       ▼
                 CODEX CLOUD
                       │
                       ▼
                     GITHUB
                       │
            ───────────┼──────────
                       │
                       ▼
                LUMENVA AGENT OS
                       │
                 Agent Registry
                       │
                   Agent Birth
                       │
             Instruction Compiler
                       │
                Session Runtime
                       │
                  Agent Kernel
                       │
                    Resolver
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       MEMORY       KNOWLEDGE      TOOLS
          │            │            │
      Postgres         RAG          CRM
      Graphiti      Obsidian      WhatsApp
      Mem0                         Email
                                   Voice
          └────────────┬────────────┘
                       ▼
                PRODUCT AGENTS
                       │
    ┌──────────────────┼────────────────────┐
    ▼                  ▼                    ▼
Supervisor          Sales             Atendimento
Retention           CRM Op            Escalation
                       │
                Governance Judge
                       │
                       ▼
                   CHANNELS
                       │
                       ▼
                    CUSTOMER
                       │
                       ▼
                    EVIDENCE
                       │
                       ▼
                     HERMES
                       │
                       ▼
                LEARNING CANDIDATE
                       │
                       ▼
                SCENARIO / COUNCIL
                       │
                       ▼
                   EVALUATION
                       │
                       ▼
                  GOVERNANCE
                       │
                       ▼
                   PROMOTION
                       │
                       └────→ Agent OS
```

---

## 59. Implementation gates

### Gate 1 — Inventory

Complete consistent inventory of Mac, Linux, GitHub, VPS, branches, worktrees, agent systems and dependencies.

### Gate 2 — Backups

Validated non-destructive backups/checksums for critical migration sources.

### Gate 3 — Source preservation

All legitimate Linux work preserved in GitHub/migration branches.

### Gate 4 — Canonical branch map

Every relevant architecture branch classified as canonical source, superseded, archive or unrelated.

### Gate 5 — Operating Core

Wave 1/Operating Core contracts, events, policies and evidence consolidated.

### Gate 6 — Agent lifecycle

Registry + Birth + Instruction Compiler + Session Runtime + Kernel integrated and tested.

### Gate 7 — Memory OS

Memory ownership is unambiguous, agent_memory runtime gap resolved, no competing source of truth.

### Gate 8 — Personality/Voice

Persona, conversation style, voice delivery and runtime affect are separate and tested.

### Gate 9 — Learning OS

Hermes candidate/evaluation/promotion path works without direct uncontrolled production mutation.

### Gate 10 — Scenario/Council

Simulation/council isolated from live customer state.

### Gate 11 — Engineering Cloud

Codex Cloud executes a real GitHub branch/test/PR cycle without Mac clone.

### Gate 12 — Main consolidation

Full tests, security review, architecture review, evidence and Owner approval before merge.

### Gate 13 — Mac control plane

Mac works without permanent Lumenva checkout.

### Gate 14 — Production traceability

VPS deploy maps to known GitHub SHA.

### Gate 15 — Linux independence

System operates correctly with Linux worker shut down.

Do not skip gates because the system merely "looks correct".

---

## 60. Absolute prohibitions during consolidation

```text
no rm -rf on project/data sources
no git clean
no git reset --hard
no force push
no direct migration push to main
no deletion of unaudited branches/worktrees
no silent conflict resolution
no silent overwrite of divergent versions
no secrets in GitHub/Obsidian/docs
no deletion of ~/.claude
no deletion of ~/.codex
no deletion of ~/.ssh
no deletion of .maestri
no deletion/recreation of recovered CEO session
no production service shutdown by assumption
no Linux deletion before validation
no acceptance of worker "done" as evidence
no invented test results
no customer-memory duplication by channel
no Graphiti/Mem0 becoming hidden sources of truth
no entire Obsidian vault preload into every prompt
no uncontrolled Hermes self-modification
```

---

## 61. Approval boundaries

Autonomous allowed work can include:

```text
read-only investigation
inventory
comparison
hashes/checksums
non-destructive backups
migration branches
commits to isolated migration/integration branches
push to those branches
tests
analysis
documentation
secret scanning
Codex Cloud validation
PR creation
```

Stop for Owner approval before:

```text
merge to main
definitive deletion
Linux shutdown/removal
VPS service shutdown
production mutation
irreversible operations
business-behavior-changing conflict resolution
recovery deletion
removal of material whose purpose is still uncertain
```

---

## 62. Evidence and reporting

At the end of each gate report compactly:

```text
FEITO
VERIFICADO
BLOQUEADO
PRECISO DE VOCÊ
```

Final report must include:

```text
BEFORE
AFTER
GITHUB MAIN SHA
PRs
branches preserved
worktrees preserved
files migrated
files archived
files kept locally
files proposed for deletion
VPS services kept
Codex Cloud state
Linux state
Desktop state
CEO/CTO state
remaining risks
```

Never report `FEITO` without evidence.

---

## 63. Final decision

This plan supersedes fragmented competing Agent OS plans as the master consolidation direction.

Historical and feature branches are not discarded. They become implementation sources to be mined, compared and consolidated into a single canonical line.

The goal is not to start another architecture.

The goal is to finish the architecture Lumenva has already been building by integrating:

```text
Business OS / Operating Core
Agent Registry + Birth
Instruction Compiler
Session Runtime
Agent Kernel
Memory OS
Personality OS
Voice OS
Runtime Affect
Evidence / Risk / Governance
Hermes Learning OS
Scenario Lab / Council
Engineering CEO → CTO → Codex Cloud
GitHub source of truth
VPS production traceability
Mac control plane
```

into one coherent, auditable and maintainable system.
