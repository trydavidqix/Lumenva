# Agent OS Verification Workflow Design

## Goal

Stop using Vercel as a build runner for every commit while preserving strict RED -> GREEN verification for Agent OS work.

## Decision

Use `agent-os-implementation-plan` as the implementation branch with automatic Vercel Git deployments disabled.

Keep a technical branch, `agent-os-verification`, with a permanent draft PR (#23) targeting `agent-os-implementation-plan`. No product work is authored on this branch.

Each phase gets only two intentional Vercel gates in the normal case:

1. **RED gate** — batch all failing tests on the implementation branch, reset the verification branch to that target, then make one verification-marker push so Vercel observes the open PR branch.
2. **GREEN gate** — after the phase implementation is complete, reset the verification branch to the final target and make one verification-marker push, then require the full gate to pass.

## Why the draft PR is required

Operational testing on the CRM Vercel project established the actual trigger behavior:

- normal implementation-branch pushes stopped deploying after the new Git policy;
- creating `agent-os-verification` at an existing SHA did not deploy;
- moving the ref by API did not deploy;
- creating a marker commit before a PR existed did not deploy;
- after draft PR #23 existed, the next push to `agent-os-verification` immediately created a Vercel Preview with `githubPrId=23`.

Therefore PR #23 is verification infrastructure only and must never be merged.

## Vercel configuration

```ts
git: {
  deploymentEnabled: {
    '*': false,
    'agent-os-verification': true,
  },
}
```

This keeps `main`, `agent-os-implementation-plan`, and normal branches from consuming Preview builds while allowing only the technical verification branch.

This is temporary Agent OS development policy. Before merging Agent OS to `main`, explicitly restore or replace the production deployment policy.

## Phase workflow

```text
agent-os-implementation-plan
      |
      +-- batch all RED tests
      +-- normal commits: 0 Vercel builds
      |
      +-- reset agent-os-verification to RED target
      +-- one docs-only gate marker push on PR #23
      |      +-- 1 Vercel Preview
      |      +-- confirm expected RED failures
      |
      +-- implement GREEN in batch
      +-- normal commits: 0 Vercel builds
      |
      +-- reset agent-os-verification to GREEN target
      +-- one docs-only gate marker push on PR #23
             +-- 1 Vercel Preview
             +-- typecheck
             +-- Agent OS Vitest suite
             +-- Next build
             +-- Preview READY
```

## Target-equivalence requirements

The Vercel deployment SHA is the verification-marker commit, not the implementation SHA itself. Therefore a gate is valid only when all of these are proven:

1. The verification PR base/head are the expected Agent OS branches.
2. Deployment metadata shows `githubCommitRef=agent-os-verification` and `githubPrId=23`.
3. The marker names the intended implementation target SHA.
4. `GitHub.compare_commits(target, verificationCommit)` shows **only** `docs/superpowers/verification/agent-os-gate.md` changed.
5. No application, runtime, config, migration, dependency, or test file differs from the target.
6. The requested RED or GREEN evidence comes from that deployment.

This makes the executable/tested code equivalent to the implementation target while still producing a real GitHub push event that Vercel accepts.

## GREEN gate

The build command remains:

```text
pnpm typecheck
pnpm exec vitest run --config vitest.agent-os.config.ts
pnpm build
```

The deployment must reach `READY` and the final build logs must show completion.

## Phase 1.5 evidence

Phase 1.5 GREEN target:

`c0119ed906a8cefb45b88588ab8169a9b68cdaca`

Verification commit:

`81321bd27c69434524c09482adf1e16e43aaba54`

Deployment:

`dpl_AmGnqBFMTDLif1YteSF2D1QPZk5T`

Evidence:

- target -> verification diff: only `docs/superpowers/verification/agent-os-gate.md`;
- `pnpm typecheck` completed and command chain advanced;
- 15/15 Agent OS test files passed;
- 72/72 tests passed;
- Next.js production build reported `Build Completed`;
- Vercel deployment reached `READY`.

Phase 1.5 is therefore GO.

## Safety constraints

- Never merge PR #23.
- Never merge or deploy `main` as part of RED/GREEN verification.
- Never promote a verification Preview to production without explicit approval.
- Never alter billing to bypass rate limits without explicit approval.
- Never apply pending database migrations through this workflow unless separately approved.
- Do not create repeated marker commits while a gate is already running.

## Expected usage

Typical phase:

- RED gate: 1 Preview
- GREEN gate: 1 Preview
- normal implementation commits: 0 Previews

Expected total: approximately 2 Vercel builds per phase.
