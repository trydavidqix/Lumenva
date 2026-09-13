# Hermes branch implementation status

Branch: `design/hermes-unified-learning-os-2026-09-13`

This file records branch-local implementation status only. It is not evidence that tests, database reset, build or production deployment passed.

## Implemented in branch

- Hermes facade over the existing Flywheel.
- Sanitized learning signals and provenance.
- Additive migration `0163_hermes_learning_os` for research experiments, generic outcomes and capability identities.
- Scientific research memory and controlled same-tenant retrieval with `mustRetest` semantics.
- Capability trust/fingerprint primitives.
- Adaptive routing/context/reviewer metrics.
- Generic outcome ledger.
- Expanded governed candidate manifest.
- Explicit evidence states.
- Meta-research recommendation layer.
- Provider-neutral runtime observation adapter.
- Unified Hermes cycle that cannot directly activate changes.
- Promotion/rollback safety hardening and tenant-aware stores.
- Read-only Hermes APIs.
- Branch-local scheduled Flywheel adapter for Hermes.
- Hermes learning observability panel on the existing AI evolution surface.
- Canonical Hermes Learning OS architecture documentation.

## Intentionally not performed

- No merge or rebase into `main`.
- No production deployment.
- No remote Supabase migration application.
- No production credentials/secrets mutation.
- No direct ACTIVE/self-promotion path.

## Verification still requiring an executable checkout/environment

These gates must remain `NOT_EXECUTED` until they are run with fresh output:

```bash
pnpm --dir apps/crm exec vitest run lib/agent-engine/contracts/flywheel-*.test.ts lib/agent-engine/contracts/hermes-*.test.ts tests/unit/hermes-*.test.ts tests/unit/hermes-*.test.tsx
pnpm --dir apps/crm typecheck
pnpm --dir apps/crm lint
pnpm --dir apps/crm lint:channels
pnpm --dir apps/crm lint:tenant-filter
pnpm --dir apps/crm test:unit
pnpm --dir apps/crm test:db
pnpm --dir apps/crm build
pnpm --dir apps/crm harness:check
pnpm --dir apps/crm gov:verify
```

`apps/crm/lib/database.types.ts` must be regenerated from a local/disposable Supabase instance containing the Hermes schema. It must not be hand-edited merely to make the branch look complete.

## Definition of branch-local limit

The maximum safe progress without an executable repository/DB environment is reached when all code, tests, docs, API/UI wiring and branch-only integration changes are authored, but claims about compilation, tests, DB/RLS behavior or build remain unverified.
