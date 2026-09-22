# Maestri V3 Agent Runtime — Permanent Architecture

## Purpose

This branch contains the permanent orchestration architecture for Lumenva Maestri.

Core roles:

- Claude Code = CEO / strategic brain
- Codex = CTO Engineering / deep implementation
- Jules = CTO Cloud / async and fleet execution
- GitHub = source of truth + event bus + CI/CD
- Maestri = operating system / router / policy engine / state machine

## 1. High-level architecture

```text
                         USER
                          │
                          ▼
                 ┌─────────────────┐
                 │     MAESTRI     │
                 │ Control Plane   │
                 └────────┬────────┘
                          │
                  ┌───────▼────────┐
                  │  CLAUDE CODE   │
                  │      CEO       │
                  └───────┬────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌───────────────┐       ┌───────────────┐
      │ CODEX CLOUD   │       │     JULES     │
      │ CTO / Eng.    │       │ CTO / Fleet   │
      └───────┬───────┘       └───────┬───────┘
              │                       │
              └───────────┬───────────┘
                          ▼
                 ┌─────────────────┐
                 │     GITHUB      │
                 │ Source of Truth │
                 └─────────────────┘
```

## 2. Permanent responsibility split

### Claude Code — CEO

Claude owns:

- project intent
- architecture decisions
- decomposition into tasks
- delegation strategy
- result review
- escalation decisions
- release readiness interpretation

Claude ecosystem surface:

- CLAUDE.md
- Skills
- Hooks
- Subagents
- MCP
- Plugins
- Maestri API/MCP

Claude should not become the universal executor. It governs.

### Codex — CTO Engineering

Codex owns:

- complex feature implementation
- deep debugging
- large refactors
- migrations
- test repair
- complex CI repair
- code review requiring repository-wide context
- technical implementation where depth matters more than concurrency

Preferred integration order:

1. Codex SDK
2. Codex Cloud / headless execution
3. Codex CLI for local/manual fallback
4. codex-action for GitHub event driven jobs

### Jules — CTO Cloud / Fleet

Jules owns:

- independent tasks
- asynchronous work
- issue batches
- test generation/fixing
- docs work
- dependency work
- maintenance
- long-running isolated tasks
- parallel fleets of repository jobs

Preferred integration order:

1. Jules SDK
2. Jules REST API behind adapter
3. Jules CLI for manual/debug
4. Jules GitHub Action for GitHub-native dispatch

### GitHub — Control Plane / Source of Truth

GitHub owns:

- repositories
- branches
- commits
- issues
- pull requests
- checks
- Actions
- releases
- code security
- artifacts

Use GitHub MCP Server for structured agent access.

GitHub remains the source of truth for code state.

Postgres remains the source of truth for operational agent state.

## 3. Maestri router

Routing must be deterministic first, LLM-driven second.

```text
TASK
 │
 ├─ GitHub operation?
 │      └─ GitHub MCP/API
 │
 ├─ deep implementation/debug/refactor?
 │      └─ Codex
 │
 ├─ isolated async task?
 │      └─ Jules
 │
 ├─ N independent tasks?
 │      └─ Jules Fleet
 │
 ├─ architecture/product interpretation?
 │      └─ Claude CEO
 │
 └─ ambiguous?
        └─ Claude CEO decides
```

## 4. Universal Task Contract

All providers receive the same conceptual contract.

```text
TaskContract

id
objective
repo
branch
scope
constraints
acceptance_criteria
allowed_tools
forbidden_actions
skill
risk_level
timeout
parent_job
requested_by
```

Expected normalized result:

```text
TaskResult

status
summary
changes
tests
artifacts
commit
pr
errors
follow_up
usage
```

Provider-specific differences stay inside adapters.

## 5. Normalized job states

```text
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

## 6. Global hooks

```text
before_task
before_route
before_dispatch

on_started
on_plan
on_progress
on_tool_call
on_waiting
on_rate_limit

before_commit
after_commit

before_pr
after_pr

before_merge
after_merge

on_ci_failure
on_security_failure
on_timeout
on_agent_failure

on_complete
```

Hooks are provider-neutral. Adapters translate native events into Maestri events.

## 7. Policy engine

```text
              Task
                │
                ▼
          Policy Engine
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
     R0        R1/R2      R3/R4
 automatic   guarded    approval
```

Suggested baseline:

```text
read code              R0
run tests              R0
edit working branch    R1
create PR              R1
workflow change        R2
infra change           R3
production change      R4
merge main             R4
secret/IAM change      R4
```

No provider bypasses policy.

## 8. Provider boundaries

### Codex

Allowed by default:

- code
- tests
- build
- working branch
- PR creation

Denied by default:

- merge main
- secrets
- IAM
- destructive production actions

### Jules

Allowed by default:

- assigned repository
- assigned branch
- assigned task
- tests
- PR creation

Denied by default:

- unrelated repositories
- secret values
- direct production changes
- main merge

### GitHub

Allowed:

- issues
- branches
- PRs
- checks
- workflows
- metadata

Merge:

- only through policy gate

### Claude

Claude may decide routing and interpretation, but execution still goes through Maestri policies.

## 9. Git lifecycle

```text
Claude CEO
    │
    ↓
Task Contract
    │
    ↓
Maestri Router
    │
 ┌──┴────────────┐
 ↓               ↓
Codex           Jules
 ↓               ↓
branch          branch
 ↓               ↓
tests           tests
 ↓               ↓
PR              PR
 └───────┬───────┘
         ↓
      GitHub
         ↓
 CI + Security + Checks
         ↓
 Claude Review
         ↓
 Policy Gate
         ↓
       Merge
```

## 10. Failure and escalation

Codex failure:

```text
retry
 ↓
different strategy
 ↓
Claude diagnosis
 ↓
Jules isolated attempt if appropriate
```

Jules failure:

```text
retry
 ↓
new Jules session
 ↓
Codex escalation
```

Do not blindly replay the exact same prompt across providers. Diagnose failure reason first.

## 11. Concurrency policy

Baseline:

```text
Codex:
  heavy jobs = conservative / limited

Jules:
  parallel jobs = configurable fleet

Claude:
  persistent CEO session

GitHub Actions:
  event-driven
```

Jules absorbs horizontally parallelizable backlog.
Codex stays available for high-context engineering.

## 12. Skills layer

Shared logical skills:

```text
.agents/skills/
    implement-feature/
    fix-bug/
    investigate-failure/
    write-tests/
    review-pr/
    security-review/
    dependency-update/
    docs-update/
    validate-release/
```

Rule:

- Skill defines HOW to work.
- Maestri decides WHO works.

Example:

```text
task = "fix login"
skill = fix-bug
worker = Codex

task = "fix 20 isolated tests"
skill = fix-bug
worker = Jules Fleet
```

## 13. Claude plugin boundary

Recommended project plugin:

```text
lumenva-maestri/
├── .claude-plugin/
├── skills/
│   ├── delegate-codex/
│   ├── delegate-jules/
│   ├── architecture-review/
│   └── release-gate/
├── agents/
│   ├── security-reviewer/
│   ├── architecture-reviewer/
│   └── qa-reviewer/
├── hooks/
└── .mcp.json
```

Claude should use Maestri for provider execution rather than calling providers ad hoc.

## 14. State and persistence

Operational state in Postgres:

```text
projects
tasks
decisions
agent_jobs
agent_events
artifacts
approvals
incidents
evidence
```

Core job fields:

```text
provider
external_job_id
repo
branch
task
skill
state
started_at
finished_at
pr_url
error
cost
usage
```

## 15. Secrets

Rules:

- secrets never enter prompts
- secrets never enter GitHub
- secrets never enter logs
- adapters receive secrets at runtime only
- service identities should be preferred over long-lived keys where possible
- JULES_API_KEY remains in Google Secret Manager
- provider credentials are scoped independently

## 16. Recommended repository structure

```text
Lumenva/
│
├── .claude/
│   ├── skills/
│   ├── agents/
│   ├── hooks/
│   └── settings.json
│
├── .agents/
│   └── skills/
│
├── .github/
│   ├── workflows/
│   └── agentic-workflows/
│
├── packages/
│   └── maestri/
│       ├── core/
│       ├── router/
│       ├── policies/
│       ├── hooks/
│       ├── skills/
│       ├── memory/
│       ├── queue/
│       └── adapters/
│           ├── claude/
│           ├── codex/
│           ├── jules/
│           └── github/
│
└── docs/
    └── MAESTRI_AGENT_ARCHITECTURE.md
```

## 17. Permanent identity of the system

- Claude Code = CEO / strategic brain
- Codex = CTO Engineering
- Jules = CTO Cloud / Fleet
- GitHub = Source of Truth + Event Bus + CI/CD
- Maestri = operating system governing all providers

This architecture should remain provider-agnostic at the Maestri core. New providers must implement the same TaskContract, TaskResult, job state model, hooks, policy gates, and adapter boundary.
