# Lumenva Maestri V3 — Agentic Engineering OS Master Implementation Blueprint

Status: **CANONICAL / SINGLE SOURCE OF TRUTH**  
Branch: `vps`  
Main policy: **never merge or push to `main` automatically**  
Supersedes: previous Maestri V3 architecture plan while preserving all valid constraints and the three external gates.  
External gate plan: `docs/superpowers/plans/2026-09-22-maestri-v3-first-three-external-gates.md`

## 0. Mission

Build Maestri as an **Agentic Engineering OS** that separates specification, context, harness, loop, execution, verification and compound learning.

Core principle:

> Humans steer. Maestri governs. Agents execute. Evidence decides completion.

The system must survive long-running work, context-window renewal, compaction, provider failures, quota pressure and session changes **without relying on conversational memory as the source of truth**.

## 1. Non-negotiable invariants

1. `vps` is the implementation branch for this cycle.
2. No automatic merge to `main`.
3. No production deploy without the applicable policy/human gate.
4. No secret value in Git, prompts persisted to evidence, logs, traces or documentation.
5. Do not install Docker during the current bootstrap/external-gate phase.
6. Before installing/configuring anything, detect and reuse healthy existing capability.
7. GitHub is code truth; Postgres is operational truth.
8. Conversation context is cache, never durable truth.
9. Agent claims are not evidence.
10. A task is COMPLETE only when its acceptance manifest and evidence pass.
11. Read parallelism can be aggressive; write parallelism is conflict-controlled.
12. Providers are replaceable behind adapters.
13. Critical policy is deterministic, not prompt-only.
14. Reproducible compute should be offloaded from the PC when policy/provider capability permits.
15. Context must use progressive disclosure: map first, relevant detail on demand.

## 2. Target architecture

```text
OWNER
  ↓
CLAUDE CODE — CEO
  ↓ Master Goal
MAESTRI AGENTIC ENGINEERING OS
  ├── Spec Engine
  ├── Master Planner
  ├── Dependency Graph
  ├── Work Package Compiler
  ├── Conflict Graph
  ├── Context Engine
  │    ├── ContextPacket
  │    ├── Context Budget Manager
  │    ├── State Ledger
  │    ├── Context Recovery Engine
  │    ├── ResultDigest
  │    └── FailureDigest
  ├── Harness Engine
  │    ├── Skills
  │    ├── MCP Gateway
  │    ├── Hooks
  │    ├── Capability Grants
  │    └── Provider Adapters
  ├── Loop Engine
  │    ├── Observe
  │    ├── Verify
  │    ├── Loop Detector
  │    ├── Failure Classifier
  │    ├── Retry / Replan
  │    └── Escalation
  ├── Prompt Compiler
  ├── Scheduler / Queue
  ├── Resource Router
  ├── Quota / Usage Governors
  ├── Policy Engine
  ├── Evidence Validator
  ├── Fresh Context Reviewer
  ├── Compound Learning Engine
  ├── Memory / Provenance
  └── Telemetry / Audit
          ↓
   ┌───────────────┬────────────────┐
   │ CODEX CTO     │ JULES CTO      │
   │ local         │ fleet          │
   │ worktree      │ swarm          │
   │ cloud         │ Gemini 3.1 Pro │
   └───────┬───────┴───────┬────────┘
           ↓               ↓
                  GitHub
                    ↓
               PR / Actions
                    ↓
              Cross Review
                    ↓
            Evidence Validator
                    ↓
               Policy Gate
                    ↓
              Claude CEO Review
                    ↓
               HUMAN MERGE
```

## 3. Engineering layers

### L0 — Provider system
Native OpenAI / Anthropic / Google system behavior. Never copy leaked prompts into the product.

### L1 — Lumenva constitution
Stable repository rules, architecture invariants and safety boundaries in hierarchical `AGENTS.md` / Claude project instructions.

### L2 — Role
CEO, planner, builder, explorer, verifier, reviewer, incident diagnostician.

### L3 — Skill
Reusable methodology for a bounded kind of work.

### L4 — TaskContract
Exact current job.

### L5 — ContextPacket
Smallest high-signal context required for the next inference.

### L6 — Runtime state
Progress, decisions, evidence, failures, budgets, checkpoints.

### L7 — Dynamic instructions
Corrections, failure recovery, user changes and runtime policy decisions.

## 4. Roles

### Claude Code — CEO
Owns intent, architecture decisions, master planning, delegation, escalation, conflict resolution and release readiness. It should not be the default executor for mechanical or cloud-reproducible compute.

### Maestri — governor
Owns durable state, contracts, context selection, routing, dependencies, conflicts, budgets, policy, evidence and orchestration. It must not depend on one provider's private runtime semantics.

### Codex — CTO Engineering
Deep repository reasoning, complex debugging, cross-module refactors, migrations, difficult implementation, code/security review and CI diagnosis.

Execution modes:
- `CODEX_LOCAL`
- `CODEX_WORKTREE`
- `CODEX_CLOUD`

### Jules — CTO Cloud/Fleet
Independent work packages, maintenance, tests, docs, isolated bugs, frontend work and high-throughput asynchronous execution.

### Verifier
Deterministic checks first. Receives TaskContract + AcceptanceManifest + diff/artifacts/evidence, not builder conversation history.

### Fresh Context Reviewer
Independent review from a clean context. It receives only the specification, diff, evidence and relevant repository map.

## 5. Universal TaskContract

```text
id
parent_job
objective
context
source_of_truth
current_state
repo
base_branch
work_branch
scope
requirements
target_files
constraints
dependencies
conflicts
skill
allowed_tools
forbidden_actions
network_policy
secret_policy
verification
acceptance_criteria
risk_level
priority
timeout
context_budget
tool_budget
execution_budget
resource_class
preferred_provider
fallback_policy
requested_by
created_at
```

TaskContract is provider-neutral and immutable by workers except through an explicit revision event.

## 6. AcceptanceManifest

Every non-trivial Work Package gets machine-readable acceptance state:

```text
AC01: PASS | FAIL | PENDING | BLOCKED
AC02: PASS | FAIL | PENDING | BLOCKED
...
```

Each item stores:
- requirement reference;
- verification method;
- evidence IDs;
- last verification timestamp;
- verifier;
- failure reason.

Completion requires all mandatory acceptance items PASS.

## 7. Context engineering

### 7.1 ContextPacket

```text
objective
relevant_instructions
relevant_files
relevant_symbols
prior_decisions
constraints
available_tools
current_acceptance_state
relevant_evidence
token_budget
```

### 7.2 ContextBudget

```text
max_tokens
max_files
max_bytes
retrieval_depth
expansion_count
expansion_budget
```

Start small. Expand only when needed.

### 7.3 State Ledger

Durable execution state:

```text
objective
current_phase
completed_work
current_work
remaining_work
decisions
assumptions
tests_passed
tests_failed
blockers
branches
commits
prs
evidence
next_action
checkpoint_version
```

### 7.4 Context Recovery Engine

Before continuing a long-running/restarted/compacted task:

```text
TaskContract
  ↓
State Ledger
  ↓
AcceptanceManifest
  ↓
git status / log / diff
  ↓
latest evidence
  ↓
open blockers
  ↓
provider/session state
  ↓
construct fresh ContextPacket
  ↓
continue
```

No critical fact may exist only in the chat transcript.

### 7.5 Compaction protocol

Before provider compaction/context renewal:
1. checkpoint State Ledger;
2. persist decisions with provenance;
3. persist unresolved blockers;
4. persist AcceptanceManifest;
5. persist current branch/commit/PR;
6. persist evidence references;
7. persist exact next action;
8. generate a compact recovery digest.

After compaction, recovery must rebuild from durable state rather than trusting the summary alone.

### 7.6 ResultDigest

Successful handoff:

```text
objective
result
files_changed
decisions
tests
evidence
remaining_risk
git_state
follow_up
```

### 7.7 FailureDigest

Failed/escalated handoff:

```text
objective
attempt
changes
error_class
error
tests
hypotheses
evidence
git_state
recommended_next_strategy
```

## 8. Repository knowledge model

Do not build one giant instruction file. Use a small stable map with progressive disclosure.

Target:

```text
/AGENTS.md
/docs/architecture/
/docs/plans/
/docs/decisions/
/docs/quality/
/docs/security/
/packages/maestri/AGENTS.md
/apps/web/AGENTS.md
/services/*/AGENTS.md
```

Complex execution plans are versioned first-class artifacts with progress and decision logs.

Add documentation freshness checks and eventually a doc-gardening agent.

## 9. Skills

Target shared skills:

```text
.agents/skills/
 implement-feature/
 debug-complex-bug/
 repository-audit/
 architecture-review/
 database-migration/
 frontend-validation/
 test-generation/
 security-review/
 fix-ci/
 dependency-upgrade/
 performance-review/
 documentation/
 release-validation/
 context-recovery/
 evidence-validation/
 incident-diagnosis/
```

Rules:
- permanent rule → constitution;
- reusable method → skill;
- current intent → TaskContract;
- current information → ContextPacket.

## 10. Agent Factory — mandatory factory standard

All runtime agents MUST be created, validated, registered and versioned through AgentFactory. Manual runtime instantiation is forbidden except temporary diagnostic agents explicitly marked `EPHEMERAL`.

### AgentDefinition

Every agent definition MUST declare:

```text
id
name
role
purpose
provider_policy
model_profile
instructions
skills
allowed_tools
forbidden_tools
write_scope
context_policy
memory_policy
network_policy
secret_policy
risk_ceiling
resource_class
timeout
tool_budget
acceptance_contract
output_schema
lifecycle
definition_version
```

Agent definitions describe capabilities and constraints, not a hard dependency on one model vendor. Provider selection remains a router decision unless a definition has an explicit, policy-approved provider requirement.

### Factory templates

The factory MUST provide validated templates:

```text
ExplorerTemplate
PlannerTemplate
BuilderTemplate
ReviewerTemplate
VerifierTemplate
SecurityTemplate
ArchitectureTemplate
QATemplate
DependencyTemplate
IncidentTemplate
ResearchTemplate
```

Templates provide safe defaults; concrete AgentDefinitions may narrow permissions but MUST NOT silently broaden template permissions.

### Mandatory factory pipeline

```text
Need agent
  ↓
AgentDefinition
  ↓
Schema Validator
  ↓
Policy Validator
  ↓
Capability Resolver
  ↓
Provider Compiler
  ↓
Capability / Health Probe
  ↓
Agent Registry
  ↓
READY
```

A failed stage MUST prevent READY registration.

### Factory validation

At minimum, BLOCK definitions with:
- missing/duplicate identity;
- missing role or purpose;
- missing output schema;
- unsupported provider capability;
- unknown/unapproved tool;
- write capability on a read-only template;
- risk ceiling incompatible with approval policy;
- undefined secret/network policy;
- invalid resource/tool budget;
- reviewer inheriting builder history when fresh context is required;
- verifier allowed to mutate the artifact it verifies.

### Provider Compiler

AgentFactory compiles provider-neutral definitions into provider-specific runtime configuration for Claude, Codex or Jules while preserving the same logical role, policy ceiling, skills, tool grants and output contract.

```text
AgentDefinition
      ↓
Provider Compiler
  ┌───────┼───────┐
Claude   Codex   Jules
```

Provider-specific syntax MUST remain an adapter concern and MUST NOT leak into the canonical AgentDefinition.

### Agent Registry

Registry records:

```text
agent_id
definition_version
definition_hash
template
provider
model_profile
capabilities
skills
health
status
created_at
updated_at
last_probe_at
```

Only registered `READY` agents may receive production-like Work Packages. `EPHEMERAL` diagnostic agents must be isolated, time-bounded, auditable and incapable of bypassing policy.

### Factory-built initial catalog

The first catalog MUST be produced through AgentFactory, never hand-authored as independent runtime agents:

```text
explorer
planner
builder
reviewer
verifier
security-reviewer
architecture-reviewer
plan-reviewer
qa-reviewer
dependency-analyst
incident-diagnostician
researcher
```

Reviewer baseline:
- fresh context;
- read-only;
- builder history denied by default;
- inputs limited to TaskContract, AcceptanceManifest, diff/artifacts and evidence;
- structured findings/severity/evidence/verdict output.

Verifier baseline:
- deterministic-first;
- cannot mutate verified artifact;
- evidence required;
- structured PASS/FAIL/BLOCKED output.

### Agent Factory invariants

1. No runtime agent outside AgentFactory.
2. Role is independent from provider.
3. Templates may be narrowed, never silently widened.
4. Every definition is schema validated and versioned.
5. Every READY registration has a successful capability/health probe.
6. Definition hash and version are attached to every execution/evidence record.
7. Provider changes do not change the logical agent identity or acceptance contract.
8. Agent upgrades create a new definition version; they do not silently mutate historical executions.
9. R4 capabilities can never be granted solely by factory configuration; Human Gate still applies.
10. Factory creation itself is observable and auditable.

## 11. Claude CEO harness

Create a Lumenva/Maestri Claude integration layer containing:
- CEO role instructions;
- project settings;
- approved hooks;
- skills;
- bounded specialist agents;
- Maestri MCP access;
- session/checkpoint integration.

The user's local Claude presentation preferences are a thin workstation overlay, not a second CEO role or a second source of Maestri policy:
- user-level `~/.claude/CLAUDE.md` holds stable personal communication preferences;
- user-level `~/.claude/output-styles/` changes response voice/format only and keeps Claude's coding instructions;
- personal skills in `~/.claude/skills/` remain task capabilities, not always-loaded policy. `humanizar` is used when human-facing PT-BR prose needs it; `girias` is explicitly invoked for a stronger regional profile;
- project `CLAUDE.md`, existing CEO role, and project rules remain the source for Lumenva identity and governance. Do not copy them into global instructions;
- progress messages are rendered from the Master Plan, State Ledger and AcceptanceManifest. Do not create a parallel `ACTIVE_PIPELINE.md` as an independent state source;
- a Claude `SessionStart` adapter may add only a small digest from that canonical state. It must not inject conversation history, whole prompts, secrets or large diffs. The adapter belongs to the canonical Hook Engine and maps to its events.

This overlay controls communication, not security or permissions. Existing provider/project permission settings remain separate and must not be changed as a side effect of voice configuration.

Specialist roles:
- architecture reviewer;
- security reviewer;
- plan reviewer;
- QA reviewer;
- dependency analyst;
- incident diagnostician.

Use subagents primarily for high-volume reading/exploration and return digests. Agent Teams remain shadow/experimental until benchmarked.

## 12. Hooks

Canonical runtime events:

```text
before_task
before_route
after_route
before_dispatch
after_dispatch
on_started
on_plan
before_plan_approval
after_plan_approval
on_progress
on_tool_call
on_waiting
on_rate_limit
before_checkpoint
after_checkpoint
before_compaction
after_recovery
before_commit
after_commit
before_pr
after_pr
on_ci_failure
on_security_failure
on_timeout
on_agent_failure
on_loop_detected
before_complete
on_complete
before_merge
after_merge
```

Claude-specific hooks should map into these canonical events instead of becoming separate business logic.

## 13. MCP Gateway and capability grants

```text
Agent
 ↓
Maestri MCP Gateway
 ↓
Policy Engine
 ↓
Task capability grant
 ↓
approved external tool
```

Never expose the global tool catalog by default.

Capabilities can include:
- create/get/update job;
- create/get task;
- dispatch;
- get evidence;
- get usage/quota;
- approve/revise plan;
- retry;
- escalate;
- cancel.

## 14. Master Planner

Master Goal → semantic decomposition → dependency analysis → conflict analysis → coherent Work Packages.

Do not map every plan line to one agent task. A provider task may contain many internal PlanSteps.

## 15. Dependency Graph

States:

```text
BLOCKED
READY
QUEUED
DISPATCHED
PLANNING
WORKING
WAITING
VALIDATING
PR_CREATED
COMPLETED
FAILED
CANCELLED
```

Only READY is schedulable.

## 16. Conflict Graph

Track:
- exact file overlap;
- package/module overlap;
- migration/schema overlap;
- API contract overlap;
- semantic ownership overlap.

Aggressive parallel reads are allowed. Concurrent writes require isolated branches/workspaces and conflict approval.

## 17. Prompt Compiler

Provider-neutral template:

```text
# OBJECTIVE
# CONTEXT
# SOURCE OF TRUTH
# CURRENT STATE
# SCOPE
# REQUIREMENTS
# TARGETS
# CONSTRAINTS
# DEPENDENCIES
# VERIFICATION
# ACCEPTANCE CRITERIA
# DELIVERY
```

Then a Provider Transformer maps it to Claude/Codex/Jules without duplicating global policy.

## 18. Execution Router

Routes:

```text
CODEX_LOCAL
CODEX_WORKTREE
CODEX_CLOUD
JULES_FLEET
JULES_SWARM
CLAUDE_REVIEW
HUMAN_APPROVAL
```

Inputs:
- skill fit;
- risk;
- dependency readiness;
- conflict state;
- cloud compatibility;
- provider health;
- quota/usage;
- resource class;
- latency;
- host pressure.

## 19. Cloud-first compute

If work is reproducible, cloud-capable and does not require local hardware/OS state, offload it.

Codex Cloud priority workloads:
- repository analysis;
- implementation;
- builds;
- lint/typecheck;
- unit/integration tests that are reproducible;
- refactors;
- migrations;
- dependency work;
- docs;
- review;
- CI diagnosis.

Keep local:
- Windows-specific integration;
- hardware/device integration;
- BrowserMesh/local desktop control;
- interactive debugging that needs the host;
- Maestri control plane;
- Command Center.

## 20. Codex Cloud Environment Manager

Maintain a minimal reproducible environment:
- Node;
- pnpm;
- Python;
- Git;
- project dependencies;
- build/test tools;
- setup scripts;
- environment references;
- network policy.

Do not assume setup secrets survive into agent phase. Do not assume caches are durable without probing.

## 21. Network policy

```text
OFF
SETUP_ONLY
DEPENDENCIES
DOCUMENTATION_ALLOWLIST
SERVICE_ALLOWLIST
FULL
```

Default OFF. FULL requires explicit justification/policy.

## 22. Secret policy

Secret Manager is authority. Agents receive references or short-lived/minimum grants. Never store secret values in:
- repository;
- State Ledger;
- evidence;
- traces;
- prompts intended for persistence;
- docs.

## 23. Jules Fleet

Jules is the asynchronous fleet provider. Account/provider limits must be discovered and tracked, not assumed forever.

Quota Guard maintains:
- rolling usage;
- current concurrency;
- remaining allowance;
- reservations;
- projected pressure;
- blocked tasks.

Reserve capacity for urgent/recovery work when practical.

## 24. Jules Plan Validator

Compare Jules plan with:
- scope;
- requirements;
- constraints;
- dependencies;
- target areas;
- acceptance criteria;
- risk.

Result:
`PASS | REVISE | BLOCK`.

## 25. Risk model

```text
R0 read/docs/tests        → AUTO
R1 isolated normal code   → AUTO
R2 important module       → VALIDATOR
R3 infra/security         → CLAUDE
R4 prod/main/secrets/IAM  → HUMAN
```

## 26. Jules Swarm

Use only for high-uncertainty problems where multiple independent approaches have expected value. It consumes explicit budget and never becomes default execution.

## 27. Codex Usage Governor

Do not invent a fixed concurrency limit. Track:
- available usage signal;
- task complexity;
- current workload;
- estimated cost class;
- local/cloud;
- priority;
- recent throttling.

Resource classes:
`TINY | LIGHT | NORMAL | HEAVY | EXCLUSIVE`.

## 28. Internal model/capability router

Providers may expose multiple model/capability profiles. Route by capability and current documented availability, not hard-coded marketing names.

Profiles:
- explorer: read-heavy, cheap/fast;
- builder: write/test;
- reviewer: fresh context, read-only;
- heavy engineer: deep reasoning;
- verifier: deterministic-first.

## 29. Loop Engine

Canonical loop:

```text
GOAL
 ↓
PLAN
 ↓
ACT
 ↓
OBSERVE
 ↓
VERIFY
 ↓
PASS? ── yes → acceptance/evidence gate
  │
  no
  ↓
CLASSIFY FAILURE
 ↓
RETRY / REPLAN / ESCALATE
 ↓
ACT
```

The loop belongs to Maestri, not to a prompt phrase like “keep trying”.

## 30. Loop Detector

Detect repeated equivalent cycles using:
- same failing command/test;
- same error signature;
- repeated near-identical diff;
- no acceptance progress;
- tool-call repetition;
- retry count;
- elapsed budget.

On detection:
`LOOP_DETECTED → FailureClassifier → strategy change / provider change / Claude diagnosis`.

## 31. Failure Classifier

```text
TRANSIENT
BAD_PROMPT
BAD_PLAN
CODE_ERROR
TEST_FAILURE
CI_FAILURE
DEPENDENCY
ENVIRONMENT
AUTH
QUOTA
CONFLICT
ARCHITECTURE
POLICY
LOOP
UNKNOWN
```

## 32. Escalation Engine

```text
TRANSIENT    → retry same provider
BAD_PROMPT   → Prompt Compiler
BAD_PLAN     → replan
TEST_FAILURE → same builder with evidence
CI_FAILURE   → CI remediation
DEPENDENCY   → WAITING_DEPENDENCY
ENVIRONMENT  → environment repair
AUTH         → external/auth gate
QUOTA        → queue/alternate
CONFLICT     → serialize/rebase/replan
LOOP         → strategy change
COMPLEX_CODE → Codex CTO
ARCHITECTURE → Claude CEO
POLICY       → block
UNKNOWN      → Claude diagnosis
```

## 33. Tool Budget

TaskContract can specify:
- soft warning;
- hard tool-call cap;
- per-tool limits;
- external-write prohibition;
- time/execution budget.

Budget exhaustion creates an event and requires policy-based retry/escalation, not silent looping.

## 34. Evidence model

TaskResult:

```text
status
summary
files_changed
tests_requested
tests_executed
tests_passed
lint
typecheck
build
runtime_validation
commit
branch
pr
ci
artifacts
errors
warnings
evidence
follow_up
```

Evidence items should capture command/check, exit code/status, timestamp, commit SHA/context and output digest where applicable.

## 35. Progress Evidence Guard

Claims such as “tests passed”, “build succeeded”, “migration succeeded”, “PR ready” or “deploy succeeded” must reference evidence. Unsupported claims do not advance AcceptanceManifest.

## 36. Cross-agent review

Preferred:
- Jules builder → Codex review;
- Codex builder → Jules/CI validation;
- R3 → builder → independent reviewer → Claude.

Reviewer must not inherit builder reasoning by default.

## 37. GitHub execution model

```text
Work Package
 ↓
isolated branch/workspace
 ↓
commit
 ↓
PR
 ↓
Actions
 ↓
review
 ↓
evidence
```

Branch naming:
- `maestri/codex/<task-id>`
- `maestri/jules/<task-id>`

No concurrent fleet writes directly to `main`.

## 38. CI Fixer

CI failure:
1. ingest failing checks/log digest;
2. classify;
3. return to responsible builder or CI-fix skill;
4. commit correction;
5. rerun CI;
6. escalate only after policy threshold.

## 39. Compound Learning Engine

Every completed/failed task may produce a LearningCandidate.

Candidate types:
- new/revised skill;
- documentation fix;
- architecture invariant;
- missing test/guardrail;
- router heuristic;
- failure signature;
- environment improvement.

Promotion pipeline:

```text
Task outcome
 ↓
LearningCandidate
 ↓
validate evidence
 ↓
deduplicate
 ↓
risk review
 ↓
encode in correct layer
 ↓
test/CI
 ↓
version
```

Never blindly convert agent output into permanent memory.

## 40. Memory and provenance

Domains:
- PROJECT MEMORY;
- AGENT/PROVIDER MEMORY;
- TASK MEMORY.

Every durable memory record needs:
- source;
- timestamp;
- confidence;
- task;
- commit/PR when applicable;
- provider;
- evidence;
- supersedes/expiry when relevant.

## 41. Operational truth

```text
GitHub = code truth
Postgres = operational truth
Evidence Store = execution proof
```

Tables/collections target:

```text
agents
agent_runtime_state
agent_jobs
agent_tasks
agent_events
task_dependencies
task_conflicts
task_attempts
task_checkpoints
acceptance_items
context_packets
context_digests
agent_usage
agent_session_usage
approvals
evidence
learning_candidates
incidents
host_nodes
host_metrics
notifications
```

## 42. Scheduler and queues

Priorities:
`urgent | high | normal | low | maintenance`.

Waiting states:
`WAITING_DEPENDENCY | WAITING_RESOURCE | WAITING_QUOTA | WAITING_APPROVAL | WAITING_EXTERNAL`.

Waiting work does not occupy an execution slot.

## 43. PC Resource Guard

Observe CPU, RAM, swap, disk and network. Under host pressure:
- stop dispatching nonessential local compute;
- prefer Codex Cloud/Jules;
- preserve control plane and interactive operations.

## 44. Observability

Correlate:
```text
timestamp
trace_id
job_id
task_id
agent_id
provider
execution_id
context_packet_id
checkpoint_id
event
duration
usage
tools
files
policy
retry
terminal_status
```

Trace export failure must never destroy local evidence.

## 45. Command Center

Main status:
- Maestri health;
- Claude CEO;
- Codex local/worktree/cloud;
- Jules fleet;
- READY/RUNNING/BLOCKED/WAITING/FAILED/COMPLETED;
- dependency/conflict graph;
- quota/usage;
- host pressure;
- branch/PR/CI;
- AcceptanceManifest;
- evidence;
- loop/retry/escalation history;
- checkpoint/recovery status.

## 46. Repository target

```text
Lumenva/
├── AGENTS.md
├── docs/
│   ├── MAESTRI_AGENT_ARCHITECTURE.md
│   ├── architecture/
│   ├── plans/
│   ├── decisions/
│   ├── quality/
│   └── security/
├── .agents/skills/
├── .claude/
│   ├── agents/
│   ├── skills/
│   └── hooks/
├── .codex/config.toml
├── .github/
│   ├── workflows/
│   └── agentic-workflows/
└── packages/maestri/
    ├── core/
    ├── contracts/
    ├── spec/
    ├── planner/
    ├── dependencies/
    ├── conflicts/
    ├── context/
    │   ├── budget/
    │   ├── recovery/
    │   ├── ledger/
    │   └── digests/
    ├── compiler/
    ├── harness/
    ├── loop/
    ├── router/
    ├── scheduler/
    ├── queue/
    ├── quota/
    ├── resources/
    ├── policies/
    ├── hooks/
    ├── evidence/
    ├── failures/
    ├── escalation/
    ├── memory/
    ├── learning/
    ├── telemetry/
    └── adapters/
        ├── claude/
        ├── codex/
        │   ├── local/
        │   ├── worktree/
        │   └── cloud/
        ├── jules/
        └── github/
```

## 47. External Gates — first operational block

The existing detailed plan remains executable at:
`docs/superpowers/plans/2026-09-22-maestri-v3-first-three-external-gates.md`.

### Gate A — real Jules/Codex Actions
- validate workflows on `vps`;
- execute Jules read-only evidence run;
- execute Codex only if required credential exists;
- never create an API key automatically;
- record evidence.

### Gate B — remote Graphiti without Docker
- detect existing endpoint first;
- health/auth/schema probe;
- package tests;
- synthetic non-production shadow ingestion;
- namespace isolation;
- remain OFF on any failed gate.

### Gate C — optional OTLP collector
- detect approved collector;
- synthetic span;
- verify actual visibility/correlation;
- prove local trace survives exporter failure;
- keep exporter optional.

These gates do not authorize main merge, production deploy or secret creation.

## 48. Implementation program

### Phase 0 — Reconcile and freeze
- audit current `vps`;
- map existing implementation to this blueprint;
- mark DONE/PARTIAL/MISSING/BLOCKED;
- do not rewrite working components without evidence.

### Phase 1 — Canonical contracts
- TaskContract;
- ExecutionResult/TaskResult;
- ResultDigest;
- FailureDigest;
- AcceptanceManifest;
- ContextPacket;
- budgets.

### Phase 2 — State machine
Implement canonical task/job transitions and invalid-transition tests.

### Phase 3 — Durable State Ledger
Checkpoint schema, persistence, versioning, recovery tests.

### Phase 4 — Context Recovery Engine
Rebuild task state from durable truth + Git + evidence after a simulated lost session.

### Phase 5 — Context Budget Manager
Token/file/byte/retrieval budgets and progressive expansion.

### Phase 6 — Repository knowledge hierarchy
Small root map, hierarchical instructions, architecture/plan/decision/quality/security indexes.

### Phase 7 — Skills
Implement shared skill catalog with validation and versioning.

### Phase 8 — Agent Factory
Implement AgentDefinition schema, factory templates, schema/policy validators, Capability Resolver, Provider Compiler, Agent Registry, definition hashing/versioning, health probes and EPHEMERAL diagnostic policy.

Acceptance:
- invalid definitions cannot register READY;
- provider-neutral definition compiles to supported provider configuration;
- definition version/hash is present in execution evidence;
- no runtime agent can bypass the factory.

### Phase 9 — Factory Agent Catalog
Create explorer, planner, builder, reviewer, verifier, security-reviewer, architecture-reviewer, plan-reviewer, qa-reviewer, dependency-analyst, incident-diagnostician and researcher exclusively through AgentFactory.

Acceptance:
- every catalog agent passes schema/policy/capability/health validation;
- reviewer is fresh-context/read-only;
- verifier cannot mutate verified artifacts;
- tests prove role/provider separation.

### Phase 10 — Claude CEO harness
CEO role, hooks, Maestri MCP integration and checkpoint events. All Claude specialist agents MUST come from the AgentFactory catalog; no hand-created parallel agent definitions.

### Phase 11 — Prompt Compiler
Provider-neutral compile + Claude/Codex/Jules transforms.

### Phase 12 — Dependency Graph
Persistence, readiness calculation and UI/event model.

### Phase 13 — Conflict Graph
File/module/semantic conflict detection and serialization.

### Phase 14 — Policy Engine
Risk R0–R4, main/prod/secrets/IAM rules and capability grants.

### Phase 15 — Hook Engine
Canonical events + provider event adapters.

### Phase 16 — GitHub Adapter
Branch/commit/PR/check/review/evidence primitives.

### Phase 17 — Codex Adapter
Local/worktree/cloud unified ExecutionPort.

### Phase 18 — Codex Cloud Environment
Minimal reproducible environment and network/secret policy validation.

### Phase 19 — Cloud-first Router
Offload reproducible compute and respect PC Resource Guard.

### Phase 20 — Jules Adapter
Sessions/tasks/results/plan interaction behind ExecutionPort.

### Phase 21 — Jules provider validation
Gemini/provider capability probing, health and plan semantics.

### Phase 22 — Quota/Usage Governors
Jules rolling/concurrency ledger; adaptive Codex usage governor.

### Phase 23 — Fleet Scheduler
Dependency/conflict/risk/quota/resource-aware scheduling.

### Phase 24 — Plan Validator
PASS/REVISE/BLOCK with deterministic checks where possible.

### Phase 25 — Loop Engine
Plan→act→observe→verify→classify→retry/replan/escalate.

### Phase 26 — Loop Detector
Repeated-error/no-progress detection and budget enforcement.

### Phase 27 — Failure Classifier
Canonical taxonomy and tests for representative failures.

### Phase 28 — Escalation Engine
Policy-driven retry, queue, provider change and CEO escalation.

### Phase 29 — Evidence system
Evidence schema, Progress Evidence Guard and AcceptanceManifest linkage.

### Phase 30 — Fresh Context Reviewer
Independent review packets with no builder-history contamination.

### Phase 31 — Cross-Agent Review
Jules↔Codex and critical Claude review workflows.

### Phase 32 — CI integration
CI fixer loop, check ingestion and evidence correlation.

### Phase 33 — Compound Learning Engine
LearningCandidate extraction, validation, dedupe and promotion.

### Phase 34 — Memory/provenance
Project/provider/task memory with evidence and supersession.

### Phase 35 — Telemetry
Local traces first; optional OTLP; complete correlation.

### Phase 36 — Resource Guard
PC pressure telemetry and automatic offload behavior.

### Phase 37 — Command Center
System/fleet/task/evidence/recovery/loop/quota views.

### Phase 38 — E2E long-horizon recovery tests
Prove task survives:
- provider context compaction;
- process restart;
- session replacement;
- provider failure;
- quota wait;
- CI failure;
without losing objective, decisions, acceptance state or evidence.

### Phase 39 — Chaos/failure tests
Inject auth, network, quota, dependency, conflict, collector and provider failures.

### Phase 40 — Security validation
Secrets, capabilities, network, prompt injection boundaries, external writes and R4 gates.

### Phase 41 — Production hardening
Performance, migrations, retention, backup/recovery, operational docs and final release gate.

### Phase 42 — Windows profile/path integrity and Claude user-layer setup

Status snapshot — 2026-09-22: Claude's personal communication layer is installed locally and verified; provider path normalization remains diagnostic/plan-only and gated before rollout.

- Audit the real Windows identity roots (`%USERPROFILE%`, `%APPDATA%`, `%LOCALAPPDATA%`) and all provider-specific homes before changing any path.
- Keep ChatGPT/Codex Windows home at `%USERPROFILE%\.codex`; do not relocate app package state under `AppData\Local\Packages`, and do not assume the desktop app honors a custom `CODEX_HOME`.
- Keep OpenAI personal skills at `%USERPROFILE%\.agents\skills`; preserve bundled/system skills under `.codex\skills` and repository skills under `<repo>\.agents\skills`.
- Keep Claude Code data under `%USERPROFILE%\.claude`; keep Gemini CLI, Antigravity IDE and Antigravity CLI roots distinct according to each product's current official documentation. Shared repository skills may use `<repo>\.agents\skills` where supported.
- Inventory MCP, plugin, hook, auth, cache and state paths without printing secrets. Treat caches, app-local state and auth databases as managed data, not migration sources.
- When multiple provider executable paths exist, compare canonical version, hash and ownership/update mechanism before calling them duplicates or changing the runner. A kit's internal folder tree is not an installation manifest.
- Reconcile each discovered path against the installed product/version and official docs; mark unsupported or legacy locations without deleting or moving them.
- Diagnose the exact ChatGPT/Codex error from its text and available logs before proposing any repair. Check path casing, stale project/worktree roots, state backup consistency, Windows-vs-WSL boundary and app-version regressions.
- If a migration is later approved, first produce a dry-run manifest (source, destination, owner, hash, duplicate decision, rollback action); back up; copy/verify; change one provider at a time; smoke-test; retain rollback. Never delete the source during the first pass.
- This is a documentation/diagnostic gate; it does not authorize path edits, credential migration, app reset, reinstall or cache cleanup.

#### Claude personal profile — completed on this workstation

- [x] Audited `%USERPROFILE%\.claude` and the existing Lumenva Claude files before changes. No active global `CLAUDE.md`, personal rules, output style or hooks existed; `humanizar` and `girias` were not installed in the active personal skills directory.
- [x] Added concise global communication preferences in `%USERPROFILE%\.claude\CLAUDE.md` and a `David PT-BR Carioca` output style in `%USERPROFILE%\.claude\output-styles\david-ptbr-carioca.md`.
- [x] Set that style as the user default in `%USERPROFILE%\.claude\settings.json`; preserved existing `bypassPermissions`, permission-prompt behavior, Caveman/ADHD plugins, marketplace entries and other settings. The prior settings snapshot is in `%USERPROFILE%\.claude\backups\settings.before-global-voice-20260922.json`.
- [x] Installed upstream `humanizar` and `girias` to `%USERPROFILE%\.claude\skills\`; verified installed file hashes against the checked-out upstream skill trees.
- [x] Runtime confirmation received: Claude showed `David PT-BR Carioca` as active and `/reload-skills` completed. This confirms global style/skill discovery, not the not-yet-built Lumenva pipeline hook.
- [x] Audited existing Lumenva role files (`CLAUDE.md`, `.claude/rules/`, `.claude/agents/`, CEO agent memory); preserved their CEO/Chief Orchestrator role. The global setup changed no project runtime/role files; this plan records the integration boundary.

#### Remaining integration — reuse canonical state, no parallel pipeline

- [ ] Connect the Claude `SessionStart` adapter to the Maestri Master Plan + State Ledger + AcceptanceManifest after those runtime contracts are available. Keep the hook fast and emit only current task, measured progress, blocker/wait reason and next action.
- [ ] Validate that resuming/compacting a session rebuilds the digest from durable state, and that other projects receive no Lumenva-specific state.
- [ ] Keep workflow/progress evidence enforced by the existing Progress Evidence Guard; the voice style may format evidence but may never invent or advance progress.
- [ ] Do not create `docs/ops/ACTIVE_PIPELINE.md` as a second authority. If a Markdown export is later needed, generate it from the State Ledger and mark it as a view/cache.

Acceptance:
- user-level voice/style settings load on a fresh Claude Code session and do not replace the project CEO role;
- user-level skills are available only at their intended scope and are not duplicated into the repository;
- progress/status output is derived from canonical durable state, with no invented percentages and no transcript dump;
- SessionStart digest is small, project-scoped, secret-safe and read-only;
- every active profile/config path is mapped to its owning provider and scope (global, project, app package, cache/auth);
- no global path override silently points the Windows app at another profile;
- duplicate skills/plugins are identified by manifest/name/hash and are not copied blindly;
- multiple executable roots have a recorded owner, update path and consumer; no executable is removed merely because hashes match;
- the exact app error has a reproduced cause or remains explicitly `UNDIAGNOSED`—no speculative repair;
- dry-run + backup + verification + rollback are documented before any approved migration;
- provider smoke tests pass from the intended Windows profile, with WSL treated as a separate environment;
- `main`, credentials, auth stores and unrelated provider caches remain untouched.

## 49. Definition of Done

A Work Package is complete only when:
- requirements satisfied;
- mandatory acceptance items PASS;
- tests executed;
- lint/typecheck/build where applicable;
- no unresolved critical finding;
- required runtime validation performed;
- commit exists;
- PR exists when required;
- CI is successful when required;
- evidence persisted;
- State Ledger checkpointed;
- policy gate passes.

## 50. Long-horizon no-forgetting acceptance test

The implementation is not accepted until this scenario passes:

1. Create a multi-wave master goal.
2. Claude CEO creates Master Plan.
3. Maestri creates at least 8 Work Packages.
4. Dependency/Conflict Graph identifies parallel and blocked work.
5. Dispatch cloud-capable work to Codex Cloud/Jules.
6. Force a context checkpoint.
7. Simulate compaction/session loss.
8. Start a fresh provider session.
9. Context Recovery reconstructs objective, decisions, current diff, acceptance state, evidence and exact next action.
10. Continue without user re-explaining the project.
11. Force one test failure and one repeated-loop signature.
12. FailureClassifier/LoopDetector change strategy correctly.
13. Complete PR/CI/cross-review.
14. Evidence Validator marks acceptance.
15. Compound Learning Engine creates only validated LearningCandidates.
16. Claude final review runs from durable state.
17. Policy Gate returns READY FOR HUMAN MERGE.
18. `main` remains untouched until human action.

## 51. E2E target

```text
Owner → Claude CEO → Master Goal
  → Spec Engine
  → Master Planner
  → Work Packages
  → Dependency + Conflict Graph
  → ContextPackets
  → Scheduler
  → Codex Cloud / Codex Worktree / Jules Fleet
  → GitHub branches
  → Tests / PRs
  → Cross-Agent Review
  → GitHub Actions
  → Evidence Validator
  → unlock next wave
  → checkpoint/recovery whenever needed
  → Compound Learning
  → Claude final review
  → Policy Gate
  → READY FOR HUMAN MERGE
```

## 52. Sources and design rationale

This blueprint follows the agent-first direction documented by OpenAI's harness engineering work: repository knowledge as system of record, progressive disclosure instead of giant instruction manuals, executable plans, agent-to-agent review, worktree isolation and feedback loops. It also follows Anthropic's context-engineering guidance: context is finite, long-horizon work needs compaction/structured state/multi-agent techniques, and context should be curated for high signal.

Implementation must prefer current official provider documentation over copied system prompts, community leaks or stale assumptions.

Windows-specific path evidence and the non-destructive normalization plan are recorded in `docs/audits/windows-ai-profile-path-normalization-2026-09-22.md`.

## 53. Supersession rule

This file is now the **single canonical Maestri V3 architecture and implementation blueprint**.

Older Maestri V3 plan text is superseded by this file except:
- the detailed three-external-gates execution document explicitly linked above;
- audit/evidence documents;
- source-specific operational instructions that do not conflict with this blueprint.

If another document conflicts, this blueprint wins unless a newer explicitly approved canonical document supersedes it.


# Implementation Addendum — Maestri Cloud Control Plane Consolidation

## Status

This addendum turns the existing Maestri architecture into a concrete implementation program that consolidates what already exists in the repository and removes the dependency on the current Maestri desktop app as the system core.

The target is:

```text
OWNER
  |
  v
Lumenva Command Center
/command/chat
  |
  v
Maestri Gateway
  |
  v
Task Compiler
  |
  v
Durable State + Job Engine + Scheduler
  |
  v
Provider Router
  |
  +--> Claude Cloud
  +--> Codex Cloud
  +--> Gemini / Jules
  |
  v
GitHub / branches / PRs
  |
  v
Evidence + Verification + Fresh Review
  |
  v
Human Gate
```

The permanent component is Maestri, not a permanently-open Claude session.

## A. Reuse map — what already exists and must be consolidated

### A1. Command Center

Reuse:
- `/command`
- `/command/chat`
- `/command/agents`
- existing activity/agent-office concepts

Target role:
- primary user interface;
- chat, status, approvals, task controls and notifications;
- mobile/browser-first operation.

### A2. Operating Core

Reuse:
- ResourceRouter;
- job/claim concepts;
- approvals;
- evidence;
- policy and authority concepts;
- tenant isolation;
- event/audit patterns;
- resource/usage routing.

Target role:
- server-side operational kernel of Maestri.

### A3. Existing Maestri MCP

Current surface already includes:
- `maestri.status`
- `maestri.agents.list`
- `maestri.jobs.create`
- `maestri.jobs.get`
- `maestri.context.get`
- `maestri.tasks.dispatch`

Current problem:
- several handlers are still stub/simulated.

Target role:
- MCP becomes only an interface to Maestri Core;
- no business truth or runtime truth lives in the MCP handler itself.

### A4. Existing architecture docs

Reuse and reconcile:
- `docs/MISSION.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/MAESTRI_HANDOFF.md`
- `CLAUDE.md`
- `docs/adr/veredito-estrutura-autoridade.md`
- the current canonical V3 architecture in this file;
- `docs/PERSONAL_AI_ENGINEERING_OS_MEGA_BLUEPRINT.md`.

### A5. Agent Factory

Reuse the factory-standard AgentDefinition and Provider Compiler model already defined in this blueprint.

Target role:
- logical agent definition is provider-neutral;
- adapters compile to Claude, Codex or Gemini-specific runtime configuration;
- native provider agents are reused where equivalent.

## B. Architectural changes

### B1. Maestri becomes the permanent control plane

Old dependency:
```text
Owner -> Claude app -> Maestri -> workers
```

New model:
```text
Owner -> Command Center -> Maestri -> providers
```

Claude becomes a provider/runtime role, not the place where Maestri lives.

### B2. Durable state leaves conversation context

Authoritative state:
- Postgres operational state;
- event log;
- TaskContract;
- State Ledger;
- AcceptanceManifest;
- Evidence;
- GitHub code state.

Conversation history is never authoritative.

### B3. Provider router

Add:
- ClaudeCloudAdapter;
- CodexCloudAdapter;
- GeminiAdapter;
- JulesAdapter where useful;
- local adapters only as fallback/debug paths.

Routing inputs:
- task type;
- required capabilities;
- dependency state;
- risk;
- provider availability;
- quota;
- cost;
- latency;
- required context;
- expected verification mode.

### B4. Cloud Execution Fabric

New layer:

```text
Maestri Scheduler
      |
Provider Router
      |
Cloud Execution Fabric
      |
+-----+------+------+
|            |      |
Claude      Codex  Gemini/Jules
```

Responsibilities:
- dispatch;
- provider health;
- quotas;
- retry/fallback;
- provider session correlation;
- branch/worktree identity;
- result collection;
- timeout handling;
- evidence capture.

### B5. GitHub remains code source of truth

GitHub is used for:
- source;
- branches;
- PRs;
- CI;
- diffs;
- review artifacts;
- commit identity.

Maestri owns:
- tasks;
- dependencies;
- state;
- provider execution;
- policy;
- acceptance;
- evidence metadata;
- approvals.

## C. User interaction model

Primary:
- `/command/chat`

Secondary:
- MCP clients;
- GitHub issues/PR events;
- CLI/API;
- optional Claude interface connector later.

The user should be able to write:
- "continue the project";
- "pause everything";
- "what is blocked?";
- "let Codex continue but pause Gemini";
- "show approvals";
- "resume task X".

Maestri converts natural-language commands into explicit operations and TaskContracts.

## D. Core services

Implement these services as independent modules behind stable interfaces:

1. Maestri Gateway
2. Intent Parser
3. Task Compiler
4. TaskContract Store
5. State Ledger
6. Job Engine
7. Dependency Graph
8. Conflict Graph
9. Scheduler
10. Provider Router
11. Cloud Execution Fabric
12. Agent Factory
13. Capability Registry
14. Policy Engine
15. Approval Engine
16. Quota Governor
17. Usage/Cost Governor
18. Context Engine
19. Checkpoint Engine
20. Recovery Engine
21. Evidence Engine
22. Verification Engine
23. Fresh Context Reviewer
24. Memory Gateway
25. Learning Candidate Pipeline
26. Notification Router
27. Telemetry/Audit
28. Command Center API

## E. Data model

At minimum create/reuse normalized tables for:

- maestri_tasks
- maestri_task_dependencies
- maestri_task_conflicts
- maestri_task_attempts
- maestri_jobs
- maestri_provider_runs
- maestri_agent_definitions
- maestri_agent_registry
- maestri_state_checkpoints
- maestri_acceptance_items
- maestri_evidence
- maestri_approvals
- maestri_events
- maestri_provider_health
- maestri_provider_usage
- maestri_notifications
- maestri_learning_candidates

All records must be tenant-scoped where applicable.

## F. Job lifecycle

Canonical lifecycle:

```text
CREATED
-> PLANNED
-> READY
-> DISPATCHED
-> RUNNING
-> VERIFYING
-> REVIEWING
-> WAITING_APPROVAL
-> COMPLETED
```

Exceptional states:
- BLOCKED_DEPENDENCY
- BLOCKED_CONFLICT
- WAITING_PROVIDER
- WAITING_QUOTA
- WAITING_SECRET
- WAITING_HUMAN
- RETRYING
- FAILED
- CANCELLED

Transitions must be deterministic and persisted.

## G. Provider adapter contract

Each adapter implements:

- probe()
- capabilities()
- dispatch(task, context)
- poll(run)
- cancel(run)
- collectResult(run)
- collectEvidence(run)
- normalizeFailure(run)
- normalizeUsage(run)

Provider-specific behavior stays outside core scheduling logic.

## H. Cloud skills/config bootstrap

All cloud executions pin an Engineering OS version.

Task metadata includes:
- engineering_os_version;
- constitution_version;
- skill_set_version;
- agent_definition_version;
- provider_adapter_version.

Execution bootstrap:
1. checkout target repo/ref;
2. fetch pinned AIEngineeringOS release;
3. compile/mount provider-native instructions;
4. mount required Skills only;
5. configure required tools/MCP only;
6. validate permissions;
7. start provider run;
8. capture ResultDigest + Evidence.

Local machine configuration is never assumed to exist in cloud workers.

## I. API first

Implement Maestri Core as API/service first.

Minimum endpoints:

```text
POST /maestri/messages
POST /maestri/tasks
GET  /maestri/tasks/:id
POST /maestri/tasks/:id/pause
POST /maestri/tasks/:id/resume
POST /maestri/tasks/:id/cancel
GET  /maestri/tasks/:id/evidence
GET  /maestri/tasks/:id/approvals
POST /maestri/approvals/:id/decision
GET  /maestri/agents
GET  /maestri/providers
GET  /maestri/status
```

MCP tools call this API rather than implementing orchestration logic themselves.

## J. Implementation phases

### Phase 0 — Branch inventory and reuse proof

Before creating new modules:
- inspect all Maestri/Command Center/Operating Core implementation across existing branches;
- classify each candidate as REUSE / ADAPT / REPLACE / DROP;
- document exact source branch/path;
- identify conflicting migrations and schemas;
- produce consolidation matrix.

No blind merges.

### Phase 1 — Canonical contracts

Implement/finalize:
- TaskContract;
- AcceptanceManifest;
- Evidence;
- ResultDigest;
- FailureDigest;
- StateCheckpoint;
- ProviderRun;
- AgentDefinition.

Add schema tests.

### Phase 2 — Maestri database kernel

Implement or reconcile:
- task tables;
- dependencies;
- attempts;
- jobs;
- events;
- evidence;
- acceptance;
- approvals;
- checkpoints.

Requirements:
- idempotency;
- tenant isolation;
- atomic transitions;
- retry-safe claims.

### Phase 3 — Real Job Engine

Replace simulated job creation/status behavior.

Deliver:
- persisted create;
- claim;
- start;
- heartbeat;
- complete;
- fail;
- retry;
- cancel;
- resume.

### Phase 4 — Dependency and Conflict Graph

Deliver:
- dependency resolution;
- cycle rejection;
- conflict detection;
- READY calculation;
- downstream unlock after successful acceptance.

### Phase 5 — Scheduler

Deliver:
- priority queue;
- resource classes;
- concurrency limits;
- dependency-aware dispatch;
- provider availability awareness;
- retry scheduling;
- timeout handling.

### Phase 6 — Capability Registry

Inventory:
- provider capabilities;
- MCP/tools;
- network requirements;
- write scopes;
- secrets references;
- provider health.

No task can receive undeclared capability.

### Phase 7 — Provider Router

Implement provider-neutral routing using:
- required capability;
- risk;
- availability;
- quota;
- context size;
- resource class;
- preferred provider;
- fallback policy.

### Phase 8 — Claude Cloud Adapter

Implement capability probe and a real dispatch path supported by the chosen Claude cloud surface.

Return normalized:
- run id;
- state;
- result;
- evidence;
- usage;
- errors.

### Phase 9 — Codex Cloud Adapter

Replace fake Codex success paths.

Deliver:
- real dispatch;
- run tracking;
- branch/commit correlation;
- result retrieval;
- failure normalization;
- evidence persistence.

### Phase 10 — Gemini / Jules Adapter

Implement Gemini cloud execution path and optional Jules implementation path behind one provider family abstraction.

### Phase 11 — Cloud Execution Fabric

Unify adapters under:
- provider run state machine;
- timeout;
- cancellation;
- retry;
- failover;
- provider health;
- quota signals;
- result normalization.

### Phase 12 — Engineering OS bootstrap

Integrate `PERSONAL_AI_ENGINEERING_OS_MEGA_BLUEPRINT`.

Cloud workers must receive:
- pinned constitution;
- required shared Skills;
- provider-native config;
- AgentDefinition;
- TaskContract;
- ContextPacket;
- permission envelope.

### Phase 13 — Agent Factory runtime

Connect the canonical Agent Factory to real provider adapters.

Implement:
- AgentDefinition validation;
- native role reuse;
- provider compile;
- health probe;
- registry;
- version/hash binding to runs.

### Phase 14 — Context Engine

Implement:
- ContextPacket;
- context budget;
- progressive disclosure;
- exact source references;
- provider-specific context assembly.

### Phase 15 — Checkpoint and Recovery

Implement:
- durable checkpoints;
- pre-context-loss checkpoint;
- run recovery;
- provider/session replacement;
- exact next action.

Acceptance test:
kill provider/session and continue without user re-explaining the task.

### Phase 16 — Evidence Engine

Every completion claim maps to persisted evidence.

Support:
- command/test evidence;
- CI;
- diff/commit;
- logs;
- provider result;
- reviewer finding;
- external blocker.

### Phase 17 — Deterministic Verification

Implement verifier profiles:
- test;
- lint;
- typecheck;
- build;
- migration checks;
- policy checks;
- diff checks.

LLM confidence never substitutes deterministic checks.

### Phase 18 — Fresh Context Review

Implement read-only reviewer runs with:
- no builder conversation history;
- TaskContract;
- AcceptanceManifest;
- diff;
- evidence;
- architecture constraints.

### Phase 19 — Policy and Approval Engine

Consolidate existing authority work.

Order:
```text
tenant/RLS
-> entitlement
-> dependency/conflict
-> capability/role
-> P0-P4 authority
-> approval
-> action
```

Maestri orchestrates; it does not self-grant authority.

### Phase 20 — Quota and Usage Governor

Track:
- provider;
- task;
- run;
- token/request usage when available;
- cost when available;
- rate-limit state;
- quota state.

Support WAITING_QUOTA and fallback.

### Phase 21 — Real MCP bridge

Replace stubs in `apps/social-brain-mcp/src/tools/maestri.ts`.

MCP calls API/service methods:
- status;
- agents list;
- jobs/tasks create;
- get;
- context;
- dispatch.

No simulated success remains.

### Phase 22 — Command Center chat backend

Connect `/command/chat` to Maestri Gateway.

Flow:
```text
message
-> intent
-> command or TaskContract
-> persisted event
-> response
```

### Phase 23 — Command Center task UI

Add:
- task list;
- state;
- provider;
- dependency;
- blockers;
- evidence;
- attempts;
- approvals;
- usage.

### Phase 24 — Agent Office integration

Use real Agent Registry and ProviderRun state.

States:
- READY;
- RUNNING;
- WAITING;
- BLOCKED;
- PAUSED;
- ERROR;
- OFFLINE.

Remove UI-only/fake states.

### Phase 25 — User controls

Implement:
- pause all;
- resume all;
- pause provider;
- resume provider;
- cancel task;
- retry task;
- approve/reject;
- re-route task;
- request review.

All commands produce audit events.

### Phase 26 — Notifications

Notify only actionable events:
- approval required;
- blocker requires owner;
- provider unavailable beyond threshold;
- task/program complete;
- repeated failure/escalation.

### Phase 27 — Memory Gateway

Memory remains derived and provenance-bound.

Scopes:
- project;
- task;
- provider;
- global engineering preference.

No provider conversation becomes authority automatically.

### Phase 28 — Compound Learning

Create LearningCandidates from verified outcomes.

Possible promotion:
- Skill;
- rule;
- hook;
- runbook;
- memory;
- provider routing heuristic.

Promotion requires validation.

### Phase 29 — Observability

Add correlation ids:
- message_id;
- task_id;
- attempt_id;
- job_id;
- provider_run_id;
- agent_definition_hash;
- checkpoint_id;
- evidence_id.

Add metrics/traces/logs without secret leakage.

### Phase 30 — GitHub event integration

Support:
- issue trigger;
- PR trigger;
- CI failure;
- scheduled maintenance;
- dependency update;
- review completion.

GitHub events enter Maestri through authenticated ingress and policy checks.

### Phase 31 — GitHub Agentic Workflows optional execution bridge

GitHub Agentic Workflows currently support Claude Code, Codex and Gemini engines.

Use as an optional execution/event bridge, not Maestri authority.

Maestri remains source of operational state and decides when/how to invoke the bridge.

### Phase 32 — Security hardening

Test:
- prompt injection through GitHub input;
- cross-tenant task access;
- self-grant;
- secret extraction;
- replay;
- duplicate dispatch;
- forged provider callback;
- unsafe external write;
- destructive operation without approval.

### Phase 33 — Provider outage/failover

Chaos cases:
- Claude unavailable;
- Codex quota exhausted;
- Gemini unavailable;
- provider returns malformed result;
- run disappears;
- duplicate completion callback;
- timeout.

Expected outcome is deterministic WAIT/FALLBACK/FAIL, not silent success.

### Phase 34 — Long-running recovery test

Start a multi-task program.

During execution:
- restart Maestri;
- terminate provider run;
- rotate worker;
- create quota failure;
- close client UI.

System must reconstruct state and continue safely.

### Phase 35 — Mobile Command Center validation

Validate primary operations from phone/browser:
- send message;
- see status;
- approve;
- pause/resume;
- inspect blocker;
- receive notification.

### Phase 36 — Remove desktop-app dependency

Gate:
- all core Maestri state exists server-side;
- chat works without Maestri desktop app;
- provider dispatch works;
- MCP works;
- recovery works;
- approvals work.

Only after this gate can the current desktop Maestri app become optional/legacy.

### Phase 37 — Cleanup and deprecation

Deprecate:
- simulated MCP paths;
- app-only orchestration;
- duplicate provider routing;
- stale docs that contradict canonical architecture;
- duplicate schemas/components discovered in branch audit.

Never delete historical material without a migration/reference decision.

## K. Migration strategy

Do not big-bang replace.

Use:

```text
SHADOW
-> MIRROR
-> ASSISTED
-> PRIMARY
-> LEGACY OFF
```

Example:
- current Maestri remains usable;
- new server-side Job Engine mirrors state;
- compare outcomes;
- move read paths;
- move dispatch path;
- move chat;
- prove recovery;
- then remove dependency.

## L. Definition of Done

The new Maestri is considered operational only when:

1. `/command/chat` works without the current Maestri desktop app.
2. Tasks persist in Postgres.
3. State survives service restart.
4. Real provider dispatch exists for Claude, Codex and Gemini/Jules chosen surfaces.
5. Provider results are normalized and persisted.
6. Skills/config are bootstrapped from pinned Engineering OS versions.
7. Agent Factory binds version/hash to each run.
8. No fake/stub success exists in the production orchestration path.
9. Dependency scheduling works.
10. Evidence gates completion.
11. Deterministic verification runs.
12. Fresh-context review works.
13. Approval/policy gates work.
14. Quota/provider failure is explicit.
15. MCP is a client of Maestri Core.
16. Command Center shows real runtime state.
17. Pause/resume/cancel are durable.
18. Recovery from terminated session/provider is proven.
19. GitHub remains code source of truth.
20. `main` is never changed or merged automatically.


# Desktop & Mobile Product Layer — Lumenva Maestri App

## Product decision

Maestri is not only a web Command Center. Build a first-party **Lumenva Maestri Desktop** application plus a mobile/web companion, while keeping **Maestri Core** server-side and independent from the desktop process.

The desktop app is a powerful client. Closing it must not stop cloud tasks.

```text
                    LUMENVA MAESTRI
                           |
        +------------------+------------------+
        |                                     |
 Maestri Desktop                         Web / iPhone
 Electron + React                        same product UI
        |                                     |
        +--------------- Protocol ------------+
                           |
                      Maestri Core
                           |
            +--------------+--------------+
            |              |              |
         State          Scheduler       Policy
            |              |              |
            +--------------+--------------+
                           |
                    Provider Router
                  /        |         \
             Claude      Codex      Gemini/Jules
               Cloud      Cloud        Cloud
```

## Desktop stack

Initial target:
- Electron;
- React + TypeScript;
- xterm.js for terminal rendering;
- node-pty for real local PTYs;
- typed preload/contextBridge IPC;
- Zod validation at every IPC boundary;
- local runtime as a process separate from renderer;
- existing Lumenva design system where practical.

Do not place PTY/process/filesystem privileges in the renderer.

## Local Runtime

Add a dedicated **Maestri Local Runtime**.

Responsibilities:
- PTY Manager;
- Process Manager;
- Agent CLI Gateway;
- File Gateway;
- Git Gateway;
- SSH Host;
- local health/heartbeat;
- session discovery;
- session persistence/reattach;
- secure bridge to Maestri Core.

Supported initial terminal targets:
- PowerShell/pwsh;
- bash/zsh where available;
- Claude CLI;
- Codex CLI;
- Gemini CLI;
- SSH sessions.

Local Runtime state is operational execution state, not project truth.

## Host abstraction

Every local/remote interactive execution must target a Host abstraction.

```text
Host
├── LocalHost
├── SSHHost
└── CloudHost
```

Contract should cover, where applicable:
- exec;
- spawn;
- PTY open/write/resize/close;
- filesystem capability;
- git capability;
- health;
- environment metadata;
- reconnect semantics.

This keeps the UI independent from whether execution happens on Windows, macOS, Linux/VPS or provider cloud.

## Terminal architecture

```text
React TerminalPane
      |
   xterm.js
      |
Typed Terminal Protocol
      |
Local Runtime / PTY Server
      |
   node-pty
      |
PowerShell / bash / claude / codex / gemini / ssh
```

Required terminal features:
- multiple tabs;
- split panes;
- resize;
- search;
- copy/paste;
- reconnect;
- scrollback;
- exit state;
- per-session cwd;
- environment label;
- host label;
- agent/task association;
- safe session logging with secret redaction.

Never expose an unauthenticated PTY over a network interface.

## Desktop security boundary

Renderer:
- no direct Node integration;
- no arbitrary process spawn;
- no unrestricted filesystem access;
- no secret store access.

Preload:
- narrow typed API only.

Main/local runtime:
- capability-scoped process and filesystem access;
- allowlisted executable profiles for agent-managed launches;
- explicit user terminal may use normal user shell privileges;
- no privilege escalation;
- random per-launch local bridge credential;
- loopback-only local control endpoint by default.

Remote access:
- authenticated;
- encrypted;
- capability-scoped;
- auditable;
- no raw PTY exposure directly to the public internet.

## Persistent sessions

Desktop window lifecycle must be separated from agent/process lifecycle.

```text
Desktop UI closes
      |
Local Runtime remains (policy permitting)
      |
PTY / agent session continues
      |
Desktop reopens
      |
discover -> authenticate -> reattach
```

Cloud sessions are always independent from desktop lifecycle.

Local persistence implementation must be abstracted so platform-specific mechanisms can differ without changing UI contracts.

## Agent workspace UI

Each agent/task workspace exposes:

```text
[ Chat ] [ Terminal ] [ Files ] [ Diff ] [ Editor ] [ Preview ] [ CI ] [ Evidence ]
```

Initial provider tabs:
- Claude;
- Codex;
- Gemini;
- PowerShell;
- VPS (SSH);
- + new terminal.

Agent card state comes from real Agent Registry / ProviderRun / LocalRuntime state.

## Desktop information architecture

Primary sidebar:
- Projects;
- Dashboard;
- Agents;
- Tasks;
- Approvals;
- Terminal;
- Files;
- Git;
- CI / Deploy;
- Evidence;
- Memory;
- Settings.

Project column:
- project status;
- active branch/worktree;
- running tasks;
- local/cloud availability.

Main workspace:
- chat/activity;
- terminal;
- files/editor;
- diff;
- preview;
- CI/evidence.

Right task panel:
- active tasks;
- progress;
- provider;
- state;
- blocker;
- acceptance status.

Top status:
- Cloud Online/Offline;
- Local Connected/Disconnected;
- provider health;
- current project.

## Mobile / iPhone companion

Mobile is not a compressed desktop IDE. Prioritize control.

Primary mobile tabs:
- Chat;
- Tasks;
- Agents;
- Projects.

Bottom quick actions:
- Projects;
- Terminal;
- Files;
- Approvals.

Mobile capabilities:
- send Maestri messages;
- inspect task progress;
- approve/reject gated actions;
- pause/resume/cancel;
- inspect evidence/blockers;
- switch project;
- provider status;
- receive actionable notifications;
- optional terminal access with explicit connection and security gate.

Do not require mobile to keep a session alive.

## One UI, multiple transports

Avoid building unrelated desktop and web products.

Define a shared Maestri client protocol:

```text
Shared React UI / shared domain components
            |
       Maestri Client SDK
       /               \
Desktop Transport     Web Transport
IPC/local bridge      HTTPS/WebSocket
       \               /
             Maestri Core
```

Desktop-only capabilities are advertised dynamically through Capability Registry.

## Local + Cloud execution routing

Execution Router adds locality as a first-class dimension.

Inputs:
- capability;
- data locality;
- host availability;
- provider availability;
- risk;
- quota;
- cost;
- latency;
- required interactive PTY;
- network policy;
- user preference.

Possible routes:
- LOCAL_CLI;
- SSH_HOST;
- CLAUDE_CLOUD;
- CODEX_CLOUD;
- GEMINI_CLOUD;
- JULES_CLOUD;
- GITHUB_RUNNER.

Cloud remains preferred for autonomous long-running work when no local-only capability is required.

## Worktree integration

Every parallel write task gets isolated workspace identity.

```text
repo
└── .worktrees/
    ├── WP-101/
    ├── WP-102/
    └── WP-103/
```

UI must display:
- task;
- worktree;
- branch;
- provider/agent;
- dirty state;
- commit;
- CI;
- conflict status.

No two write agents share the same worktree by default.

## Command palette

Add global command palette (Ctrl/Cmd+K):
- open project;
- open agent;
- new terminal;
- new task;
- pause/resume;
- switch host;
- show approvals;
- show blockers;
- open evidence;
- reconnect runtime;
- search commands.

Natural-language commands still go through /command/chat.

## Desktop implementation phases

### Phase D0 — Existing UI/runtime audit
Inventory current Command Center components, terminal-related code, desktop experiments, local runtime code and branch variants. Mark REUSE / ADAPT / REPLACE / DROP.

### Phase D1 — Desktop workspace skeleton
Create Electron application package without duplicating business logic. Establish main/preload/renderer boundaries and shared client SDK.

### Phase D2 — Typed IPC
Define versioned Zod schemas for window, host, PTY, filesystem, git, runtime and notification messages. Add contract tests.

### Phase D3 — Local Runtime
Implement standalone local runtime lifecycle, authentication, health and capability discovery.

### Phase D4 — Real terminal MVP
Connect xterm.js -> typed bridge -> node-pty. Prove PowerShell on Windows and shell on supported Unix platform. Add resize/close/reconnect tests.

### Phase D5 — Multi-terminal manager
Tabs, splits, terminal metadata, session association, search and persistence.

### Phase D6 — Agent CLI profiles
Detect installed Claude/Codex/Gemini CLIs and expose provider launch profiles without copying credentials into Maestri storage.

### Phase D7 — Host abstraction
Implement LocalHost and SSHHost. CloudHost maps to Cloud Execution Fabric rather than pretending provider APIs are PTYs.

### Phase D8 — Session persistence
Separate desktop UI lifecycle from local runtime. Reopen and reattach to surviving sessions.

### Phase D9 — Project/worktree workspace
Bind project, task, branch, worktree, terminals, files, diff and evidence.

### Phase D10 — Files + Diff
Read scoped workspace files, Git status/diff and change navigation through typed gateways.

### Phase D11 — Editor
Embed a code editor only after filesystem/write policy is proven. Writes remain scoped to selected workspace.

### Phase D12 — Preview
Add dev-server/browser preview with explicit port/session ownership.

### Phase D13 — CI/Evidence pane
Show real checks, commits, evidence and AcceptanceManifest state.

### Phase D14 — Agent Office desktop
Bind real agent/provider/local-runtime states to cards and activity.

### Phase D15 — Command Center chat
Make Maestri chat the default top-level interaction surface, not a Claude-specific chat.

### Phase D16 — Cloud/local Execution Router
Allow task routing between local CLI, SSH and cloud providers based on capability and policy.

### Phase D17 — Web transport
Expose shared Maestri client protocol over authenticated HTTPS/WebSocket. No direct raw PTY port exposure.

### Phase D18 — iPhone responsive companion
Implement mobile control layout for chat/tasks/agents/projects/approvals and notifications.

### Phase D19 — Remote terminal gate
Only after security review, add mobile/web terminal attachment through authenticated, scoped Maestri transport.

### Phase D20 — Packaging
Produce Windows installer first, then macOS package; Linux package follows runtime validation. Add signed-update architecture without auto-enabling production updates.

### Phase D21 — Recovery/chaos
Test desktop crash, renderer crash, local runtime restart, network loss, SSH loss, Maestri Core restart and provider outage.

### Phase D22 — Security review
Threat-model PTY exposure, IPC abuse, filesystem traversal, malicious repo content, prompt injection, secret leakage, forged reconnect and remote terminal takeover.

### Phase D23 — Product acceptance
Desktop and iPhone flows must satisfy the acceptance gates below.

## Desktop/mobile acceptance gates

1. Desktop opens without starting any provider automatically.
2. Local Runtime reports capabilities and health.
3. Real PowerShell terminal works on Windows.
4. Claude/Codex/Gemini installed CLIs can be launched in isolated terminal sessions.
5. Closing/reopening UI can reattach to allowed surviving local sessions.
6. Cloud tasks continue with desktop closed.
7. Worktree identity is visible and enforced for parallel writers.
8. Renderer cannot directly spawn arbitrary OS processes through an unrestricted API.
9. Filesystem access is workspace/capability scoped.
10. Remote terminal is not publicly exposed.
11. iPhone can chat, inspect progress, approve and pause/resume.
12. Same task state is visible on desktop and mobile.
13. Evidence and acceptance state are identical across clients.
14. Local/cloud routing is explicit and auditable.
15. Provider credentials are not copied into project files or Maestri logs.
16. Desktop app is optional for cloud execution.
17. Existing Maestri desktop dependency can be removed without losing orchestration capability.

## Product UX target

The approved visual direction is a dark Lumenva command-room interface with:
- projects and agents on the left;
- Maestri chat/activity in the center;
- live task progress on the right;
- terminal + explorer in the lower workspace;
- clear Cloud/Local connectivity state;
- responsive iPhone companion focused on chat, progress and approvals.

The UI must remain information-dense but operational: every status shown should be backed by real state, never decorative fake progress.


# Canonical 14-Task Implementation Program

## Purpose

This section consolidates the fragmented Maestri / Command Center / Local Runtime / Context Gateway / Engineering Council / Frontier Workforce plans into one implementation program with exactly **14 bounded work packages**.

It does not authorize implementation, merge, rebase, production changes, branch deletion or automatic merge to `main`.

Core rule:

> One architecture owner. One technical integration owner. Fourteen bounded builders. One independent integration guardian. Deterministic evidence decides completion.

## Command structure

```text
OWNER
  |
  v
CLAUDE CEO / PRINCIPAL ARCHITECT / CONTEXT CUSTODIAN
  |
  v
MAESTRI — durable governor, scheduler and source of operational state
  |
  +-------------------------------+
  |                               |
  v                               v
CODEX CTO / INTEGRATION LEAD      JULES WORKFORCE
                                  J01 ... J14
                                  one Work Package each
  |                               |
  +---------------+---------------+
                  |
                  v
        J15 INTEGRATION GUARDIAN
        fresh context / read-only
                  |
                  v
        DETERMINISTIC VERIFIER
                  |
                  v
        CODEX CTO CROSS-REVIEW
                  |
                  v
        CLAUDE CEO ACCEPTANCE
                  |
                  v
             HUMAN GATE
```

### Claude CEO

Permanent architecture authority for this program.

Owns:
- product intent;
- canonical architecture;
- Context & Decision Ledger;
- decomposition into the 14 TaskContracts;
- cross-task architectural decisions;
- conflict resolution;
- acceptance of architectural changes;
- scope control;
- final release-readiness recommendation.

Does not become the default implementation worker.

### Maestri

Software governor, not another LLM hierarchy level.

Owns:
- durable state;
- TaskContracts;
- dependencies;
- conflict graph;
- scheduler;
- work-package release;
- provider/runtime routing;
- checkpoints;
- evidence references;
- approval state;
- retries and escalation.

### Codex CTO

Permanent technical integration lead.

Owns:
- deep repository interpretation when a worker is blocked;
- cross-module technical decisions delegated by Claude CEO;
- integration review across packages;
- resolving incompatible implementation proposals;
- difficult changes that exceed a bounded worker;
- reviewing J15 findings;
- preparing the integrated technical state for Claude CEO acceptance.

Codex CTO must not become a second product architect.

### J01-J14

Fourteen bounded implementation workers.

Rules:
- exactly one canonical Work Package per worker;
- one isolated branch/worktree/task environment;
- no architecture expansion;
- no cross-task ownership;
- cannot modify another worker's TaskContract;
- must return ResultDigest + Evidence;
- if dependency or architecture is missing: BLOCKED, do not invent.

### J15 — Integration Guardian

J15 is **not Security Lead and not another coordinator**.

J15 is the independent integration/coverage guardian because the dominant risk of fourteen parallel work packages is architectural drift, duplication and contract mismatch.

J15:
- starts from fresh context;
- is read-only by default;
- receives the canonical Blueprint, 14 TaskContracts, diffs, ResultDigests, AcceptanceManifests and evidence;
- checks cross-task contracts, duplicated responsibilities, data ownership, naming, adapter boundaries, dependency violations and missing capabilities;
- runs the Anti-Loss Gate against the consolidated result;
- emits PASS / FAIL / BLOCKED plus minimal required corrections;
- never fixes its own findings.

Security remains a separate specialist gate after integration when the implementation reaches the appropriate phase. Security must not replace the integration guardian.

## Branch contribution ledger

### `vps`
Canonical future architecture:
- Maestri V3;
- Personal AI Engineering OS;
- context engine;
- MCP gateway;
- tool registry;
- knowledge/graph work;
- cloud execution gates;
- provider-oriented architecture.

Primary destination: Tasks 1, 4, 5, 6, 12 and 13.

### `lumenva-command-center`
Reusable implementation/evidence for:
- Lumenva Core;
- terminal runtime concepts;
- bridge;
- event bus;
- storage;
- telemetry;
- Maestri Context Gateway;
- Command Center plan.

Primary destination: Tasks 2, 3, 9, 10 and 13.

### `lumenva-command-center-blueprint-v2`
Product/UI architecture:
- deterministic control plane;
- agent runtime;
- context;
- execution;
- observability;
- evaluation;
- desktop;
- visual office.

Primary destination: Tasks 9, 10 and 11.

### `lumenva-local-runtime`
Reusable local execution design and implementation:
- persistent local runtime;
- command runner boundary;
- local executor;
- recovery;
- runtime contracts.

Primary destination: Task 8.

### `TOKENS`
Frontier-brain and workforce architecture:
- Task Graph;
- tiered routing;
- Context Gateway / MCG;
- Resource Router policy;
- evidence;
- independent verification;
- usage/budget concepts.

Primary destination: Tasks 3, 5, 6 and 13.

### `feat/maestri-engineering-council*`
Role separation:
- Claude Maestro;
- Codex Builder;
- Gemini executor;
- Independent Reviewer;
- deterministic verifier.

Absorbed into the canonical command structure and Task 12. It must not create a second orchestration system.

### `feat/f1-identity-mapping` and `feat/f2-tenant-isolation`
Identity and tenant-boundary evidence.

Preserve as architectural constraints for state, policy and API boundaries. Do not duplicate identity or tenancy in Maestri.

### `security/mcp-auth-rate-limit`
Security-boundary evidence for remote/MCP surfaces.

Preserve for the later security gate. It is not a separate Maestri auth system.

### `voz`, Meta branches and domain feature branches
Remain product/domain capabilities and consumers of the platform.

Do not absorb voice, Meta or domain business logic into Maestri Core.

### Backup/chore branches
Historical evidence only unless a specific contract or doctrine is explicitly promoted by the canonical Blueprint.

## Canonical capability ownership

```text
Intent / architecture                -> Claude CEO
Durable orchestration state          -> Maestri Core
Technical integration                -> Codex CTO
Task execution                       -> bounded worker
Agent definition/versioning          -> Agent Factory
Context selection/recovery           -> Context Engine
Scheduling/dependencies              -> Task Graph + Scheduler
Executor/model selection             -> Resource Router
Cloud execution                      -> Cloud Execution Fabric
Local execution                      -> Local Runtime
Code truth                           -> GitHub
Operational truth                    -> Postgres
Verification                         -> deterministic Verifier
Independent integration review       -> J15 Integration Guardian
Acceptance/evidence                  -> Acceptance + Evidence Engine
Human authorization                  -> Human Gate
```

No second scheduler, queue, router, memory authority, approval engine or orchestration hierarchy may be introduced by a work package.

# The 14 canonical Work Packages

## T01 — Canonical Contracts & Repository Architecture

**Worker:** J01 — Contracts Architect

**Origin:** `vps` Maestri V3 + Personal AI Engineering OS + Engineering Council contracts.

**Destination:** one provider-neutral contracts package and one canonical repository map.

**Responsibility:**
- TaskContract;
- AcceptanceManifest;
- ResultDigest;
- FailureDigest;
- StateCheckpoint;
- ProviderRun;
- AgentDefinition;
- Evidence reference contracts;
- version/hash rules;
- canonical naming glossary.

**Dependencies:** none after Blueprint freeze.

**Must absorb:** overlapping contract definitions in MCG, Command Center plans and provider-specific notes.

**Must not absorb:** provider implementation details.

**Result:** every other work package codes against the same schemas and vocabulary.

**Done when:** schemas are versioned, ownership is unambiguous, duplicate contract names are mapped to one canonical concept.

## T02 — Maestri State/Event/Job Kernel

**Worker:** J02 — Core State Builder

**Origin:** Operating Core concepts, Lumenva Core, current Maestri job/MCP surfaces, V3 State Ledger.

**Destination:** one durable Maestri Core state/event/job kernel.

**Responsibility:**
- jobs/tasks;
- attempts;
- leases/claims;
- lifecycle transitions;
- events;
- checkpoints;
- idempotency;
- resume semantics;
- Postgres operational ownership.

**Dependencies:** T01.

**Must absorb:** competing job/session state concepts.

**Result:** no task state depends on chat, renderer memory or a provider session.

**Done when:** one documented state machine owns task/job transitions and survives process/session replacement.

## T03 — Task Graph, Scheduler & Resource Router

**Worker:** J03 — Scheduling Builder

**Origin:** TOKENS Task Graph, MCG DAG/scheduler, Operating Core ResourceRouter, V3 Conflict Graph.

**Destination:** one dependency/conflict-aware scheduling and routing domain.

**Responsibility:**
- DAG;
- dependency unlock;
- conflict graph;
- priorities;
- concurrency;
- resource class;
- provider/runtime candidate selection;
- WAITING states;
- bounded retry scheduling.

**Dependencies:** T01, T02.

**Must absorb:** duplicate scheduler/router logic.

**Result:** a task has one scheduling path and one routing decision record.

**Done when:** dependencies, conflicts and routing use canonical contracts and cannot create a second queue/router.

## T04 — Engineering OS, Skills & Agent Factory

**Worker:** J04 — Agent Platform Builder

**Origin:** Personal AI Engineering OS + V3 mandatory Agent Factory.

**Destination:** one versioned provider-neutral agent/skill/config system.

**Responsibility:**
- Constitution;
- shared Skills;
- AgentDefinition;
- Agent Factory;
- Agent Registry;
- provider compiler;
- configuration compiler;
- capability discovery;
- version pinning.

**Dependencies:** T01.

**Must absorb:** provider-specific duplicate role definitions where they are logically equivalent.

**Result:** logical agents are defined once and compiled/mapped to native provider capabilities.

**Done when:** no runtime agent can become READY without a validated, versioned definition or explicit native mapping.

## T05 — Context, Memory, Checkpoint & Recovery Engine

**Worker:** J05 — Context Builder

**Origin:** V3 Context Engine, MCG, TOKENS Context Gateway, current context-budget/retriever work.

**Destination:** one context/recovery pipeline.

**Responsibility:**
- ContextPacket;
- progressive disclosure;
- instruction resolver;
- code/knowledge retrieval;
- provenance;
- context budget;
- State Ledger recovery;
- checkpoint reconstruction;
- scoped memory retrieval;
- compaction recovery.

**Dependencies:** T01, T02, T04.

**Must absorb:** duplicate token/context-saving systems.

**Result:** context is reconstructed from durable sources rather than full session replay.

**Done when:** a fresh provider session can continue a task from contract + checkpoint + evidence + Git state.

## T06 — Cloud Provider Execution Fabric

**Worker:** J06 — Cloud Adapter Builder

**Origin:** V3 cloud architecture, provider plans, manual Jules/Codex workflows, Engineering OS adapters.

**Destination:** one Cloud Execution Fabric.

**Responsibility:**
- Claude adapter;
- Codex adapter;
- Gemini/Jules family adapter;
- provider health;
- dispatch;
- poll/callback;
- cancellation;
- result normalization;
- failure normalization;
- usage normalization;
- fallback hooks.

**Dependencies:** T01, T03, T04, T05.

**Must absorb:** fake/simulated provider-success paths.

**Result:** provider differences stay behind one adapter contract.

**Done when:** Maestri can represent a real provider run without provider-specific state leaking into core scheduling contracts.

## T07 — GitHub, Worktrees & Execution Workspace Fabric

**Worker:** J07 — Workspace Builder

**Origin:** Engineering Council Floors, Codex worktree patterns, cloud execution branch/PR flows.

**Destination:** one execution workspace abstraction.

**Responsibility:**
- repo/ref resolution;
- isolated worktree/workspace identity;
- branch ownership;
- commit/diff references;
- PR/CI correlation;
- GitHub event ingress;
- workspace cleanup lifecycle;
- conflict metadata.

**Dependencies:** T01, T02, T03, T06.

**Must absorb:** parallel ad-hoc branch/worktree ownership models.

**Result:** every write task has an explicit isolated workspace and Git identity.

**Done when:** two parallel write tasks cannot silently share one mutable workspace.

## T08 — Local Runtime & Host Abstraction

**Worker:** J08 — Local Runtime Builder

**Origin:** `lumenva-local-runtime` + desktop terminal plan.

**Destination:** one persistent Maestri Local Runtime.

**Responsibility:**
- LocalHost;
- SSHHost;
- runtime heartbeat;
- PTY/process manager boundary;
- filesystem/git gateway;
- local agent CLI gateway;
- reconnect/session discovery;
- runtime capability reporting.

**Dependencies:** T01, T02, T03, T04.

**Must absorb:** local execution functionality from earlier terminal/runtime experiments without creating another scheduler/job engine.

**Result:** desktop closure does not define Maestri job lifetime.

**Done when:** local execution is a capability provider beneath Maestri, not a second orchestrator.

## T09 — Desktop App & Embedded Terminal Workspace

**Worker:** J09 — Desktop Builder

**Origin:** Command Center V2 + approved desktop mockup + terminal-runtime concepts.

**Destination:** first-party Lumenva Maestri Desktop.

**Responsibility:**
- Electron shell;
- React UI;
- typed preload/IPC;
- xterm.js terminal panes;
- node-pty integration through Local Runtime;
- projects;
- terminal tabs/splits;
- files;
- diff;
- editor surface;
- preview surface;
- CI/evidence pane.

**Dependencies:** T01, T08.

**Must absorb:** duplicate desktop/terminal UI concepts.

**Result:** one desktop workspace for Maestri, Claude/Codex/Gemini terminals and project state.

**Done when:** UI contains no unrestricted process/filesystem authority and all runtime actions use typed capability boundaries.

## T10 — Command Center Chat, Tasks & Agent Office

**Worker:** J10 — Command Center Builder

**Origin:** `lumenva-command-center`, Command Center Blueprint V2, current /command concepts.

**Destination:** one primary Maestri interaction surface.

**Responsibility:**
- /command/chat;
- task list;
- task detail;
- provider/run status;
- Agent Office;
- approvals surface;
- blockers;
- evidence links;
- pause/resume/cancel/retry commands;
- activity stream.

**Dependencies:** T01, T02, T03, T04, T06.

**Must absorb:** decorative/fake agent state.

**Result:** every visible state is derived from real Maestri state.

**Done when:** the user can operate Maestri without opening a provider-specific app.

## T11 — Web/iPhone Companion & Shared Client Protocol

**Worker:** J11 — Mobile/Web Builder

**Origin:** desktop/mobile product layer and Command Center responsive requirements.

**Destination:** one shared client SDK/protocol with desktop and web/mobile transports.

**Responsibility:**
- HTTPS/WebSocket client transport;
- responsive iPhone UI;
- Chat;
- Tasks;
- Agents;
- Projects;
- Approvals;
- actionable notifications;
- remote status;
- explicit gated remote terminal attachment later.

**Dependencies:** T02, T09, T10.

**Must absorb:** any proposal for a separate unrelated mobile product.

**Result:** desktop and iPhone read the same Maestri task/evidence truth.

**Done when:** closing the phone/browser does not affect execution and mobile can control approved workflow actions.

## T12 — Evidence, Acceptance, Verification, Review & Approval

**Worker:** J12 — Verification Platform Builder

**Origin:** V3 Evidence Validator, Engineering Council verifier/reviewer, existing approvals/authority work.

**Destination:** one completion and approval pipeline.

**Responsibility:**
- AcceptanceManifest state;
- Evidence records;
- deterministic verifier profiles;
- fresh-context reviewer contract;
- approval state;
- authority envelope integration;
- PASS/FAIL/BLOCKED semantics;
- no self-approval.

**Dependencies:** T01, T02, T04.

**Must absorb:** duplicate completion/reviewer concepts.

**Result:** DONE is impossible from model assertion alone.

**Done when:** mandatory acceptance requires evidence + deterministic verification + independent review where policy requires it.

## T13 — Observability, Provider Health, Quota & Usage

**Worker:** J13 — Observability Builder

**Origin:** MCG telemetry/dashboard, TOKENS budgets, V3 telemetry/audit and provider governors.

**Destination:** one observability/usage domain.

**Responsibility:**
- correlation IDs;
- provider health;
- runtime health;
- exact/estimated/unavailable measurement labels;
- quota state;
- usage/cost where available;
- alerts;
- retry/loop visibility;
- trace/evidence references;
- redaction.

**Dependencies:** T02, T06, T08.

**Must absorb:** duplicate telemetry dashboards and invented metrics.

**Result:** operational decisions use attributable measurements.

**Done when:** UI and router can distinguish exact, estimated and unavailable data without fabricating usage.

## T14 — Consolidation Migration, Legacy Retirement & Release Readiness

**Worker:** J14 — Consolidation Builder

**Origin:** all relevant branches and the Blueprint's Dry Project protocol.

**Destination:** one canonical implementation line.

**Responsibility:**
- final branch-to-component mapping;
- migration order;
- shadow/mirror/assisted/primary rollout;
- legacy markers;
- documentation supersession;
- duplicate module retirement candidates;
- final repository structure;
- implementation coverage ledger;
- release-readiness package.

**Dependencies:** T01-T13.

**Must absorb:** historical plans as evidence, not parallel roadmaps.

**Result:** one capability -> one canonical owner -> one canonical implementation path.

**Done when:** every relevant branch/capability is explicitly preserved, absorbed or marked legacy with rationale and no capability disappears silently.

# Dependency waves

Do not launch all fourteen write tasks simultaneously.

```text
WAVE 0
T01

WAVE 1
T02   T04

WAVE 2
T03   T05   T08   T12

WAVE 3
T06   T09   T13

WAVE 4
T07   T10

WAVE 5
T11

WAVE 6
T14

CONTINUOUS
J15 Integration Guardian reviews every completed wave from fresh context.
```

Workers can be registered up front, but Maestri releases each TaskContract only after its dependencies are satisfied.

# J15 review contract

Inputs:
- canonical Blueprint;
- Context & Decision Ledger;
- Branch Contribution Ledger;
- T01-T14 TaskContracts;
- completed ResultDigests;
- diffs/artifacts;
- AcceptanceManifests;
- evidence;
- current dependency graph.

Checks:
1. no duplicate scheduler/queue/router;
2. no duplicate state authority;
3. no provider-specific semantics leaked into canonical core;
4. no second orchestrator;
5. no task widened its ownership;
6. no capability disappeared;
7. naming is canonical;
8. data/state ownership is unique;
9. local/cloud boundaries remain explicit;
10. Desktop/Web clients do not become state authority;
11. builder did not become verifier;
12. workspaces remain isolated;
13. legacy designation has rationale;
14. all fourteen outputs can compose into one product.

Output:
```text
STATUS: PASS | FAIL | BLOCKED
CROSS_TASK_FINDINGS
DUPLICATION_FINDINGS
MISSING_CAPABILITIES
CONTRACT_VIOLATIONS
DEPENDENCY_VIOLATIONS
ANTI_LOSS_RESULT
REQUIRED_CORRECTIONS
RESIDUAL_UNCERTAINTY
```

# Context & Decision Ledger — canonical additions

- The product is one Lumenva Maestri, not three provider-specific systems.
- Claude CEO is the single architecture/context authority for this program.
- Codex CTO is the technical integration authority, not a second product architect.
- Maestri is software governance/state, not another competing LLM manager.
- J01-J14 are bounded workers, not architectural authorities.
- J15 is Integration Guardian, not Security Lead and not coordinator.
- Security review remains a separate later specialist gate.
- GitHub remains code truth.
- Postgres remains operational truth.
- Conversation/provider session state is never durable truth.
- Local Runtime is execution capability, not another job engine/router.
- MCG is a separate canonical product/repository consumed by Maestri V3 through a commit-pinned package dependency; Lumenva owns only its Core adapter and orchestration, with no copied MCG source tree.
- TOKENS workforce routing is absorbed into the one Resource Router, not maintained as a second workforce scheduler.
- Engineering Council role separation survives; its orchestration implementation is absorbed into Maestri + canonical roles.
- Voice, Meta and product-domain capabilities remain outside Maestri Core.
- No automatic merge to `main`.
- No plan can mark completion without AcceptanceManifest + Evidence.
- One responsibility must have one architectural owner.

# Anti-Loss Gate for the 14-task program

Before T14 can report READY:

1. Recompare final architecture against every relevant branch.
2. Recompare against `docs/MAESTRI_AGENT_ARCHITECTURE.md`, Personal AI Engineering OS, Command Center plans, Local Runtime plans, TOKENS plan and Engineering Council docs.
3. Confirm every identified capability has exactly one of:
   - PRESERVED;
   - ABSORBED;
   - LEGACY WITH RATIONALE;
   - OUTSIDE MAESTRI DOMAIN.
4. Confirm no capability disappeared because of naming differences.
5. Confirm no duplicate queue/router/context/memory/state/approval system survived.
6. Confirm the final repository map names the canonical owner of every responsibility.
7. Confirm the 14 ResultDigests compose without contradictory contracts.
8. J15 must issue Anti-Loss PASS before Claude CEO performs final architectural acceptance.

# Program Definition of Done

The 14-task program is implementation-ready only when:
- the canonical Blueprint is the only active architectural roadmap;
- every TaskContract is bounded and dependency-scoped;
- Claude CEO, Codex CTO, Maestri and J15 authority boundaries are explicit;
- all relevant branches are mapped;
- duplicate concepts have one canonical destination;
- state/data ownership is unambiguous;
- the target repository structure is explicit;
- the rollout order is explicit;
- each task has measurable acceptance;
- J15 can review the entire program without builder history;
- no branch is merged/deleted merely by producing this plan.
## 54. Unified execution plan — five Jules work packages

This is the single execution breakdown for the pending Maestri V3 work discussed on 2026-09-23. It does not create a second roadmap. The phases below retain the M0–M42 identifiers and acceptance gates already defined above. Jules sessions are execution workers, not additional sources of truth; completed work is reconciled here and in the existing evidence artifacts.

### Shared session contract

- Repository: `trydavidqix/Lumenva`; starting branch: `vps`. No task may target or merge into `main`.
- Preserve all current host/global and repository/project provider settings. In particular, do not edit global Claude/Codex/Gemini settings, `.codex/config.toml`, `.gemini/settings.json`, `.claude/settings.json`, credentials, MCP registrations, hooks, permission modes or bypass/lockdown settings as part of these work packages.
- No Docker installation/use, secret creation or extraction, production deployment, GitHub ruleset/branch-protection writes, or merge. Record owner-only actions as explicit placeholders for the final gate.
- Before changing files, inspect the assigned scope and existing branches/PRs/sessions. Do not duplicate the five active F3 RBAC Jules tasks, the completed read-only Maestri V3 audit, or any existing implementation. Keep the F3 work on its existing branch and ownership map.
- Each session starts from zero: its prompt must contain the repository, branch, role, exact scope, safety constraints, acceptance criteria and complete command sequence. In the Jules VM, inspect first, install dependencies successfully (`pnpm install --frozen-lockfile`) and only then run tests/build/lint/typecheck. If installation fails, diagnose and repair only the disposable VM environment before running checks; never change the committed lockfile merely to bypass setup.
- Follow test-first where appropriate; repeat fix-and-test until acceptance passes or an exact external/architectural blocker is documented. Do not widen owned paths. No agent-to-agent direct messages; all handoffs/results return through the Maestri owner/orchestrator.
- Jules can create a working branch/PR against `vps` for review. PR creation is allowed; merge is not. Every claimed PASS needs command, exit status and concise evidence. Keep raw logs and secrets out of prompts, PRs and reports.

### Work package 1 — Canonical contracts, durable state and recovery

**Phases:** M0–M4. **Role:** State & Context Engineer. **Scope:** reconcile current implementation first; then only confirmed gaps in the existing canonical contracts, task state machine, State Ledger and recovery implementation under `packages/operating-core/src/session/`, `packages/operating-core/src/backup/`, and their focused tests. Do not create a second Context Engine or state store; reuse the existing `apps/core` and MCG bridges through their current contracts. Do not edit roadmap/config files.

**Done when:** existing behavior is mapped; canonical transitions reject invalid state changes; checkpoints survive restart/replay; recovery tests reconstruct objective, decisions, acceptance state and next action from durable evidence; package tests and typecheck pass.

### Work package 2 — Context, knowledge and Skills

**Phases:** M5–M7. **Role:** Context & Knowledge Engineer. **Scope:** confirmed gaps in context budgets/progressive retrieval, repository knowledge hierarchy and shared skill catalog under `packages/operating-core/src/context/`, `packages/operating-core/src/knowledge/`, and `packages/operating-core/src/memory/`, with only directly related tests. Preserve the existing `packages/operating-core` `ContextPacket` as canonical and the current `apps/core` adapter; no parallel packet/compiler, no global or project provider configuration edits.

**Done when:** hard limits are deterministic; context expansion is demand-driven; instructions/knowledge/skills are scoped and provenance-aware; tests prove caps, ordering, exclusion and reproducibility; package tests and typecheck pass.

### Work package 3 — Agent Factory and provider harness

**Phases:** M8–M21. **Role:** Agent & Provider Fabric Engineer. **Scope:** confirmed gaps in definitions/validation/catalog, Claude/Codex/Jules adapters, execution results and provider capability/health behavior under `packages/operating-core/src/workforce/` and `packages/operating-core/src/cloud-fabric/`, with tests in those same package areas. Use the existing Jules connection; do not reinstall the host CLI/SDK/MCP/skills or create duplicate tools. A provider that cannot be exercised must report unavailable honestly, with an offline/mock test.

**Done when:** provider-neutral contracts remain stable; capability probing is real; unsupported actions fail closed; handoffs pass through Maestri and bounded ContextPackets; execution results/evidence are normalized; focused tests and typecheck pass.

### Work package 4 — Routing, budgets, scheduling and bounded loops

**Phases:** M22–M28. **Role:** Scheduler & Loop Engineer. **Scope:** confirmed gaps in usage/quota accounting, fleet scheduling, plan validation, retry/loop detection, failure classification and escalation under `packages/operating-core/src/router/`, `packages/operating-core/src/autonomy/`, and their focused tests. Respect work-package dependencies and conflict ownership; never dispatch duplicate work or spend/consume credentials to test a provider.

**Done when:** routing decisions are reproducible from capability/risk/context/quota/cost/latency inputs; retries are bounded and budgeted; repeated failures change strategy or escalate; tests cover no-progress, provider unavailability, quota exhaustion and conflicting paths; package tests and typecheck pass.

### Work package 5 — Evidence, observability, integration verification and rollout readiness

**Phases:** M29–M42 plus the existing external gates. **Role:** Independent Evidence & QA Engineer. **Scope:** first reuse the completed Maestri V3 read-only audit and existing tests/evidence; then fill only verified gaps in evidence validation, fresh-context review, CI evidence ingestion, telemetry and E2E recovery tests. Prefer read-only verification. Do not edit provider settings, Windows profile paths, secrets, CI permissions, GitHub protections, or files owned by packages 1–4. Record profile/path issues in the existing audit evidence only; do not execute a migration. Owner-dependent items remain placeholders at the end.

**Done when:** each acceptance claim links to reproducible evidence; telemetry remains secret-safe and local fallback works; long-running recovery/E2E and negative gates pass; external gates are clearly `READY`, `BLOCKED` or `OWNER ACTION REQUIRED`; no merge/deploy occurs.

### Dependency and dispatch order

1. Package 1 establishes the verified baseline and durable contracts. Packages 2–4 may inspect in parallel, but implementation must stop if it requires an unmet contract from package 1 or another active owner.
2. Package 2 consumes package 1 contracts. Package 3 consumes packages 1–2 contracts. Package 4 consumes packages 1–3 contracts. Shared paths are serialized; do not ask two Jules sessions to edit one path concurrently.
3. Package 5 verifies only the integrated candidate after packages 1–4 return. The existing Maestri audit is evidence to reuse, not a reason to spawn another audit session.
4. Human-dependent gates are last: Google/Graphiti or OTLP credentials/endpoints, any secrets/permissions, GitHub required checks/rulesets, exact app-error reproduction requiring the user's device, and final merge/deploy. Until then, use mocks/offline tests and explicit placeholders.

**Progress accounting:** do not claim a single percentage for M0–M42 until the canonical State Ledger/AcceptanceManifest records denominator and evidence. Report each package as `completed/total`, with blocked owner gates shown separately rather than counted as silently done.
