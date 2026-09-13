# Hermes branch-only scope

This branch intentionally stops short of actions that require an executable environment or external state mutation.

## Safe to author on the branch

- source code;
- tests;
- read-only APIs;
- UI wiring;
- architecture docs;
- additive migration source;
- adapters and contracts;
- verification checklists.

## Requires executable/local environment before PASS

- TypeScript compilation;
- Vitest execution;
- lint execution;
- disposable Supabase reset;
- RLS org A/org B proof;
- database type regeneration;
- Next.js production build;
- harness/governance verification.

## Explicitly outside this branch-only authorization

- applying migrations to production;
- production deployment;
- changing production secrets;
- merging or rebasing into `main`.
