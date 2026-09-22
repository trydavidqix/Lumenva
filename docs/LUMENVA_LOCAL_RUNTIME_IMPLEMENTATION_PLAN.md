# Lumenva Local Agent Runtime — Inline Implementation Plan

> Execution branch: `lumenva-local-runtime`
> Parent architecture: `docs/LUMENVA_COMMAND_CENTER_PLAN.md`
> Runtime architecture: `docs/LUMENVA_LOCAL_RUNTIME_PLAN.md`
> Execution mode: INLINE ONLY — no subagents
> Merge policy: NEVER merge to `main`
> Human authorization for this implementation session: broad autonomy to edit, refactor, add/remove project files, run available gates, and commit/push only to `lumenva-local-runtime`. This authorization does not bypass provider/platform safety controls, unavailable credentials, or external approval requirements.

# 0. Mission

Implement the complete Local Agent Runtime described by the two parent plans directly on `lumenva-local-runtime`, sequentially, without delegating implementation to subagents and without stopping for routine implementation decisions.

The executor should continue phase-to-phase automatically while work is technically possible. Routine code/design/test decisions are delegated to the implementer. Stop only for a genuine external blocker that cannot be resolved from repository code, official documentation, available CI, or safe project-local changes.

# 1. Hard guardrails

These rules are immutable for this execution:

1. Never checkout, update, push, merge, rebase, reset, or otherwise mutate `main`.
2. Never create a PR whose purpose is to merge this work into `main` unless the owner later explicitly asks.
3. All implementation commits go to `lumenva-local-runtime`.
4. No subagents, agent delegation, council, swarm, background coding agent, or parallel implementer.
5. Reuse existing code before creating a competing subsystem.
6. Never claim a gate passed unless it actually ran and returned success.
7. Never fabricate credentials, secrets, live-provider evidence, CI results, browser evidence, or production state.
8. Never weaken security/tests simply to obtain green gates.
9. Never delete unrelated user work.
10. Never expose secrets in Git, logs, fixtures, evidence, prompts, or docs.
11. Destructive/external production actions remain subject to the Runtime's R3/R4 approval model; implementation autonomy is not permission to damage external systems.
12. Commit in coherent checkpoints so every major phase is recoverable.

# 2. Working protocol

For every implementation slice:

```
READ current source
-> MAP existing capability
-> REUSE or EXTEND
-> WRITE failing/contract test when practical
-> IMPLEMENT
-> RUN narrow gate
-> FIX until green or proven externally blocked
-> RUN broader regression gate
-> RECORD evidence/status
-> COMMIT to lumenva-command-center
-> CONTINUE automatically
```

Do not ask the owner to choose between equivalent internal implementation details. Choose the option most consistent with the parent architecture and repository conventions.

When a failure occurs:
1. inspect the complete error;
2. search repository history/current code;
3. consult official documentation when needed;
4. fix root cause;
5. rerun the smallest failing gate;
6. rerun affected regression gates;
7. continue.

# 3. Source-of-truth hierarchy

When documents conflict, use this order:

1. explicit owner instruction in the current task;
2. `docs/LUMENVA_COMMAND_CENTER_PLAN.md`;
3. `docs/LUMENVA_LOCAL_RUNTIME_PLAN.md`;
4. this implementation plan;
5. current executable contracts/tests;
6. historical scratch/audit documents.

Historical docs are evidence, not proof of current HEAD behavior.

# 4. Definition of done

The implementation is complete only when all technically executable V1 criteria are implemented and tested:

- Core/Runtime typed contract exists.
- Runtime daemon has lifecycle, heartbeat, health, capabilities and graceful shutdown.
- R0 local executor works without LLM.
- mutation executor is worktree-scoped.
- command runner enforces cwd/executable/env/time/output boundaries.
- validation profiles QUICK/STANDARD/FULL/CRITICAL exist.
- Context Engine bridge produces traceable minimal packs.
- Model Router supports deterministic bypass and provider selection contract.
- bounded agentic loop exists with repeated-failure detection.
- R0–R4 policy/approval behavior is enforced.
- checkpoints and recovery exist.
- events/evidence/history are persisted through canonical abstractions.
- Core exposes typed local API/service surface.
- Command Center has runtime/job/approval/evidence projection sufficient for V1.
- MCP/CLI surface routes through the same policy boundary.
- broken-test E2E fixture demonstrates the intended repair lifecycle without automatic merge.
- no implementation path automatically merges to `main`.
- available repository gates are green, or each non-runnable external gate is explicitly recorded as BLOCKED_EXTERNAL with reason.

Browser automation is LR12 and may be completed after core V1, but should be implemented in the same execution when repository/runtime dependencies permit.

# 5. Phase I0 — Baseline and architecture inventory

Tasks:
- capture current branch HEAD;
- inspect package/workspace layout;
- inspect `packages/operating-core`;
- locate Session Runtime, Resource Router, approval/evidence, MCG/context, MCP/CLI, event/history and Command Center code;
- identify duplicate or historical-only implementations;
- create an implementation matrix mapping each Local Runtime capability to its canonical existing module;
- identify current test commands from package manifests/CI rather than guessing.

Deliverable:
- `docs/runtime/IMPLEMENTATION_MATRIX.md`.

Gate:
- no code duplication decision remains unresolved for LR1–LR11.

# 6. Phase I1 — Canonical contracts

Implement typed contracts for:
- RuntimeIdentity
- RuntimeHealth
- RuntimeCapability
- RuntimeJob
- RuntimeStep
- RuntimeCheckpoint
- RuntimeCommand
- RuntimeCommandResult
- RuntimeValidationProfile
- RuntimeValidationResult
- RuntimeApprovalRequest
- RuntimeEvidence
- RuntimeEvent

Requirements:
- stable IDs;
- trace/session/task correlation;
- organization/tenant scope where canonical architecture requires it;
- measurement type for exact/estimated/unavailable metrics;
- no secret-bearing arbitrary env payloads in public contracts.

Tests:
- contract construction/validation;
- invalid states rejected;
- tenant/correlation preservation.

Commit checkpoint:
`feat(runtime): define canonical local runtime contracts`

# 7. Phase I2 — Runtime daemon

Implement:
- start/stop lifecycle;
- heartbeat;
- health snapshot;
- capability advertisement;
- graceful shutdown;
- process-independent state abstraction;
- Runtime version/protocol version;
- runtime.started/runtime.heartbeat/runtime.offline events.

Do not couple daemon lifecycle to Electron renderer.

Tests:
- start -> healthy;
- duplicate start idempotency;
- graceful stop;
- stale heartbeat detection;
- capability snapshot deterministic.

Commit checkpoint:
`feat(runtime): add local runtime daemon lifecycle`

# 8. Phase I3 — Safe command runner

Build the lowest-level execution boundary before high-level tools.

Requirements:
- spawn without shell where possible;
- executable allowlist;
- canonical cwd containment;
- symlink/path escape protection;
- environment allowlist;
- secret redaction;
- timeout;
- stdout/stderr byte caps;
- exit code/signal capture;
- cancellation;
- process-tree cleanup where platform permits;
- trace metadata;
- no raw unrestricted shell API exposed to renderer/MCP.

Windows-first support may use PowerShell/ConPTY internally when structurally necessary, but API remains typed.

Tests:
- allowed command succeeds;
- denied executable fails closed;
- cwd escape denied;
- timeout kills process;
- oversized output truncates safely;
- secret-like env does not appear in evidence.

Commit checkpoint:
`feat(runtime): add bounded local command runner`

# 9. Phase I4 — R0 Local Executor

Implement structured read-only tools:
- fs.read
- fs.search
- git.status
- git.diff
- git.log
- logs.read
- service.health
- port.check

Requirements:
- repository/workspace boundary;
- normalized result envelope;
- risk=R0;
- events/evidence for every call;
- deterministic execution invokes zero model calls.

Tests:
- each tool happy path;
- invalid path;
- repo escape;
- missing command/service;
- deterministic zero-model assertion.

Commit checkpoint:
`feat(runtime): implement read-only local executor`

# 10. Phase I5 — Worktree Manager

Implement/reconcile canonical worktree manager.

Lifecycle:
```
resolve repo
-> verify clean/base ref policy
-> allocate unique job branch
-> create worktree
-> register base SHA/path
-> execute mutations only there
-> retain diff/evidence
-> cleanup only when policy permits
```

Hard rule:
- no automatic merge.
- no worktree rooted at `main` may be mutated as part of a job.

Tests:
- unique worktree per job;
- dirty primary tree untouched;
- branch/path registered;
- cleanup safe/idempotent;
- main merge path absent/denied.

Commit checkpoint:
`feat(runtime): isolate engineering jobs with worktrees`

# 11. Phase I6 — R1 mutation executor

Implement:
- fs.write
- fs.patch
- git.branch/status/diff operations needed by jobs
- test.run
- lint.run
- typecheck.run
- build.run

All writes require:
- active job;
- owned worktree;
- allowed path;
- trace/evidence;
- output hash where useful.

Do not add generic arbitrary shell as a public tool.

Tests:
- write/patch inside worktree;
- mutation outside worktree denied;
- diff reflects changes;
- test command captures failure/success.

Commit checkpoint:
`feat(runtime): add worktree-scoped mutation tools`

# 12. Phase I7 — Validation Engine

Profiles:
- QUICK
- STANDARD
- FULL
- CRITICAL

Profile commands must be discovered/configured per workspace.

Completion logic derives from command evidence, not model prose.

Implement:
- validation plan;
- sequential command execution;
- required/optional checks;
- structured failures;
- final verification state;
- independent-verifier requirement marker for CRITICAL.

Tests:
- green fixture;
- failing fixture;
- missing command behavior;
- partial profile cannot claim PASS;
- CRITICAL cannot self-verify.

Commit checkpoint:
`feat(runtime): add evidence-based validation engine`

# 13. Phase I8 — Evidence, history and event integration

Reuse canonical stores.

Persist:
- job lifecycle;
- steps;
- commands;
- exit codes;
- attempts;
- tool calls;
- model calls;
- checkpoints;
- approvals;
- artifacts;
- evidence;
- git refs;
- validation results;
- failures.

Add event names only after checking for canonical equivalents.

Requirements:
- append-only semantics where specified;
- secret redaction before persistence;
- trace -> session -> task -> step correlation.

Tests:
- event ordering;
- evidence linkage;
- redaction;
- replayable job timeline.

Commit checkpoint:
`feat(runtime): persist runtime events and evidence`

# 14. Phase I9 — Context Engine / MCG bridge

Implement adapter from Runtime job state to canonical Context Engine.

Input candidates:
- task/acceptance criteria;
- constraints/decisions;
- repo metadata;
- git status/diff;
- failing command;
- relevant search hits;
- relevant source files;
- previous attempts;
- unresolved issues.

Output:
- compact context pack;
- provenance;
- selected item reasons;
- hashes;
- bytes/chars/tokens;
- cache metadata.

Rules:
- never preload whole repository/vault;
- top-k small by default;
- critical constraints/must_keep cannot be dropped by simple size pressure;
- secrets excluded.

Tests:
- relevant selection;
- dedupe;
- cache;
- provenance;
- size budget;
- must_keep preservation.

Commit checkpoint:
`feat(runtime): bridge jobs to context engine`

# 15. Phase I10 — Model Router bridge

Integrate canonical Resource Router/Capability Registry with model execution.

Routing classes:
- DETERMINISTIC
- TINY
- LIGHT
- NORMAL
- HEAVY
- CODE_SPECIALIST
- CRITICAL

Inputs:
- task type;
- risk;
- context size;
- capability;
- provider availability;
- quota/budget;
- reliability;
- latency.

Requirements:
- DETERMINISTIC => no LLM call;
- provider adapters behind interface;
- unavailable provider fails/reroutes according to policy;
- no hard-coded secrets;
- exact provider/model attribution in trace when known.

Tests:
- deterministic bypass;
- capability mismatch;
- unavailable provider;
- budget constraint;
- critical verifier separation.

Commit checkpoint:
`feat(runtime): route runtime model execution`

# 16. Phase I11 — Bounded agentic loop

Implement canonical loop:

```
PLAN
-> ACTION
-> EXECUTE
-> OBSERVE
-> VALIDATE
-> DONE
   or
-> DIAGNOSE -> PATCH -> repeat
```

Controls:
- max_iterations default 20;
- max_same_failure default 3;
- max_model_retries default 3;
- per-step timeout;
- job budget;
- cancellation;
- ToolLoopLock/CAS;
- failure fingerprint;
- circuit-breaker integration when applicable.

Never use model assertion as completion evidence.

Tests:
- successful one-pass task;
- recoverable failure;
- repeated identical failure -> BLOCKED;
- iteration limit -> BLOCKED;
- cancellation;
- stale lock/epoch;
- no infinite loop.

Commit checkpoint:
`feat(runtime): implement bounded engineering loop`

# 17. Phase I12 — Risk and approvals

Reconcile existing approval policy.

Policy:
- R0 automatic;
- R1 automatic inside owned worktree;
- R2 controlled execution + evidence/review;
- R3 owner approval;
- R4 owner approval + independent validation.

Approval must bind to:
- exact action;
- arguments/action hash;
- job/task;
- actor;
- expiry/nonce where canonical system supports it.

Tests:
- R0/R1 pass;
- R3/R4 fail closed without approval;
- approval for action A cannot authorize B;
- expired/stale approval denied;
- R4 cannot self-validate.

Commit checkpoint:
`feat(runtime): enforce runtime risk approvals`

# 18. Phase I13 — Checkpoint and crash recovery

Implement:
- checkpoint after meaningful state transition;
- lease/epoch ownership;
- recovery scan;
- safe resume;
- stale worker detection;
- idempotent step replay rules;
- non-idempotent step protection.

Flow:
```
startup
-> find recoverable jobs
-> validate lease/epoch
-> inspect last checkpoint/evidence
-> resume safe step or mark BLOCKED
```

Tests:
- simulated process death;
- restart/resume;
- stale lease;
- duplicate resume;
- non-idempotent ambiguous action blocks rather than repeats.

Commit checkpoint:
`feat(runtime): add checkpoint recovery`

# 19. Phase I14 — Core local API

Expose typed service/API through Core:
- create job;
- get job;
- cancel;
- approve;
- resume;
- runtime health;
- capabilities;
- event stream.

Security:
- renderer does not access OS directly;
- validate every payload;
- policy checked server/core side.

Tests:
- contract/API tests;
- malformed payload;
- unauthorized/risk action;
- event stream lifecycle.

Commit checkpoint:
`feat(runtime): expose local runtime core API`

# 20. Phase I15 — Command Center UI

Implement V1 projections:
- Runtime Health;
- Jobs;
- Job detail;
- live steps/events;
- current agent/executor/model;
- validation state;
- worktree/diff summary;
- evidence;
- approvals;
- cancel/resume controls.

UI rules:
- projection only;
- no invented activity;
- unavailable data explicitly unavailable;
- renderer cannot issue arbitrary commands;
- keyboard accessibility and reduced motion inherited from Command Center requirements.

Tests:
- component/state tests;
- API mock contract;
- approval/cancel/resume flows;
- no fake DONE when backend says running/unknown.

Commit checkpoint:
`feat(command-center): add local runtime operations UI`

# 21. Phase I16 — CLI and MCP surfaces

Reuse existing Operating Core CLI/MCP.

Expose safe operations:
- submit job;
- inspect;
- cancel;
- approve where caller is authorized;
- runtime health;
- evidence lookup.

Invariant:
CLI, API and MCP must resolve through the same policy engine and produce semantically equivalent decisions.

Tests:
- same action through surfaces -> same risk/policy result;
- no raw shell escape;
- malformed MCP payload denied.

Commit checkpoint:
`feat(runtime): expose policy-safe cli and mcp surfaces`

# 22. Phase I17 — V1 broken-test E2E

Create deterministic fixture repository/project.

Scenario:
`Fix all broken tests in this project.`

Required evidence:
1. job created;
2. isolated worktree;
3. baseline test fails;
4. failure captured;
5. relevant context selected;
6. repair path executed;
7. test rerun;
8. validation profile executed;
9. diff produced;
10. evidence bundle produced;
11. final state DONE;
12. main untouched;
13. no automatic merge.

Where live model credentials are unavailable, keep provider-dependent E2E separately BLOCKED_EXTERNAL and still prove the deterministic/runtime pipeline with a deterministic test adapter. Never call the mocked result a live-provider proof.

Commit checkpoint:
`test(runtime): prove broken-test repair lifecycle`

# 23. Phase I18 — Recovery/security adversarial suite

Add tests for:
- path traversal;
- symlink escape;
- command injection attempts;
- env/secret leakage;
- output flooding;
- timeout;
- process cancellation;
- duplicate claims;
- stale epoch;
- approval replay;
- tenant mismatch;
- worktree collision;
- malicious patch path;
- restart during validation.

Fix every reproducible issue before moving on.

Commit checkpoint:
`test(runtime): harden local executor boundaries`

# 24. Phase I19 — Browser runtime

Only after core V1 is stable.

Implement Playwright adapter with:
- isolated profile/context;
- localhost allow policy;
- navigation risk classification;
- DOM/screenshot artifacts;
- timeout/cancellation;
- trace/evidence;
- no persistent personal login assumption.

Tests:
- localhost smoke;
- screenshot/DOM evidence;
- denied unsafe target according to policy.

Commit checkpoint:
`feat(runtime): add browser validation adapter`

# 25. Phase I20 — Full regression and cleanup

Run all available affected gates discovered in I0, including repository-defined:
- typecheck;
- lint;
- unit;
- integration;
- runtime tests;
- command-center tests;
- build;
- security/invariant checks.

Then:
- remove dead duplicate code created during iteration;
- remove debug logging;
- verify no secrets;
- verify no conflict markers;
- verify no unintended main mutation;
- inspect full branch diff;
- update implementation matrix with final paths/status;
- update `docs/LUMENVA_LOCAL_RUNTIME_PLAN.md` phase statuses based on actual evidence.

Commit checkpoint:
`chore(runtime): finalize local runtime implementation`

# 26. Continuous gates

After every phase:
- affected tests;
- affected typecheck;
- diff inspection.

At milestones I6, I11, I15, I18, I20:
- broader regression suite.

Never defer a known failing narrow gate to the end unless it is proven unrelated or external.

# 27. Autonomous decision rules

The implementer is authorized to decide without asking:
- file/module placement;
- naming consistent with repo conventions;
- internal refactors;
- test fixture design;
- adapter/interface boundaries;
- dependency choice when already present in workspace;
- replacement of duplicate new code with canonical existing code;
- fixing unrelated compile/test errors directly caused or exposed by this implementation when safe.

Ask/stop only when:
- a required secret/credential unavailable to tools is essential for the next proof;
- an external paid/destructive action is required;
- owner must legally/financially authorize an external action;
- GitHub/provider permissions prevent required branch write;
- requirements are mutually contradictory in a way that changes product intent.

If one external integration is blocked, mark only that proof BLOCKED_EXTERNAL and continue all independent phases.

# 28. No-report execution behavior

During implementation:
- do not stop after each phase for status;
- do not ask for routine confirmation;
- continue inline through the plan;
- keep evidence in repo/commits;
- report to the owner only when the implementation has reached the maximum executable completion or a true blocking condition prevents all further progress.

# 29. Final completion report format

At the end provide only:
- final branch;
- final HEAD;
- phases completed;
- gates passed;
- any BLOCKED_EXTERNAL items;
- explicit confirmation that `main` was not merged/mutated;
- location of implementation/evidence docs.

No claim of 100% unless every required executable gate supports it.
