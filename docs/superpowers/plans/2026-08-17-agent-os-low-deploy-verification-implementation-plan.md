# Agent OS Low-Deploy Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:verification-before-completion for each intentional gate.

**Goal:** Keep normal Agent OS development off Vercel and use approximately two intentional Preview builds per phase: one RED gate and one GREEN gate.

## Proven architecture

- Implementation branch: `agent-os-implementation-plan`
- Verification branch: `agent-os-verification`
- Verification PR: draft PR #23, base `agent-os-implementation-plan`, **never merge**
- Vercel project: `crm`
- Vercel Git policy:

```ts
git: {
  deploymentEnabled: {
    '*': false,
    'agent-os-verification': true,
  },
}
```

Normal implementation commits do not deploy. Vercel only produced a Preview for the technical branch after PR #23 was open and a new commit was pushed to that branch.

## Gate procedure

For RED or GREEN:

1. Commit the complete target batch on `agent-os-implementation-plan`.
2. Do not trigger Vercel for intermediate implementation commits.
3. Reset/move `agent-os-verification` to the intended target commit.
4. Push exactly one verification marker at `docs/superpowers/verification/agent-os-gate.md` while draft PR #23 is open.
5. Confirm the Vercel deployment has:

```text
githubCommitRef = agent-os-verification
githubPrId = 23
```

6. Compare the implementation target to the Vercel commit. The only allowed difference is `docs/superpowers/verification/agent-os-gate.md`.
7. For RED, confirm failures are the expected missing-feature failures before writing production code.
8. For GREEN, require:

```text
pnpm typecheck
pnpm exec vitest run --config vitest.agent-os.config.ts
pnpm build
```

and require the Preview to reach `READY`.

If Vercel returns `build-rate-limit`, the gate is blocked, not failed. Do not spam retry commits.

## Task status

### Task 1 — Low-deploy Git policy

- [x] Disable automatic deploys for normal branches.
- [x] Allow only `agent-os-verification`.
- [x] Prove a later implementation commit receives no automatic Vercel deployment.

### Task 2 — Verification trigger

- [x] Create `agent-os-verification`.
- [x] Discover that branch creation/ref movement alone does not trigger this Vercel project.
- [x] Create permanent draft verification PR #23.
- [x] Prove a push made after PR #23 exists triggers a Preview.

### Task 3 — Target equivalence

- [x] Require a docs-only marker.
- [x] Require `GitHub.compare_commits(target, verificationCommit)` to show no runtime/config/test/migration differences.
- [x] Require Vercel metadata to identify the technical branch/PR.

### Task 4 — Phase 1.5 GREEN

Target implementation SHA:

`c0119ed906a8cefb45b88588ab8169a9b68cdaca`

Verification SHA:

`81321bd27c69434524c09482adf1e16e43aaba54`

Vercel deployment:

`dpl_AmGnqBFMTDLif1YteSF2D1QPZk5T`

Fresh evidence:

- [x] target -> verification diff contains only `docs/superpowers/verification/agent-os-gate.md`.
- [x] `pnpm typecheck` completed successfully (the chained command advanced into Vitest).
- [x] 15/15 Agent OS test files passed.
- [x] 72/72 tests passed.
- [x] Next.js production build reported `Build Completed in /vercel/output`.
- [x] Vercel deployment reached `READY`.
- [x] Phase 1.5 GO.

### Task 5 — Future phases

For Phase 1.6 and later approved phases:

- [ ] Batch all RED tests on the implementation branch.
- [ ] Trigger one RED Preview through PR #23.
- [ ] Implement GREEN in batch with zero intermediate Vercel builds.
- [ ] Trigger one final GREEN Preview through PR #23.
- [ ] Before merge to `main`, explicitly restore or replace the temporary production Git deployment policy.

## Safety

- Never merge PR #23.
- Never promote these Previews to production without explicit approval.
- Do not touch `main`, billing, secrets, or apply migrations through this workflow.
- The temporary `'*': false` Git policy must be revisited before Agent OS is merged.
