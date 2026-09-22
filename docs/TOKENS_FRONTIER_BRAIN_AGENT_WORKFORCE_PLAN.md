# Lumenva Frontier-Brain / Agent Workforce Plan

## Status
ACTIVE IMPLEMENTATION — dedicated branch: `TOKENS`

## Purpose
This plan defines the Lumenva AI-first workforce architecture for using premium frontier models for planning and critical review, while routing execution to the cheapest capable model that satisfies risk, quality, latency, quota, and cost constraints.

Core principle:

> Best Brain -> Plan -> Cheapest Capable Agent -> Execute -> Independent Strong Model -> Verify -> Evidence -> Learn

This plan is intentionally isolated in branch `TOKENS`. It must not modify `main`.

---

## 1. Target Architecture

```text
                         LUMENVA
                            |
                     COMMAND CENTER
                            |
                            v
                       MAESTRI
                            |
        +-------------------+-------------------+
        |                   |                   |
    COMPANY OS          AGENT OS          KNOWLEDGE OS
        |                   |                   |
        +-------------------+-------------------+
                            |
                     FRONTIER BRAIN
                Claude / Codex / Gemini
                            |
                        MASTER PLAN
                            |
                     CONTEXT ENGINE
                            |
                        TASK GRAPH
                            |
                     RESOURCE ROUTER
                            |
          +-----------------+------------------+
          |                 |                  |
       TIER 0            TIER 1             TIER 2
    deterministic        workers          professional
                        cheap LLMs
          +-----------------+------------------+
                            |
                     EXECUTION FABRIC
                            |
                      EVIDENCE ENGINE
                            |
                  INDEPENDENT REVIEW
                            |
                     PASS / ESCALATE
                            |
                          MEMORY
                            |
                     LEARNING ROUTER
                            |
                            +----> LOOP 24/7
```

---

## 2. Frontier Brain

Premium models think before the company acts.

Initial responsibilities:
- Claude: CEO / Strategy / Architecture / conflict resolution / critical acceptance.
- Codex Sol: deep technical planning, hard engineering, critical code review.
- Gemini Pro / Antigravity: multimodal planning, browser, research, Google ecosystem, independent verification.

A frontier planner produces a canonical `MasterPlan` before high-impact execution.

### MasterPlan contract

```yaml
master_plan:
  objective:
  business_context:
  assumptions:
  requirements:
  architecture:
  decisions:
  constraints:
  risks:
  dependencies:
  tasks:
  acceptance_criteria:
  validation_strategy:
  escalation_policy:
```

The MasterPlan becomes the source of truth for the job. Workers receive only the slices they need.

---

## 3. Maestri Task Graph

Maestri transforms MasterPlan tasks into a DAG with explicit dependencies.

```text
MASTER PLAN
    |
    +-- TASK-001 database
    +-- TASK-002 backend
    |      +-- depends TASK-001
    +-- TASK-003 frontend
    |      +-- depends TASK-002
    +-- TASK-004 tests
    +-- TASK-005 browser QA
    +-- TASK-006 security review
```

Each node contains:
- task_id
- objective
- depends_on
- executor constraints
- risk
- budget
- acceptance criteria
- evidence requirements
- context policy
- retry/escalation policy

---

## 4. Context Engine

Reuse and evolve the existing MCG/context work. Do not build a second token-saving system.

```text
MasterPlan
    +
TaskContract
    |
Context Resolver
    |
Instruction Resolver
    |
Code / Knowledge Retriever
    |
Memory Retriever
    |
Tool Resolver
    |
Token Budgeter
    |
ContextPacket
```

Progressive context levels:
- L0: TaskContract only
- L1: symbols / paths
- L2: relevant snippets
- L3: files / dependencies
- L4: expanded context only when necessary

Never send full sessions, entire vaults, or global tool catalogs by default.

---

## 5. Workforce Tiers

### TIER 0 — deterministic
Use no LLM when deterministic tools are sufficient:
- lint
- typecheck
- tests
- SQL/static checks
- scripted transforms
- schema validation

### TIER 1 — workers
Cheap/high-volume execution:
- DeepSeek
- MiniMax
- Qwen
- Codex Luna

Typical work:
- classification
- repetitive transforms
- tests
- docs
- low-risk coding
- bulk research processing

### TIER 2 — professional
More capable operational execution:
- Codex Terra
- Gemini / Antigravity
- Kimi

Typical work:
- normal feature implementation
- browser workflows
- frontend/visual tasks
- difficult but non-critical execution

### TIER 3 — frontier
Expensive, highest-value reasoning:
- Claude
- Codex Sol
- Gemini Pro

Typical work:
- strategy
- architecture
- decomposition
- critical debugging
- critical review
- acceptance of high-risk changes

---

## 6. Router Policy

The Resource Router chooses the executor from:

```text
capability
+ risk
+ task complexity
+ context size
+ available quota
+ historical success
+ latency
+ cost
+ provider health
= selected model/runtime
```

The objective is not simply the cheapest model.

The objective is:

> Select the lowest-cost executor that historically meets the required quality and risk threshold.

Premium planning is protected even under quota pressure because a bad plan can multiply downstream cost.

---

## 7. Escalation Ladder

```text
cheap worker
   |
  FAIL
   |
different cheap worker
   |
  FAIL
   |
professional model
   |
  FAIL
   |
frontier model
   |
  FAIL
   |
replan / human approval
```

Initial hard limits:

```yaml
max_worker_attempts: 2
max_professional_attempts: 1
max_frontier_attempts: 1
max_replans: 1
```

After the limit, mark `BLOCKED` or `WAITING_FOR_APPROVAL`.

No unbounded retry loops.

---

## 8. Independent Verification

The same model must not be the sole critical approver of its own work.

Examples:
- Codex implementation -> Antigravity verification
- DeepSeek implementation -> Codex review
- Gemini implementation -> Claude review

Prefer objective validation:

```text
LLM review
+
deterministic tests
+
runtime evidence
```

Tests and evidence outrank subjective model confidence.

---

## 9. ExecutionResult / Evidence Engine

No agent returns only `DONE`.

Canonical result:

```yaml
execution_result:
  status:
  summary:

  changes:
  files_changed:
  commits:

  validation:
  tests:
  lint:
  typecheck:
  browser:
  security:

  evidence:
  artifacts:
  logs:

  risks:
  known_issues:

  usage:
  input_tokens:
  cached_tokens:
  output_tokens:
  duration:
  estimated_cost:
```

Evidence relationship:

```text
Claim -> Evidence -> Source -> Artifact -> Task -> Trace
```

---

## 10. Quota Broker

Unified quota/status view:

```text
Claude Max -----------+
Codex Pro ------------+
Google AI Pro --------+--> Resource Router
AI Gateway balance ---+
provider health ------+
```

Initial quota states:
- GREEN: >50%
- YELLOW: 20–50%
- RED: 10–20%
- RESERVE: <10%

Frontier planning remains prioritized in YELLOW/RED. Reserve is for critical planning, blocked workflows, and high-risk review.

---

## 11. Unified PAYG Gateway

Use one gateway abstraction for PAYG/cheap models.

```text
                   AI GATEWAY
                       |
        +--------------+--------------+
        |              |              |
    DeepSeek        MiniMax          Qwen
        |              |              |
        +----------- Kimi ------------+
        |
        +------ GLM / future models
```

Responsibility split:
- Maestri selects model/capability.
- Gateway selects serving provider/fallback path.
- Gateway billing is separate from subscription quotas.
- Subscription-backed Codex/Claude/Google paths remain first-class adapters.

---

## 12. Department Model Strategy

### Executive / Strategy
- Planner: Claude
- technical co-planner: Codex Sol
- research/multimodal: Gemini Pro
- workers only after MasterPlan exists

### Engineering
- Architecture: Claude + Codex Sol
- standard implementation: Codex Terra
- low-risk/high-volume: cheap workers
- browser/E2E: Antigravity
- visual/frontend: Kimi
- critical review: independent frontier model

### Research
- Direction/synthesis: Gemini Pro or Claude
- bulk processing: DeepSeek
- technical validation: Codex
- browser work: Antigravity

### Marketing
- Strategy: Claude/Gemini
- content production: Gemini/cheap workers
- research: DeepSeek
- campaign-critical final review: Claude

### Sales
- playbooks/policies: frontier
- daily operation: worker models
- complex cases: professional/frontier escalation

### Customer Operations
- policies: frontier
- routine volume: DeepSeek/MiniMax
- difficult cases: Gemini/Claude
- human handoff governed by risk/policy

### Design / Frontend
- direction: Gemini/Claude
- visual/frontend worker: Kimi
- code implementation: Codex
- browser QA: Antigravity

### Backoffice
- process design: frontier
- documents/structured work: MiniMax
- bulk operations: DeepSeek

### Security
- threat reasoning: Claude/Codex Sol
- deterministic scanners first
- independent model review for critical changes
- human approval for production/destructive/secrets paths

---

## 13. Agent Identity Must Be Model-Agnostic

A logical agent is not a provider model.

Example:

```text
MarketingDirector
    |
    +-- identity
    +-- memory
    +-- skills
    +-- policies
    +-- permissions
    +-- tools
    +-- context policy
    +-- selected model at runtime
```

Changing from Codex to MiniMax must not destroy role identity, memory, task ownership, evidence, or state.

---

## 14. Learning Router

Persist per-execution observations:
- model
- provider
- task_type
- complexity
- risk
- success/failure
- retry count
- review outcome
- deterministic test outcome
- latency
- tokens
- cost

After enough samples, routing becomes evidence-driven.

Example:

```text
frontend_fix

Kimi
success 92%
cost low

Codex Terra
success 97%
cost higher

R1 -> Kimi
R3 -> Codex Terra
```

Do not optimize on tiny datasets. Keep status `UNVALIDATED` until minimum evidence thresholds are met.

---

## 15. Memory Is Not Context

```text
MEMORY STORE
    |
Retriever
    |
small relevant selection
    |
Context Engine
    |
ContextPacket
```

Never preload all organizational memory.

Memory promotion requires provenance and validation. Operational handoffs are not automatically corporate truth.

---

## 16. Engineering Worktree Isolation

```text
JOB-938
 |
 +-- Codex -> worktree/JOB-938-codex
 +-- Kimi  -> worktree/JOB-938-kimi
 +-- Antigravity -> validation only
```

Rules:
- no two writing agents share the same worktree concurrently
- no automatic merge to main
- diff + tests + evidence required before acceptance

---

## 17. Human Approval / Risk

Initial policy:
- R0: automatic
- R1: automatic + evidence
- R2: execution + independent verification
- R3: strong review + owner approval where required
- R4: owner approval + independent validation

Production changes, destructive actions, secrets, auth, critical infra, and high-impact financial actions remain governed.

---

## 18. Required Canonical Contracts

Implement or consolidate:
- MasterPlan
- TaskContract
- ContextPacket
- HandoffRequest
- ExecutionResult
- ResultDigest
- EvidenceBundle
- QuotaSnapshot
- CapabilitySnapshot
- ModelProfile
- ProviderHealth
- ReviewResult
- EscalationRecord
- RoutingDecision

Every contract must be typed, versioned, validated, and persisted where relevant.

---

## 19. Observability

Required trace identifiers:
- trace_id
- session_id
- job_id
- task_id
- turn_id
- span_id
- agent_id
- execution_id
- context_packet_id

Track:
- model/provider
- quota state
- context size
- tools exposed
- tool calls
- input/cached/output tokens
- latency
- retries
- cost
- acceptance criteria
- evidence coverage
- verifier outcome

Never persist secrets in traces.

---

## 20. Implementation Phases

```text
F0  Audit current Maestri / MCG / Agent OS
F1  MasterPlan contract
F2  TaskContract / ExecutionResult consolidation
F3  ContextPacket + Context Engine integration
F4  Progressive retrieval
F5  Lazy Tool Registry
F6  Model Registry
F7  AI Gateway adapter
F8  Claude/Codex/Gemini subscription adapters
F9  Quota Broker
F10 Resource Router V2
F11 Worker tier policies
F12 Escalation Engine
F13 Evidence Engine
F14 Independent Review
F15 Department / Agent profiles
F16 Worktree isolation
F17 Memory retrieval integration
F18 Observability / traces
F19 Cost + quota dashboard
F20 Agent Office integration
F21 Benchmark suite
F22 Learning Router
F23 Autonomous mode
F24 Gradual rollout
```

---

## 21. Benchmark Strategy

Before claiming one model is best for a role, compare equivalent tasks.

Minimum dimensions:
- success rate
- tests passed
- independent review
- retries
- tokens
- cached tokens
- latency
- cost
- context overflow
- tool-call failures

Suggested starter suite: ~20 representative tasks, then expand.

Do not hardcode marketing claims about provider superiority. Route on measured evidence plus current capabilities.

---

## 22. Safety / Operational Gates

Required:
- no unnecessary global tools
- hard cap every context source
- no full-session dumps across agents
- no automatic production deploy
- no automatic merge to main
- no secrets in evidence/traces
- deterministic checks before LLM review where possible
- bounded retries
- independent verification for high-risk tasks
- human approval for R3/R4 where policy requires it
- all PASS states backed by evidence

---

## 23. Target 24/7 Loop

```text
Goal
 |
Frontier Brain
 |
MasterPlan
 |
Maestri
 |
Task DAG
 |
Context Engine
 |
Resource Router
 |
Cheapest Capable Executor
 |
Evidence
 |
Independent Review
 |
PASS ---------> Memory / Metrics / Learning Router
 |
FAIL
 |
Escalate / Replan
```

A model can go offline, hit quota, or be replaced without killing the logical agent or job.

---

## 24. Definition of Done

This plan is complete only when:
- frontier planning produces validated MasterPlans
- jobs decompose into executable DAGs
- ContextPackets are small and reproducible
- model/provider routing is dynamic
- subscription and PAYG paths coexist
- quotas are observable
- retries are bounded
- independent review works
- evidence is persisted
- worktree isolation works
- cost/token telemetry is real
- routing history is recorded
- model selection can learn from validated outcomes
- no critical PASS depends on mock/placeholder
- main remains untouched unless explicitly approved later



---

## Implementation Progress — 2026-09-22

Implemented on branch `TOKENS`:
- canonical MasterPlan/TaskContract/ContextPacket/ExecutionResult/ResultDigest contracts
- Model Registry with worker/professional/frontier tiers
- Quota Router with GREEN/YELLOW/RED/RESERVE states
- Resource Router V2 scoring capability/risk/complexity/quota/cost/reliability
- bounded Escalation Engine
- ResultDigest and handoff recursion/depth guard
- progressive ContextPacket compiler with token budget and retrieval levels
- Claude subscription adapter boundary
- unified PAYG Gateway adapter boundary
- MasterPlan DAG validation + ready-task resolver
- Independent Review policy
- Learning Router observations and validation state
- department/agent workforce profiles
- ExecutionPort registry
- PAYG monthly budget policy
- routing observability trace model
- acceptance policy for R0-R4
- workforce orchestrator skeleton wired to Task DAG -> Router -> Context -> Execution -> Review
- unit coverage for routing, quotas, escalation, DAGs, independent review, and context budgets

Still requires real external runtime integration/evidence before PASS:
- authenticated Claude/Codex/Antigravity execution clients
- real AI Gateway credentials/client
- provider quota collectors backed by actual subscription/API telemetry
- durable persistence for learning/routing observations
- real browser/E2E verification
- benchmark suite with real providers and >=30 validated observations where required
- production/deployment integration (not authorized in this branch)


### Continued implementation pass

Additional implementation completed:
- removed false-success Codex and Antigravity stubs; unconfigured runtimes now return BLOCKED instead of fabricated success
- expanded package typecheck scope to the full operating-core source tree
- exported the complete workforce fabric through the operating-core public API
- added WorkforcePersistence contract plus in-memory reference store for plans, executions, digests, traces, and routing observations
- added benchmark harness for paired executor evaluation
- added strict Evidence Gate
- added provider health probes
- added token-budgeted Lazy Tool Registry
- wired plan/execution/digest persistence and evidence gating into WorkforceOrchestrator
- expanded tests for evidence, PAYG budget states, and lazy tool loading

Current hard external gates remain authenticated provider runtimes, real quota telemetry, real gateway credentials, durable database adapter selection/migration, and execution of provider-backed benchmark/E2E suites. These gates must not be represented as PASS until real evidence exists.


### Maximum inline implementation pass

Further completed:
- resumable plan/task run-state primitives
- execution idempotency keys/store
- owner approval gate for R3/R4 and protected operations
- bounded retry controller with exponential backoff policy
- ContextPacket TTL cache
- token/cost ledger
- exclusive worktree lease policy
- Postgres persistence adapter contract and SQL schema for plans, executions, digests, routing traces and learning observations
- runtime policy for production/destructive/secrets/financial boundaries
- orchestrator enforcement of owner approval, idempotent execution and cost recording
- expanded tests for idempotency, approvals, worktree isolation and runtime gates

Important deployment note: `postgres-schema.sql` is an implementation artifact only; it has NOT been applied to production. Applying migrations, connecting authenticated provider runtimes, supplying gateway credentials, collecting real provider quotas, and running real provider/E2E benchmarks remain external execution gates.


### Plan validation pass

A direct plan-to-code validation found additional repository-only work and it was implemented:
- canonical EvidenceBundle
- EscalationRecord
- provenance-aware, budget-bounded Memory Retriever
- dynamic Capability Registry
- runtime validation helpers for MasterPlan, TaskContract, ContextPacket and ExecutionResult
- explicit autonomous-mode policy by R0-R4
- Command Center workforce dashboard snapshot contract
- tests for contract validation, memory retrieval and autonomous risk policy

Validation result: the earlier claim that only external work remained was too strict. Repository-only gaps still existed and are now reduced further.

Still not legitimately claimable as complete without external evidence:
- real authenticated provider execution
- real provider quota collectors
- real gateway client/credentials
- applying the Postgres schema through the project's migration system
- real browser/E2E runs
- provider-backed benchmark corpus and sufficient validated observations
- UI wiring of dashboard/Agent Office to live persisted telemetry
- production rollout, which remains outside this branch's authorization

The Definition of Done therefore remains OPEN. No mock, placeholder, or unexecuted integration is marked PASS.


### Integration pass after plan revalidation

Implemented further repository-only gaps:
- LearningResourceRouter injects measured historical success into routing
- ContextResolver composes validated memory and lazy tools under separate budgets
- QuotaBroker unifies subscription/runtime quota snapshots
- deterministic 30-case benchmark corpus generator across six representative categories
- WorkforceOrchestrator now resolves memory/tools into ContextPackets and records post-review LearningRouter observations
- tests cover 30-case corpus construction and bounded context resolution

External execution remains required to turn these prepared integrations into measured PASS evidence.