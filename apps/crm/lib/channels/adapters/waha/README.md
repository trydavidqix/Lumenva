# WAHA transport adapter — EXPERIMENTAL / PARTIAL

This adapter is a Lumenva-owned integration candidate. It is not production validated.
The frozen source branch reported failed GitHub Actions checks (`verify` and
`verify-and-build`); validation must be repeated by GitHub Actions before promotion.

The adapter is not wired into the active channel path here. Keep the existing WAHA
transport as the default. Do not enable an experimental adapter flag in a deployed
environment. The source branch's optional F7 wiring supplies a synthetic organization
fallback and is intentionally excluded until it can receive real tenant context.

Tests in this directory use fakes only. No credentials, phone numbers, or live WAHA
requests belong in fixtures. This integration must not initiate voice calls.
