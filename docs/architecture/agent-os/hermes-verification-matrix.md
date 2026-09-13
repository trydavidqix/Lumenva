# Hermes Verification Matrix

All statuses below are conservative. `IMPLEMENTED` means source changes exist on the Hermes branch. It does **not** mean runtime verification passed. `NOT_EXECUTED` means the required command/environment has not been run with fresh evidence in this implementation session.

| Gate | Status | Required proof |
|---|---|---|
| Hermes facade | IMPLEMENTED | targeted Vitest |
| Sanitization/provenance | IMPLEMENTED | targeted Vitest |
| Migration 0163 source | IMPLEMENTED | migration contract + disposable DB |
| RLS for Hermes tables | IMPLEMENTED IN SQL / NOT_EXECUTED | `test:db` with org A/B |
| Scientific research memory | IMPLEMENTED | targeted Vitest + DB repository tests |
| Same-tenant retrieval + mustRetest | IMPLEMENTED | targeted Vitest |
| Capability trust invalidation | IMPLEMENTED | targeted Vitest |
| Routing metrics | IMPLEMENTED | targeted Vitest |
| Generic outcome ledger | IMPLEMENTED | targeted Vitest + DB |
| Expanded candidates | IMPLEMENTED | Flywheel/Hermes tests |
| Explicit evidence states | IMPLEMENTED | validator/evidence tests |
| Meta-research | IMPLEMENTED | deterministic unit tests |
| Runtime observation normalization | IMPLEMENTED | native/Mastra fixture tests |
| Unified Hermes cycle | IMPLEMENTED | Hermes end-to-end fake-port test |
| Self-promotion prevention | EXISTING + HARDENED | adversarial suite |
| Critical rollback | EXISTING + HARDENED | monitoring/rollback tests |
| Read-only Hermes APIs | IMPLEMENTED | API unit tests + tenant-filter lint |
| Existing scheduler reuse | ADAPTER IMPLEMENTED / FULL LIVE WIRING NOT VERIFIED | scheduled-cycle + worker tests |
| Hermes evolution panel | IMPLEMENTED | component test + typecheck |
| Architecture docs | IMPLEMENTED | harness docs/index check |
| `database.types.ts` regeneration | NOT_EXECUTED | local Supabase type generation |
| Full TypeScript check | NOT_EXECUTED | `pnpm --dir apps/crm typecheck` |
| Lint | NOT_EXECUTED | `pnpm --dir apps/crm lint` |
| Tenant filter lint | NOT_EXECUTED | `pnpm --dir apps/crm lint:tenant-filter` |
| Unit suite | NOT_EXECUTED | `pnpm --dir apps/crm test:unit` |
| DB/RLS suite | NOT_EXECUTED | `pnpm --dir apps/crm test:db` |
| Production build | NOT_EXECUTED | `pnpm --dir apps/crm build` |
| Harness verification | NOT_EXECUTED | `pnpm --dir apps/crm harness:check` |
| Governance verification | NOT_EXECUTED | `pnpm --dir apps/crm gov:verify` |
| Production deploy | INTENTIONALLY NOT PERFORMED | outside branch-only authorization |
| Remote migration | INTENTIONALLY NOT PERFORMED | outside branch-only authorization |
| Merge to main | FORBIDDEN / NOT PERFORMED | branch isolation |

## Rule

No `NOT_EXECUTED` row may be reported as PASS based on code inspection alone.
