# Hermes — Next Executable Gates

This checklist is intentionally limited to gates that require a real checkout/runtime and therefore cannot be honestly marked PASS from GitHub source inspection alone.

## Local disposable environment

```bash
git switch design/hermes-unified-learning-os-2026-09-13
pnpm install --frozen-lockfile
pnpm --dir apps/crm db:reset
cd apps/crm && supabase gen types typescript --local > lib/database.types.ts
```

## Targeted Hermes/Flywheel verification

```bash
pnpm --dir apps/crm exec vitest run \
  lib/agent-engine/contracts/flywheel-*.test.ts \
  lib/agent-engine/contracts/hermes-*.test.ts \
  tests/unit/hermes-*.test.ts \
  tests/unit/hermes-*.test.tsx
```

## Static and tenancy gates

```bash
pnpm --dir apps/crm typecheck
pnpm --dir apps/crm lint
pnpm --dir apps/crm lint:channels
pnpm --dir apps/crm lint:tenant-filter
```

## Database/RLS proof

```bash
pnpm --dir apps/crm test:db
```

The DB proof must include org A/org B fixtures with identical subject IDs/fingerprints and demonstrate that Hermes research, outcomes and capability trust never cross `organization_id`.

## Full repository gates

```bash
pnpm --dir apps/crm test:unit
pnpm --dir apps/crm build
pnpm --dir apps/crm harness:check
pnpm --dir apps/crm gov:verify
```

## Required adversarial assertions

- model cannot self-promote;
- stale/transferred evidence is never current PASS;
- `NOT_PROVEN`, `NOT_EXECUTED` and `BLOCKED` are never treated as PASS;
- KPI gain cannot bypass safety/policy;
- critical safety regression selects rollback;
- no cross-tenant retrieval;
- no raw secret/PII path into learning artifacts;
- no unrestricted service-role authority path;
- legacy Flywheel/Phase 6 records remain parseable.

## Prohibited during branch verification

- merge to `main`;
- rebase that rewrites `main`;
- production deploy;
- production Supabase migration;
- production secret changes.
