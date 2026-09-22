# Personal AI Engineering OS — Mega Implementation Blueprint

**Status:** CANONICAL IMPLEMENTATION PLAN  
**Branch:** `vps`  
**Scope:** Global, project-independent engineering harness for Claude Code, OpenAI Codex, and Gemini CLI.  
**Main policy:** This plan does not authorize merging to `main`.

## 1. Mission

Build one versioned Personal AI Engineering OS with a shared provider-neutral core and native adapters for Claude Code, Codex, and Gemini CLI.

Core principle:

> Share engineering truth and contracts; preserve each provider's native strengths.

The system must remain useful across unrelated repositories and must never embed Lumenva-specific architecture, framework, database, deployment, or business rules into the global layer.

## 2. Target architecture

```text
                    PERSONAL AI ENGINEERING OS
                              |
                       SOURCE OF TRUTH
                              |
        +---------------------+----------------------+
        |                     |                      |
  Constitution            Contracts             Shared Skills
        |                     |                      |
        +----------+----------+----------+-----------+
                   |                     |
              Agent Factory         Shared Policies
                   |                     |
                   +----------+----------+
                              |
                        Config Compiler
                              |
              +---------------+---------------+
              |               |               |
        Claude Adapter    Codex Adapter   Gemini Adapter
              |               |               |
         ~/.claude/       ~/.codex/       ~/.gemini/
              |               |               |
              +---------------+---------------+
                              |
                         Shared Runtime
                              |
           State + Checkpoints + Evidence + Memory
                              |
                       Recovery Engine
                              |
                     Compound Learning
```

## 3. Non-negotiable invariants

1. Global configuration is project-independent.
2. One canonical source generates provider-specific configuration where practical.
3. Provider-native features are reused before custom replacements are created.
4. Shared concepts do not require identical provider implementations.
5. No secret values are stored in Git, prompts, state, logs, evidence, or generated config.
6. Existing user configuration is never overwritten blindly.
7. Install/sync operations are idempotent, diffable, reversible, and backup-first.
8. Conversation history is cache, not durable truth.
9. Completion requires evidence, not agent confidence.
10. Permanent memory requires provenance and scope.
11. Skills use progressive disclosure.
12. Tools/MCP capabilities are scoped to need.
13. Destructive/external/production actions remain policy gated.
14. Provider preview/experimental features cannot become critical single points of failure.
15. Manual edits are detected as drift rather than silently overwritten.
16. Global agents are produced from canonical AgentDefinitions or mapped explicitly to provider-native equivalents.
17. No implementation step in this blueprint authorizes a merge to `main`.

## 4. Repository target

```text
AIEngineeringOS/
├── README.md
├── VERSION
├── constitution/
│   ├── core.md
│   ├── engineering.md
│   ├── security.md
│   ├── git.md
│   ├── verification.md
│   └── context.md
├── contracts/
│   ├── TaskContract.schema.json
│   ├── AcceptanceManifest.schema.json
│   ├── ResultDigest.schema.json
│   ├── FailureDigest.schema.json
│   ├── Checkpoint.schema.json
│   ├── Evidence.schema.json
│   └── MemoryCandidate.schema.json
├── skills/
│   ├── planning/
│   ├── implementation/
│   ├── debugging/
│   ├── testing/
│   ├── code-review/
│   ├── security-review/
│   ├── architecture-review/
│   ├── research/
│   ├── context-recovery/
│   ├── evidence-validation/
│   ├── git-workflow/
│   └── ci-diagnosis/
├── agents/
│   ├── definitions/
│   └── templates/
├── policies/
├── hooks/
├── runtime/
│   ├── state/
│   ├── checkpoints/
│   ├── recovery/
│   ├── evidence/
│   └── memory/
├── adapters/
│   ├── claude/
│   ├── codex/
│   └── gemini/
├── compiler/
├── installers/
│   ├── windows/
│   ├── macos/
│   └── linux/
├── migrations/
└── tests/
```

## 5. Global versus project scope

Global answers **how engineering work is performed**:
- understand before modifying;
- inspect/reuse before creating;
- plan non-trivial work;
- progressive context disclosure;
- preserve unrelated work;
- protect secrets;
- verify before claiming success;
- checkpoint before context loss;
- evidence-driven completion.

Project scope answers **how this repository works**:
- architecture;
- stack;
- build/test commands;
- database;
- deployment;
- repository-specific agents/skills;
- project MCP/tools;
- project conventions.

Project-specific knowledge MUST NOT leak into global memory or constitution unless explicitly generalized and validated.

## 6. Canonical prompt/instruction stack

```text
L0 Provider runtime/system behavior
L1 Global Constitution
L2 Provider adapter rules
L3 Project instructions
L4 Directory instructions
L5 Agent role
L6 Skill
L7 TaskContract + ContextPacket
L8 Dynamic runtime state
```

Keep higher layers stable and small. Put procedural detail in Skills and task-specific information in TaskContract/ContextPacket.

## 7. Shared Constitution

Canonical source is provider-neutral. Compilers emit the correct native representation:

```text
constitution/*
       |
       +--> Claude global instructions
       +--> Codex global AGENTS instructions
       +--> Gemini global GEMINI instructions
```

Minimum rules:
- understand before editing;
- inspect current state and instructions;
- reuse > modify > create > install;
- plan non-trivial work;
- do not destroy unrelated work;
- do not weaken tests to obtain green;
- do not expose secrets;
- use progressive disclosure;
- checkpoint durable state;
- verify claims;
- evidence determines completion.

## 8. Shared Skills

Canonical shared Skills live in this repository and are installed/mapped to provider-supported locations.

Initial catalog:
- planning;
- implementation;
- debugging;
- testing;
- code-review;
- security-review;
- architecture-review;
- research;
- context-recovery;
- evidence-validation;
- git-workflow;
- ci-diagnosis.

Skill layout:

```text
skill/
├── SKILL.md
├── references/
├── scripts/
├── templates/
└── tests/
```

Rules:
- metadata must explain when to activate;
- SKILL.md remains concise;
- references load only when needed;
- scripts are deterministic where possible;
- provider-specific instructions stay in adapter overlays;
- duplicate Skills are rejected.

## 9. Agent Factory

### AgentDefinition

Every custom logical agent declares:

```text
id
name
role
purpose
capabilities
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
output_schema
lifecycle
definition_version
```

### Factory pipeline

```text
Need role
   |
Native provider capability sufficient?
   | yes
   +--> map + validate + register
   |
   no
   v
AgentDefinition
   |
Schema Validator
   |
Policy Validator
   |
Capability Resolver
   |
Provider Compiler
   |
Health/Capability Probe
   |
Agent Registry
   |
READY
```

Initial logical catalog:
- explorer;
- planner;
- builder;
- reviewer;
- verifier;
- debugger;
- security-reviewer;
- architecture-reviewer;
- researcher;
- incident-diagnostician.

Do not create dozens of agents before evidence demonstrates a need.

## 10. Agent isolation

Explorer:
- read-only;
- repository discovery;
- returns compact map/digest.

Planner:
- read-only;
- creates dependency-aware plan and acceptance criteria.

Builder:
- scoped write;
- implements bounded work;
- returns changes/tests/evidence.

Reviewer:
- fresh context;
- read-only;
- builder history denied by default;
- receives requirements + diff + evidence.

Verifier:
- deterministic-first;
- cannot modify artifact under verification;
- PASS/FAIL/BLOCKED with evidence.

## 11. Claude Code adapter

Target responsibilities:
- global CLAUDE instructions;
- user settings;
- native agents/subagents where stable;
- Skills mapping;
- hooks;
- plugin packaging where beneficial;
- MCP capability mapping;
- checkpoint/recovery integration.

Do not copy the entire shared repository into always-loaded Claude context.

Claude-specific generated tree may include:

```text
~/.claude/
├── CLAUDE.md
├── settings.json
├── agents/
└── managed global-engineering components
```

Use native isolation for bounded specialist agents. Provider syntax stays in this adapter.

## 12. Codex adapter

Target responsibilities:
- global AGENTS instructions;
- config.toml overlays;
- native/custom agent definitions;
- shared Skills mapping;
- profiles only where supported and useful;
- MCP capability mapping;
- sandbox/approval translation;
- checkpoint/recovery integration.

Generated logical tree:

```text
~/.codex/
├── AGENTS.md
├── config.toml
├── agents/
└── managed adapter state
```

Prefer native Codex roles when they satisfy the logical AgentDefinition instead of duplicating them.

## 13. Gemini CLI adapter

Target responsibilities:
- global GEMINI instructions;
- settings;
- Extension packaging when appropriate;
- Skills mapping;
- hooks;
- policies;
- MCP;
- memory integration;
- provider-native loop/context features where stable.

Generated logical tree:

```text
~/.gemini/
├── GEMINI.md
├── settings.json
└── managed global-engineering extension/components
```

Preview/experimental subagent or memory capabilities operate in shadow mode until capability probes and regression tests prove safe fallback behavior.

## 14. Config Compiler

The source repository is canonical.

```text
Canonical Core
     |
validate
     |
Config Compiler
  +--+-------------+
  |                |
Claude           Codex           Gemini
  |                |               |
native files     native files    native files
```

Compiler requirements:
- deterministic output;
- schema validation;
- provider capability detection;
- explicit unsupported-feature report;
- stable formatting;
- content hashes;
- dry-run;
- diff before apply;
- no secret interpolation into persisted files.

## 15. Capability Registry

Do not globally load every MCP/tool.

Registry describes:
- capability id;
- provider implementation;
- availability;
- trust/risk;
- read/write/external-effect class;
- required auth reference;
- health;
- version.

Runtime flow:

```text
TaskContract
   |
required capabilities
   |
Capability Resolver
   |
Policy Engine
   |
provider-native tool/MCP grant
```

## 16. Permission abstraction

Canonical risk classes:

```text
READ             -> low risk
WORKSPACE_WRITE  -> normal engineering
NETWORK          -> scoped
EXTERNAL_WRITE   -> elevated
DESTRUCTIVE      -> explicit gate
SECRET_ACCESS    -> explicit scoped grant
PRODUCTION       -> human gate
```

Adapters translate these into native provider controls. Prompt text alone must not be the only enforcement for critical actions.

## 17. Hook framework

Hooks exist for deterministic enforcement/observation, not general business logic.

Canonical events:
- session_start;
- before_tool;
- after_tool;
- before_checkpoint;
- after_checkpoint;
- before_compaction when provider supports it;
- after_recovery;
- agent_stop;
- before_complete;
- session_end.

A provider adapter maps only events it actually supports.

New hooks should normally be justified by:
- a recurring failure;
- a security invariant;
- evidence capture;
- recovery requirement;
- deterministic validation.

## 18. TaskContract

Provider-neutral fields:

```text
id
objective
scope
requirements
constraints
source_of_truth
target_files
dependencies
conflicts
allowed_tools
forbidden_actions
network_policy
secret_policy
risk_level
verification
acceptance_criteria
context_budget
tool_budget
execution_budget
requested_by
created_at
```

Workers do not silently mutate the contract.

## 19. AcceptanceManifest

Each requirement has:
- acceptance id;
- requirement reference;
- PASS/FAIL/PENDING/BLOCKED;
- verification method;
- evidence ids;
- verifier;
- timestamp;
- failure reason.

Mandatory acceptance items must PASS before COMPLETE.

## 20. Evidence Engine

Claims map to evidence:

```text
tests passed -> command + exit status + digest
build works  -> build evidence
fixed        -> reproduction + verification
complete     -> AcceptanceManifest
reviewed     -> reviewer result + evidence refs
```

Evidence includes provenance and correlation to task, agent definition version, provider, branch/commit where applicable, and timestamp.

## 21. State Ledger

Durable state includes:

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
branch
commit
diff_hash
acceptance_state
evidence
provider/session refs
exact_next_action
checkpoint_version
```

Conversation summaries cannot replace the ledger.

## 22. Checkpoint protocol

Checkpoint before known context loss and periodically on long tasks:

1. validate current TaskContract;
2. snapshot State Ledger;
3. snapshot AcceptanceManifest;
4. capture Git state;
5. reference evidence;
6. persist decisions and blockers;
7. persist exact next action;
8. hash checkpoint;
9. confirm recoverability.

## 23. Context Recovery Engine

Recovery order:

```text
TaskContract
 -> State Ledger
 -> AcceptanceManifest
 -> Git status/log/diff
 -> Evidence
 -> blockers
 -> provider/session state
 -> relevant memory
 -> fresh ContextPacket
 -> continue
```

A fresh provider session must be able to continue without the user restating the project.

## 24. Context Budget Manager

Track:
- token budget;
- file budget;
- byte budget;
- retrieval depth;
- expansion count;
- tool budget.

Pattern:

```text
MAP -> SELECT -> READ -> VERIFY NEED -> EXPAND
```

Avoid read-everything workflows.

## 25. Memory model

Scopes:
- GLOBAL: stable personal engineering preferences only;
- PROJECT: repository knowledge;
- PROVIDER: validated provider behavior/capability observations;
- TASK: temporary execution knowledge.

Memory record:
- id;
- scope;
- type;
- content/reference;
- source;
- evidence;
- confidence;
- created_at;
- expires_at;
- supersedes.

No automatic promotion from task observation to permanent global memory.

## 26. MemoryCandidate and Compound Learning

```text
TaskResult
   |
Learning Extractor
   |
Candidate
   |
dedupe + evidence + classification
   |
+------+-------+------+--------+------+
Skill  Hook    Rule   Memory   Docs
```

Candidates require validation before promotion. Provider-native auto-memory systems can feed candidates but do not bypass this gate.

## 27. Loop Engine

```text
UNDERSTAND
 -> PLAN
 -> ACT
 -> OBSERVE
 -> VERIFY
 -> PASS -> COMPLETE
 -> FAIL -> CLASSIFY -> RETRY / REPLAN / ESCALATE
```

## 28. Loop Detector

Detect:
- same error repeatedly;
- same failing test;
- near-identical diff;
- repeated tool calls;
- retries without acceptance progress;
- exhausted time/tool budget.

If provider has useful native loop detection, ingest its signal rather than creating a conflicting duplicate.

## 29. Failure taxonomy

At minimum:
- TRANSIENT;
- BAD_PROMPT;
- BAD_PLAN;
- CODE_ERROR;
- TEST_FAILURE;
- CI_FAILURE;
- DEPENDENCY;
- ENVIRONMENT;
- AUTH;
- QUOTA;
- CONFLICT;
- ARCHITECTURE;
- POLICY;
- LOOP;
- UNKNOWN.

FailureDigest stores classification, evidence, attempted strategies, and next strategy.

## 30. Fresh Context Review

Reviewer receives:
- TaskContract;
- AcceptanceManifest;
- relevant architecture constraints;
- diff/artifacts;
- evidence.

Reviewer does not receive builder conversational history by default.

## 31. Drift Detector

Managed files store expected hashes.

```text
expected hash != actual hash
        |
    CONFIG DRIFT
        |
 show diff
        |
 adopt / restore / ignore
```

Never silently overwrite manual user changes.

## 32. Backup and rollback

Before first mutation:
- inventory existing files;
- classify managed/unmanaged;
- backup exact originals;
- create manifest;
- verify backup readability.

Rollback can restore:
- single provider;
- single file/component;
- entire managed version.

## 33. Installer

Provide PowerShell and POSIX installers.

Requirements:
- idempotent;
- backup-first;
- dry-run by default for destructive changes;
- detect installed providers;
- detect versions/capabilities;
- compile only compatible output;
- show diff;
- apply;
- health-check;
- rollback on failed critical validation.

## 34. Doctor

Conceptual command:

```text
ai-engineering doctor
```

Checks:
- provider installed/version;
- canonical source validity;
- generated file validity;
- drift;
- Skills;
- agent registry;
- hooks;
- capability health;
- state directory;
- checkpoint/recovery;
- secret leakage;
- unsupported/preview dependencies.

## 35. Sync

```text
ai-engineering sync
```

Pipeline:
1. validate canonical source;
2. probe providers;
3. compile adapters;
4. validate generated output;
5. compute diff;
6. backup changed unmanaged/managed originals;
7. apply;
8. health-check;
9. write installation manifest.

## 36. Upgrade/migrations

Version the OS independently from provider versions.

Each release may include:
- schema migrations;
- config migrations;
- agent definition migrations;
- Skill migrations;
- provider compatibility updates.

Migrations must be reversible when practical and must never destroy unknown user configuration.

## 37. Observability

Record:
- install/sync/rollback events;
- provider capability probes;
- agent factory compilation;
- drift;
- checkpoint/recovery;
- verification;
- learning candidate promotion.

Do not record secret values or unnecessary prompt content.

## 38. Security

Validate:
- no secrets committed;
- no secrets in generated configs unless provider requires secure references;
- no broad tool grants by default;
- hooks/scripts cannot silently broaden permissions;
- symlink/path traversal handling;
- safe backup permissions;
- generated shell commands properly escaped;
- downloaded dependencies pinned/verified where practical;
- provider experimental features isolated behind flags.

## 39. Testing architecture

```text
tests/
├── schemas/
├── constitution/
├── skills/
├── agent-factory/
├── compiler/
├── claude-adapter/
├── codex-adapter/
├── gemini-adapter/
├── hooks/
├── permissions/
├── checkpoint/
├── recovery/
├── evidence/
├── memory/
├── drift/
├── installer/
├── rollback/
└── e2e/
```

## 40. Implementation program

### Phase 0 — Inventory
Inspect existing Claude/Codex/Gemini installations and global configuration. Produce a machine inventory without mutation.

### Phase 1 — Backup
Backup current global configurations and create restore manifest.

### Phase 2 — Canonical repository skeleton
Create source tree, VERSION, schemas, adapters, compiler, tests, installers and migrations.

### Phase 3 — Canonical contracts
Implement and validate TaskContract, AcceptanceManifest, ResultDigest, FailureDigest, Checkpoint, Evidence and MemoryCandidate schemas.

### Phase 4 — Constitution
Implement small provider-neutral global constitution and tests preventing project-specific contamination.

### Phase 5 — Shared Skills
Implement initial Skill catalog, validator, progressive-disclosure structure and duplicate detection.

### Phase 6 — AgentDefinition
Implement schema, templates, provider-neutral role/capability semantics and version/hash model.

### Phase 7 — Agent Factory
Implement validators, native-role resolver, Provider Compiler interface, registry and health probe contract.

### Phase 8 — Core agent catalog
Explorer, Planner, Builder, Reviewer, Verifier, Debugger, Security Reviewer, Architecture Reviewer, Researcher and Incident Diagnostician.

### Phase 9 — Claude adapter
Compile/install global instructions, managed Skills/agents/hooks/plugin components using only currently supported native features.

### Phase 10 — Codex adapter
Compile/install global AGENTS/config/agents/Skills/provider controls using currently supported native features.

### Phase 11 — Gemini adapter
Compile/install GEMINI/settings/extension/Skills/hooks/policies; experimental features remain optional/shadow.

### Phase 12 — Capability Registry
Provider capability probing, MCP/tool mapping, health and risk classification.

### Phase 13 — Config Compiler
Deterministic compile, hashes, stable formatting, capability fallback and unsupported-feature report.

### Phase 14 — Permission abstraction
Canonical risk classes translated to each provider without silently broadening permissions.

### Phase 15 — Hook framework
Canonical hook events, provider mappings, evidence hooks and regression tests.

### Phase 16 — State Ledger
Durable state, atomic writes, versioning and corruption handling.

### Phase 17 — Checkpoint Engine
Create/retrieve/validate checkpoints and exact-next-action recovery data.

### Phase 18 — Context Recovery
Fresh-session recovery from contracts + state + Git + evidence.

### Phase 19 — Context Budget Manager
Progressive disclosure budgets and expansion controls.

### Phase 20 — Evidence Engine
Evidence capture, provenance, hashes and AcceptanceManifest integration.

### Phase 21 — Verification and Fresh Review
Deterministic verification and independent fresh-context review.

### Phase 22 — Memory
Scoped memory records, provenance, expiry and supersession.

### Phase 23 — Compound Learning
MemoryCandidate/LearningCandidate extraction, dedupe, validation and promotion.

### Phase 24 — Loop/Failure system
Loop detector integration, failure classification, retry/replan/escalation policies.

### Phase 25 — Drift Detector
Managed-file manifest, hash comparison, adopt/restore/ignore workflows.

### Phase 26 — Installer
Windows PowerShell and POSIX installers with backup, dry-run, apply and verification.

### Phase 27 — Doctor
Provider/config/Skill/agent/hook/state/security diagnostics.

### Phase 28 — Sync
Canonical source -> compile -> diff -> backup -> apply -> health-check.

### Phase 29 — Rollback
Provider/component/full rollback with integrity verification.

### Phase 30 — Migrations
Version-aware migration framework and compatibility matrix.

### Phase 31 — Observability
Structured local operational events without secret/prompt leakage.

### Phase 32 — Cross-platform validation
Windows, macOS and Linux path/symlink/shell behavior.

### Phase 33 — E2E long-context recovery
Run the same generic engineering task through each provider, checkpoint, terminate session, recover in a fresh session and finish without user re-explanation.

### Phase 34 — Cross-provider contract validation
Prove all three providers consume equivalent TaskContract/AcceptanceManifest semantics while retaining native runtime behavior.

### Phase 35 — Chaos tests
Corrupt checkpoint, missing provider, incompatible version, unavailable MCP, quota/auth failure, interrupted install, manual drift, failed hook and partial rollback.

### Phase 36 — Security validation
Secrets, permissions, external effects, path safety, scripts, backups and experimental feature isolation.

### Phase 37 — Performance/context validation
Measure always-loaded context, Skill activation cost, startup overhead and state/recovery overhead. Remove unnecessary global context.

### Phase 38 — Documentation
Installation, architecture, provider adapters, adding Skills, adding agents, recovery, troubleshooting and rollback.

### Phase 39 — Release gate
All mandatory tests green, clean install/upgrade/rollback proven, no secret leakage, provider fallbacks proven and canonical version tagged.

## 41. E2E acceptance scenario

For each provider:

1. Start in an unrelated test repository.
2. Confirm only global engineering rules plus repository-local rules load.
3. Create a non-trivial TaskContract.
4. Explore repository with bounded context.
5. Produce plan and AcceptanceManifest.
6. Execute implementation.
7. Capture evidence.
8. Force checkpoint.
9. Terminate provider session/process.
10. Start fresh session.
11. Recover objective, decisions, Git state, acceptance state, evidence and exact next action.
12. Continue without user restating the task.
13. Inject a repeatable failure.
14. Detect/classify it and change strategy.
15. Complete deterministic verification.
16. Run fresh-context review.
17. Mark mandatory acceptance items PASS.
18. Emit ResultDigest.
19. Generate only evidence-backed learning candidates.
20. Confirm project-specific knowledge did not contaminate global state.

Then repeat a cross-provider handoff:
- start with Claude;
- checkpoint;
- recover with Codex;
- checkpoint;
- recover with Gemini;
- verify shared contracts remain semantically intact.

## 42. Definition of Done

The Personal AI Engineering OS is complete when:
- canonical source is versioned;
- global/project boundaries are tested;
- shared Skills validate;
- Agent Factory works;
- all three adapters compile valid configurations;
- unsupported provider capabilities degrade safely;
- backup/install/sync/rollback are proven;
- drift detection works;
- context recovery works after real session loss;
- evidence gates completion;
- memory has provenance/scope;
- compound learning cannot silently promote unverified knowledge;
- secrets are absent from source/state/logs;
- fresh install and upgrade paths pass on supported OSes;
- E2E cross-provider handoff passes;
- no project-specific assumptions exist in the global core.

## 43. Implementation rule

Implementation follows this blueprint phase by phase. Before creating a provider-specific mechanism, inspect the installed/current provider capability and official documentation. Reuse native capability when it satisfies the contract. Keep experimental features optional until validated. Preserve existing user configuration and never treat generated configuration as permission to destroy unmanaged files.
