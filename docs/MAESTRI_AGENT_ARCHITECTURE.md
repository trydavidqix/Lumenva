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

## 10. Claude CEO harness

Create a Lumenva/Maestri Claude integration layer containing:
- CEO role instructions;
- project settings;
- approved hooks;
- skills;
- bounded specialist agents;
- Maestri MCP access;
- session/checkpoint integration.

Specialist roles:
- architecture reviewer;
- security reviewer;
- plan reviewer;
- QA reviewer;
- dependency analyst;
- incident diagnostician.

Use subagents primarily for high-volume reading/exploration and return digests. Agent Teams remain shadow/experimental until benchmarked.

## 11. Hooks

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

## 12. MCP Gateway and capability grants

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

## 13. Master Planner

Master Goal → semantic decomposition → dependency analysis → conflict analysis → coherent Work Packages.

Do not map every plan line to one agent task. A provider task may contain many internal PlanSteps.

## 14. Dependency Graph

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

## 15. Conflict Graph

Track:
- exact file overlap;
- package/module overlap;
- migration/schema overlap;
- API contract overlap;
- semantic ownership overlap.

Aggressive parallel reads are allowed. Concurrent writes require isolated branches/workspaces and conflict approval.

## 16. Prompt Compiler

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

## 17. Execution Router

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

## 18. Cloud-first compute

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

## 19. Codex Cloud Environment Manager

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

## 20. Network policy

```text
OFF
SETUP_ONLY
DEPENDENCIES
DOCUMENTATION_ALLOWLIST
SERVICE_ALLOWLIST
FULL
```

Default OFF. FULL requires explicit justification/policy.

## 21. Secret policy

Secret Manager is authority. Agents receive references or short-lived/minimum grants. Never store secret values in:
- repository;
- State Ledger;
- evidence;
- traces;
- prompts intended for persistence;
- docs.

## 22. Jules Fleet

Jules is the asynchronous fleet provider. Account/provider limits must be discovered and tracked, not assumed forever.

Quota Guard maintains:
- rolling usage;
- current concurrency;
- remaining allowance;
- reservations;
- projected pressure;
- blocked tasks.

Reserve capacity for urgent/recovery work when practical.

## 23. Jules Plan Validator

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

## 24. Risk model

```text
R0 read/docs/tests        → AUTO
R1 isolated normal code   → AUTO
R2 important module       → VALIDATOR
R3 infra/security         → CLAUDE
R4 prod/main/secrets/IAM  → HUMAN
```

## 25. Jules Swarm

Use only for high-uncertainty problems where multiple independent approaches have expected value. It consumes explicit budget and never becomes default execution.

## 26. Codex Usage Governor

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

## 27. Internal model/capability router

Providers may expose multiple model/capability profiles. Route by capability and current documented availability, not hard-coded marketing names.

Profiles:
- explorer: read-heavy, cheap/fast;
- builder: write/test;
- reviewer: fresh context, read-only;
- heavy engineer: deep reasoning;
- verifier: deterministic-first.

## 28. Loop Engine

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

## 29. Loop Detector

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

## 30. Failure Classifier

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

## 31. Escalation Engine

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

## 32. Tool Budget

TaskContract can specify:
- soft warning;
- hard tool-call cap;
- per-tool limits;
- external-write prohibition;
- time/execution budget.

Budget exhaustion creates an event and requires policy-based retry/escalation, not silent looping.

## 33. Evidence model

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

## 34. Progress Evidence Guard

Claims such as “tests passed”, “build succeeded”, “migration succeeded”, “PR ready” or “deploy succeeded” must reference evidence. Unsupported claims do not advance AcceptanceManifest.

## 35. Cross-agent review

Preferred:
- Jules builder → Codex review;
- Codex builder → Jules/CI validation;
- R3 → builder → independent reviewer → Claude.

Reviewer must not inherit builder reasoning by default.

## 36. GitHub execution model

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

## 37. CI Fixer

CI failure:
1. ingest failing checks/log digest;
2. classify;
3. return to responsible builder or CI-fix skill;
4. commit correction;
5. rerun CI;
6. escalate only after policy threshold.

## 38. Compound Learning Engine

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

## 39. Memory and provenance

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

## 40. Operational truth

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

## 41. Scheduler and queues

Priorities:
`urgent | high | normal | low | maintenance`.

Waiting states:
`WAITING_DEPENDENCY | WAITING_RESOURCE | WAITING_QUOTA | WAITING_APPROVAL | WAITING_EXTERNAL`.

Waiting work does not occupy an execution slot.

## 42. PC Resource Guard

Observe CPU, RAM, swap, disk and network. Under host pressure:
- stop dispatching nonessential local compute;
- prefer Codex Cloud/Jules;
- preserve control plane and interactive operations.

## 43. Observability

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

## 44. Command Center

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

## 45. Repository target

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

## 46. External Gates — first operational block

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

## 47. Implementation program

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

### Phase 8 — Claude CEO harness
CEO role, specialist agents, hooks, Maestri MCP integration and checkpoint events.

### Phase 9 — Prompt Compiler
Provider-neutral compile + Claude/Codex/Jules transforms.

### Phase 10 — Dependency Graph
Persistence, readiness calculation and UI/event model.

### Phase 11 — Conflict Graph
File/module/semantic conflict detection and serialization.

### Phase 12 — Policy Engine
Risk R0–R4, main/prod/secrets/IAM rules and capability grants.

### Phase 13 — Hook Engine
Canonical events + provider event adapters.

### Phase 14 — GitHub Adapter
Branch/commit/PR/check/review/evidence primitives.

### Phase 15 — Codex Adapter
Local/worktree/cloud unified ExecutionPort.

### Phase 16 — Codex Cloud Environment
Minimal reproducible environment and network/secret policy validation.

### Phase 17 — Cloud-first Router
Offload reproducible compute and respect PC Resource Guard.

### Phase 18 — Jules Adapter
Sessions/tasks/results/plan interaction behind ExecutionPort.

### Phase 19 — Jules provider validation
Gemini/provider capability probing, health and plan semantics.

### Phase 20 — Quota/Usage Governors
Jules rolling/concurrency ledger; adaptive Codex usage governor.

### Phase 21 — Fleet Scheduler
Dependency/conflict/risk/quota/resource-aware scheduling.

### Phase 22 — Plan Validator
PASS/REVISE/BLOCK with deterministic checks where possible.

### Phase 23 — Loop Engine
Plan→act→observe→verify→classify→retry/replan/escalate.

### Phase 24 — Loop Detector
Repeated-error/no-progress detection and budget enforcement.

### Phase 25 — Failure Classifier
Canonical taxonomy and tests for representative failures.

### Phase 26 — Escalation Engine
Policy-driven retry, queue, provider change and CEO escalation.

### Phase 27 — Evidence system
Evidence schema, Progress Evidence Guard and AcceptanceManifest linkage.

### Phase 28 — Fresh Context Reviewer
Independent review packets with no builder-history contamination.

### Phase 29 — Cross-Agent Review
Jules↔Codex and critical Claude review workflows.

### Phase 30 — CI integration
CI fixer loop, check ingestion and evidence correlation.

### Phase 31 — Compound Learning Engine
LearningCandidate extraction, validation, dedupe and promotion.

### Phase 32 — Memory/provenance
Project/provider/task memory with evidence and supersession.

### Phase 33 — Telemetry
Local traces first; optional OTLP; complete correlation.

### Phase 34 — Resource Guard
PC pressure telemetry and automatic offload behavior.

### Phase 35 — Command Center
System/fleet/task/evidence/recovery/loop/quota views.

### Phase 36 — E2E long-horizon recovery tests
Prove task survives:
- provider context compaction;
- process restart;
- session replacement;
- provider failure;
- quota wait;
- CI failure;
without losing objective, decisions, acceptance state or evidence.

### Phase 37 — Chaos/failure tests
Inject auth, network, quota, dependency, conflict, collector and provider failures.

### Phase 38 — Security validation
Secrets, capabilities, network, prompt injection boundaries, external writes and R4 gates.

### Phase 39 — Production hardening
Performance, migrations, retention, backup/recovery, operational docs and final release gate.

## 48. Definition of Done

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

## 49. Long-horizon no-forgetting acceptance test

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

## 50. E2E target

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

## 51. Sources and design rationale

This blueprint follows the agent-first direction documented by OpenAI's harness engineering work: repository knowledge as system of record, progressive disclosure instead of giant instruction manuals, executable plans, agent-to-agent review, worktree isolation and feedback loops. It also follows Anthropic's context-engineering guidance: context is finite, long-horizon work needs compaction/structured state/multi-agent techniques, and context should be curated for high signal.

Implementation must prefer current official provider documentation over copied system prompts, community leaks or stale assumptions.

## 52. Supersession rule

This file is now the **single canonical Maestri V3 architecture and implementation blueprint**.

Older Maestri V3 plan text is superseded by this file except:
- the detailed three-external-gates execution document explicitly linked above;
- audit/evidence documents;
- source-specific operational instructions that do not conflict with this blueprint.

If another document conflicts, this blueprint wins unless a newer explicitly approved canonical document supersedes it.
