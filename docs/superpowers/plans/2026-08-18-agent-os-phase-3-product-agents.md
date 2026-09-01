# Agent OS Phase 3 Product Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seven versioned SHADOW product-agent roles on top of the existing Agent Kernel, starting with a typed Supervisor and preserving zero side effects.

**Architecture:** `lib/agent-engine/product-agents` owns product role IDs, definitions, typed output contracts, golden cases, and narrow adapters into the existing Kernel resolution/verification ports. It does not own execution. Model invocation, policies, tools, context, memory, evidence and durable run behavior remain behind existing kernel ports.

**Tech Stack:** TypeScript, Node test runner used by the repository, Next.js, existing Agent OS contracts/kernel, Vercel Preview gate.

**Spec:** `docs/superpowers/specs/2026-08-18-agent-os-phase-3-product-agents-design.md`

## Global Constraints

- Do not create a second Agent Engine beside `lib/agent-engine`.
- All seven product agents start and remain `shadow` in Phase 3.
- SHADOW produces zero side effects by deterministic policy.
- No production deployment, remote migration, billing, secret, WhatsApp/email send, or external real-world communication.
- Product definitions reuse `AgentDefinition`; provider-specific invocation stays behind the existing runtime adapter.
- Supabase/Postgres remains authoritative business state; memory is derived only.
- R4 remains non-autonomous.
- TDD: verify RED before minimal GREEN for every product slice.

---

### Task 1: Product-agent contracts and Supervisor RED

**Files:**
- Create: `lib/agent-engine/product-agents/contracts.ts`
- Create: `tests/unit/agent-product-supervisor.test.ts`

**Interfaces:**
- Consumes: `AgentDefinition` and `AgentAutonomyLevel` from `lib/agent-engine/contracts/agent-os.ts`.
- Produces: `PRODUCT_AGENT_IDS`, `ProductAgentId`, `SupervisorHandoffDecision`, `isProductAgentId`, `validateSupervisorHandoffDecision`.

- [x] **Step 1: Write the failing Supervisor contract tests**

Test imports from `@/lib/agent-engine/product-agents/contracts` and asserts: seven unique IDs; known IDs accepted; unknown target rejected; confidence outside `[0,1]` rejected; ambiguous/unsafe target representation cannot validate as a normal handoff.

- [x] **Step 2: Verify RED**

Verified in Lumenva Preview `dpl_GXBP48xHG5JgtGGajxcNHWzwuzGo`: failure was the expected missing product-agent contracts module.

- [x] **Step 3: Implement minimal contracts**

Stable IDs implemented exactly as specified. `SupervisorHandoffDecision.targetAgent` excludes `supervisor`; validation fails closed.

- [x] **Step 4: Verify GREEN**

Contracts passed typecheck/build gate after implementation.

- [x] **Step 5: Commit**

Committed on the isolated Phase 3 branch.

### Task 2: Supervisor versioned definition

**Files:**
- Create: `lib/agent-engine/product-agents/supervisor.ts`
- Modify: `tests/unit/agent-product-supervisor.test.ts`

**Interfaces:**
- Consumes: `AgentDefinition`, `SupervisorHandoffDecision`.
- Produces: `SUPERVISOR_AGENT_DEFINITION`, `normalizeSupervisorHandoff`.

- [x] **Step 1: Add failing tests** asserting ID/version, `autonomyLevel === 'shadow'`, no allowed side-effecting tool selectors, bounded loop budget, required structured-output capability, and safe normalization of malformed/ambiguous decisions to `escalation` with human escalation required.
- [x] **Step 2: Verify RED** in Lumenva Preview `dpl_6XqMMaPFdWW278LWzweXeXrUwiBD` because Supervisor module was absent.
- [x] **Step 3: Implement minimal versioned definition and pure fail-closed normalizer**. No dispatch or provider calls.
- [x] **Step 4: Verify GREEN** targeted suite + typecheck/build gate.
- [x] **Step 5: Commit**.

### Task 3: Atendimento and Sales

**Files:**
- Create: `lib/agent-engine/product-agents/atendimento.ts`
- Create: `lib/agent-engine/product-agents/sales.ts`
- Create: `tests/unit/agent-product-customer-roles.test.ts`

**Interfaces:**
- Produces typed recommendation outputs plus `ATENDIMENTO_AGENT_DEFINITION` and `SALES_AGENT_DEFINITION`.

- [x] **Step 1: Add RED tests** proving both definitions are SHADOW, expose no direct send capability, require appropriate structured output/tool capability only where needed, and outputs are recommendation/draft-shaped.
- [x] **Step 2: Verify RED** in the consolidated product-role RED gate.
- [x] **Step 3: Implement minimal role modules** with no execution logic.
- [x] **Step 4: Verify GREEN**.
- [x] **Step 5: Commit**.

### Task 4: Retention and Escalation

**Files:**
- Create: `lib/agent-engine/product-agents/retention.ts`
- Create: `lib/agent-engine/product-agents/escalation.ts`
- Create: `tests/unit/agent-product-retention-escalation.test.ts`

- [x] **Step 1: Add RED tests** for SHADOW, recommendation-only retention, and deterministic human-escalation output fields.
- [x] **Step 2: Verify RED** in the consolidated product-role RED gate.
- [x] **Step 3: Implement minimal modules**.
- [x] **Step 4: Verify GREEN**.
- [x] **Step 5: Commit**.

### Task 5: CRM Operator

**Files:**
- Create: `lib/agent-engine/product-agents/crm-operator.ts`
- Create: `tests/unit/agent-product-crm-operator.test.ts`

- [x] **Step 1: Add RED tests** proving definition is SHADOW, proposed mutations are typed as reversible CRM operations, and the module exports no direct DB/Supabase execution function.
- [x] **Step 2: Verify RED** in the consolidated product-role RED gate.
- [x] **Step 3: Implement minimal proposal-only definition/contracts**. Tool execution remains exclusively via kernel Tool Gateway after any future promotion.
- [x] **Step 4: Verify GREEN**.
- [x] **Step 5: Commit**.

### Task 6: Governance/Judge

**Files:**
- Create: `lib/agent-engine/product-agents/governance-judge.ts`
- Create: `tests/unit/agent-product-governance-judge.test.ts`

- [x] **Step 1: Add RED tests** for SHADOW, typed judgement, explicit recommendation-only promotion field, and no autonomy/policy mutation tool selectors.
- [x] **Step 2: Verify RED** in the consolidated product-role RED gate.
- [x] **Step 3: Implement minimal judgement module**.
- [x] **Step 4: Verify GREEN**.
- [x] **Step 5: Commit**.

### Task 7: Canonical registry, golden cases and Kernel wiring

**Files:**
- Create: `lib/agent-engine/product-agents/definitions.ts`
- Create: `lib/agent-engine/product-agents/index.ts`
- Create: `lib/agent-engine/product-agents/golden-cases.ts`
- Create: `lib/agent-engine/product-agents/resolver.ts`
- Create: `lib/agent-engine/product-agents/verification.ts`
- Create: `tests/unit/agent-product-definitions.test.ts`
- Create: `tests/unit/agent-product-golden-cases.test.ts`
- Create: `tests/unit/agent-product-kernel-wiring.test.ts`

**Interfaces:**
- Produces: `PRODUCT_AGENT_DEFINITIONS: ReadonlyMap<ProductAgentId, AgentDefinition>`, canonical lookup helper, product resolver adapter for Kernel `resolveAgent`, and deterministic product verification adapter for `KernelVerificationPort`.

- [x] **Step 1: Add RED registry tests** for exactly seven unique role IDs, versioned definitions, all SHADOW, no unknown lookup fallback, and no provider-specific imports in product-agent source.
- [x] **Step 2: Add RED golden cases** covering Supervisor routing to each specialist plus fallback escalation; one representative output contract per specialist.
- [x] **Step 3: Verify RED** in `dpl_5VaaCxVXUxPQuyx8PF9TyKCibibY`; expected product modules/registry/golden dataset were absent.
- [x] **Step 4: Implement registry/index and golden-case dataset**.
- [x] **Step 5: Audit canonical wiring for dead helpers**. Audit found registry/validators could remain disconnected from the Kernel, so a new TDD slice required explicit Kernel adapters.
- [x] **Step 6: Verify wiring RED** in `dpl_BPLRbjJ3wqjk7sXZ56HJTCJhz7ee`; expected `resolver.ts` and `verification.ts` were absent.
- [x] **Step 7: Implement Kernel resolver/verification adapters** without creating a second runtime or provider path.
- [x] **Step 8: Verify GREEN**: exact code SHA `344ca2e6a83721565de973286cd668728f2e72aa` passed 38/38 test files, 152/152 tests, typecheck, Next build and Lumenva Preview READY (`dpl_3Sy9gA5rAovPotbYNv2MVWJ76ymj`).
- [x] **Step 9: Commit**.

### Task 8: Architecture closure and Phase 3 gate

**Files:**
- Modify: `docs/architecture/agent-os/agents.md`
- Create: `docs/architecture/agent-os/phase-3-verification.md`
- Modify: `docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md` only after fresh evidence supports GO.

- [x] **Step 1: Document the product-definition layer, Kernel adapters and seven role boundaries**.
- [x] **Step 2: Run exact final code SHA through controlled Lumenva Vercel Preview** and capture test-file count, test count, typecheck and Next build evidence.
- [x] **Step 3: Verify no post-gate runtime/code changes**; closure commits after `344ca2e6...` are documentation-only.
- [x] **Step 4: Write exact verification evidence and boundaries** in `docs/architecture/agent-os/phase-3-verification.md`.
- [ ] **Step 5: Mark Phase 3 GO in the Master Plan only if every gate is fresh and green**.
- [ ] **Step 6: Run final documentation-only closure verification**.

## Self-review

Spec coverage: all seven roles, SHADOW/no side effects, one Kernel, provider independence, CRM authority, golden cases and final Vercel gate are covered. The closure audit added explicit product resolver/output-verification adapters so definitions are exercised through the canonical Kernel rather than remaining dead helpers. Placeholder scan: no TBD/TODO or delegated unspecified implementation steps. Type consistency: stable IDs, registry and Kernel adapter signatures are reused consistently.