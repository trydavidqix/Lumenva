# Toolchain canonicalization baseline

Branch: `chore/lumenva-toolchain-canonicalization`
Base: `integration/lumenva-complete`
Baseline commit: `84012d3558b997b101c8dc524be6beca0b9a4953`

Known-good baseline before modernization:
- Node: `22.23.3`
- pnpm: `9.15.9`
- Root workspace + shared lockfile
- 28 workspace manifests
- CI `verify` and `invariants` green on baseline

Known pre-existing issue:
- E2E is red on baseline. The canonicalization work must not mask failures; it must fix or preserve an explicitly tracked baseline until the E2E repair phase.

Safety rules:
- `main` is untouched.
- Work happens only on this branch.
- One small migration unit at a time.
- Every unit is validated before the next.
- No `skip`, `|| true`, forced installs, disabled checks, or silent failure suppression.
- Secrets are never committed. Use placeholders/mocks for build and non-live integration validation.
