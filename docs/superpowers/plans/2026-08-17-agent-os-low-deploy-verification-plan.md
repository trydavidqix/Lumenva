# Agent OS Low-Deploy Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop automatic Vercel deployments during Agent OS development and use only intentional exact-HEAD Preview gates for RED and GREEN verification.

**Architecture:** Keep a single implementation branch, `agent-os-implementation-plan`. Vercel Git auto-deploys are disabled globally while Agent OS is under construction; phase verification is initiated manually from the exact SHA being gated, and deployment metadata must be checked against that SHA before accepting evidence.

**Tech Stack:** Vercel project configuration (`vercel.ts`), GitHub branch/commit metadata, Vitest, TypeScript, Next.js.

## Global Constraints

- Never merge or deploy `main` as part of Agent OS phase verification.
- Never promote a Preview to production without explicit approval.
- Never change billing, secrets, or apply database migrations as part of this workflow.
- Preserve strict TDD evidence: one RED Preview and one final GREEN Preview per phase.
- A phase is not GO until the final Preview verifies the exact target SHA with `pnpm typecheck`, `pnpm exec vitest run --config vitest.agent-os.config.ts`, and `pnpm build`.
- Before Agent OS is merged, explicitly decide and document the permanent deployment policy for `main`.

---

### Task 1: Disable automatic Git deployments

**Files:**
- Modify: `vercel.ts`
- Reference: `docs/superpowers/specs/2026-08-17-agent-os-verification-workflow-design.md`

**Interfaces:**
- Consumes: Vercel `VercelConfig.git.deploymentEnabled`.
- Produces: a project config where normal Git pushes trigger zero Vercel builds during Agent OS construction.

- [ ] **Step 1: Confirm the current config still enables any automatic verification branch**

Read `vercel.ts` and verify whether `git.deploymentEnabled` is an object or otherwise allows an automatic branch.

- [ ] **Step 2: Replace branch-specific deployment configuration with the approved global-off policy**

Use:

```ts
git: {
  deploymentEnabled: false,
},
```

Update the surrounding comment so it no longer references `agent-os-verification`.

- [ ] **Step 3: Review the diff**

Expected: only the temporary verification policy/comment changes; build command, cron, and function settings remain unchanged.

- [ ] **Step 4: Commit**

Commit message:

```text
chore(agent-os): disable automatic Vercel git deploys
```

### Task 2: Align the master plan with two manual gates per phase

**Files:**
- Modify: `docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md`
- Reference: `docs/superpowers/specs/2026-08-17-agent-os-verification-workflow-design.md`

**Interfaces:**
- Consumes: the approved verification design.
- Produces: explicit execution guidance for all remaining phases.

- [ ] **Step 1: Locate the current verification/runner guidance**

Find references to Vercel Preview, branch gates, CI, RED/GREEN verification, or `agent-os-verification`.

- [ ] **Step 2: Record the canonical phase verification rule**

The master plan must say:

```text
Normal commits: 0 automatic Vercel deploys.
RED batch: 1 intentional Preview of the exact current SHA; observe expected failures before production code.
GREEN final: 1 intentional Preview of the exact final SHA; require typecheck + Agent OS Vitest + Next build + READY.
```

- [ ] **Step 3: Preserve current Phase 1.5 status**

Phase 1.5 remains pending final exact-SHA GREEN verification; do not backfill GO from an older Preview.

- [ ] **Step 4: Commit**

Commit message:

```text
docs(agent-os): align master plan with manual preview gates
```

### Task 3: Verify configuration and gate mechanics

**Files:**
- Verify: `vercel.ts`
- Verify: current GitHub branch head and Vercel deployment metadata

**Interfaces:**
- Consumes: final branch SHA and Vercel deployment metadata.
- Produces: evidence that automatic deploys are off and future phase gates can be tied to exact SHAs.

- [ ] **Step 1: Confirm no new automatic deployment is created by ordinary commits after the config change**

Check Vercel deployment history and GitHub commit status. A normal commit after the config change must not create a Preview build.

- [ ] **Step 2: When Vercel build quota is available, initiate the Phase 1.5 final Preview intentionally from the current implementation SHA**

Do not promote it to production.

- [ ] **Step 3: Verify deployment metadata matches the target SHA**

Reject evidence if the deployment SHA differs from the intended implementation head.

- [ ] **Step 4: Verify the complete gate**

Required build command:

```text
pnpm typecheck && pnpm exec vitest run --config vitest.agent-os.config.ts && pnpm build
```

Expected: exit 0, all Agent OS tests pass, Next build succeeds, deployment reaches `READY`.

- [ ] **Step 5: Only after fresh evidence, mark Phase 1.5 GO and begin Phase 1.6 under the two-preview workflow**
