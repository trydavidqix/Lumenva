# EXPERIMENTAL / PARTIAL — Lumenva Local Runtime

Preserved from frozen source `339a19b49d1346bfb40fe09c8880b7b19513d04b`. This private package is included by the root `packages/*` pnpm workspace glob so its declared checks can run; no app imports or starts it. It is not production-ready and requires GitHub Actions validation before adoption.

The command runner and read-only executor are useful prototypes, not a security boundary. Executables require absolute real paths on the allowlist. `gitExecutable` must be configured to such a path before Git capabilities can run; its current default `git` is rejected. `serviceHealth` and `portCheck` accept caller-provided destinations, so restrict them before exposing either capability to untrusted callers. Review environment handling, output redaction, and filesystem race conditions before production use. Do not pass untrusted commands or inputs to this runtime. MCG/Maestri gateway integration is out of scope.
