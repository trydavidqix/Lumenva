# Content OS Foundation — Design

> **Status:** approved for documentation; pending implementation-plan review.
> **Scope:** the first incremental delivery of Spec 17.
> **Precedence:** `CLAUDE.md` > Spec 17 > this design.

## Goal

Establish the provider-agnostic foundation for the Lumenva Content OS without
connecting to a concrete provider or exposing a new product UI. This delivery
unblocks the Intelligence, Creative, Distribution, and Product UI plans while
keeping PostgreSQL/Supabase as the source of truth.

## Decisions

1. The new bounded context lives under `lib/content-os/`.
2. Content OS owns local domain state, jobs, and event vocabulary. It never
   treats an external provider as authoritative.
3. The existing `event_log` dispatcher and cron drain remain the sole generic
   asynchronous side-effect mechanism; Content OS only adds typed payloads and
   future consumers.
4. The four contracts are explicit and provider-agnostic:
   `IntelligenceProvider`, `CreativeProvider`, `VideoComposer`, and
   `DistributionProvider`. The registry uses explicit registration and fails
   closed for unknown providers.
5. Every Content OS table is tenant-aware with `organization_id`, RLS, trusted
   organization resolution, and an actual two-organization isolation test.
6. The domain owns the canonical state for creative and publication jobs.
   Provider identifiers are references only, and allowed state transitions are
   enforced in one reusable module.
7. Provider health is normalized, time-bounded, and safe to expose
   operationally: no credentials, response bodies, or raw provider errors.

## Data model

The foundation migration introduces the tables listed in Spec 17 for
intelligence, planning, creators, media, distribution, and learning. Each
mutable tenant entity has UUID primary key, `organization_id`, timestamps, and
domain-specific constraints/indexes. Provider references and deduplication use
tenant-aware uniqueness where the lifecycle requires it.

The schema change is released as a forward-only migration, the corresponding
idempotent `supabase/baseline.sql` section, a `MANIFEST.md` entry, and
regenerated `lib/database.types.ts`.

## Event and job flow

Domain services persist local state first, then emit a typed Content OS event
through the existing `emit_event` RPC. Existing workers claim, retry, back off,
and dead-letter via `event_log`; database triggers never perform HTTP. Future
adapters receive the event through registered workers and reconcile the
provider result back into the local job.

## Security and reliability

- Browser and mobile clients do not reach external engines.
- API work in subsequent phases resolves the active organization from trusted
  auth, validates input with Zod, and follows `/api/v1/` response contracts.
- Provider calls and publication side effects use the canonical idempotency
  mechanism in their implementation phases.
- Relevant mutations are auditable through the repository's canonical audit
  path.

## Out of scope

This delivery does not add RSSHub, changedetection.io, ComfyUI, Postiz, or a
video-composer implementation; no provider environment variables, browser
routes, UI screens, provider network calls, or SaaS release claims are added.

## Verification

Unit tests cover provider contracts, explicit registry behavior, job
transitions, event schemas, and safe health normalization. Database tests
cover table/constraint presence and RLS isolation across two organizations.
The completion gate additionally runs the repository's typecheck, lint,
channel-lint, harness, unit, database, and build checks that are applicable to
the changed code.
