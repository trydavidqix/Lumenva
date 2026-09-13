# Mobile Compliance Guardian Inline Implementation Plan

> **Execution mode:** Inline only. No subagents. Work exclusively on `wave10/mobile-compliance-guardian-2026-09-13`; do not merge to `main`.

**Goal:** Make App Store and Play Store delivery require build-bound, tenant-bound compliance evidence and preserve a verifiable release chain.

**Architecture:** Extend Wave 10 Product Factory rather than introducing a parallel release system. Deterministic scanners and policy snapshots produce evidence; AI/runtime adapters add optional deeper review; the existing durable delivery gate and Agent OS approval boundary remain authoritative execution controls.

**Tech Stack:** TypeScript, Vitest, PostgreSQL/Supabase RLS, Next.js, GitHub Actions.

**Spec:** `docs/business-os/MOBILE-COMPLIANCE-GUARDIAN.md`

## Global Constraints

- One implementation branch only.
- No automatic merge to `main`.
- No hard policy block from an unverified AI-only claim.
- Tenant/build/artifact identity is mandatory for release evidence.
- Existing Wave 10 gates and Agent OS policies are extended, not bypassed.

## Execution checklist

- [x] Create isolated implementation branch from `qa/wave10-delivery-real-proof-2026-09-13`.
- [x] Add canonical contracts, framework detector, policy snapshots, scanners, evidence/deduplication, verdict engine, runtime adapter contract, guardian orchestrator, docs, and unit tests.
- [ ] Persist reports/evidence/policy/runtime state with tenant RLS.
- [ ] Bind mobile compliance evidence into `DeliveryBuildEvidence` and enforce it for `APP_STORE`/`PLAY_STORE`.
- [ ] Add Agent OS tool metadata and approval-protected store submission capability.
- [ ] Extend delivery receipts with compliance provenance.
- [ ] Add CLI/CI release-check entry points.
- [ ] Add API/UI visibility for release reports.
- [ ] Add adversarial, cross-tenant, binding, concurrency, and regression tests.
- [ ] Run available CI verification and document any environment-only blockers.
