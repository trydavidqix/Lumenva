# Lumenva Mobile Compliance Guardian

## Purpose

The Mobile Compliance Guardian is the canonical Product Factory release-certification boundary for App Store and Google Play delivery. It combines deterministic policy checks, evidence binding, optional AI semantic review, runtime review adapters, and store metadata checks. Store submission remains a separate privileged action behind the Agent OS approval policy.

## Invariants

1. A mobile compliance report is bound to `organizationId`, `projectId`, `buildRef`, `artifactRef`, and `artifactHash`.
2. iOS reports can target only `APP_STORE`; Android reports can target only `PLAY_STORE`.
3. Verified HIGH or CRITICAL findings block release. Findings without verifiable evidence can require manual review but cannot independently create a hard policy block.
4. Policy snapshots are versioned and hashed. A release records the exact policy snapshot used for certification.
5. Runtime infrastructure failure is not a store-policy violation. It produces review state when runtime evidence is required.
6. `main` is not an implementation workspace. This feature is developed on `wave10/mobile-compliance-guardian-2026-09-13` and is not merged automatically.

## Pipeline

`build -> tests/security -> framework detection -> policy snapshot -> deterministic scan -> metadata audit -> optional AI audit -> runtime review -> verdict -> mobile delivery gate -> Agent OS approval -> store submission -> delivery receipt`

## Enforcement model

`PASS` means no detected blocker. `PASS_WITH_WARNINGS` means only informational/low/medium verified findings exist. `NEEDS_REVIEW` means evidence or runtime state requires a human decision. `BLOCK` means at least one verified HIGH/CRITICAL finding or a verified runtime critical-flow failure exists.

## Source of truth

Repository rule registries are implementation snapshots, not permanent policy truth. Apple and Google source references are stored with each policy snapshot, and changing policy rules must create a new version/hash rather than mutating release history.
