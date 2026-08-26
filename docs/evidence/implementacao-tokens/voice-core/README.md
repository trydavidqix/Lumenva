# Voice Core Evidence

Implementation evidence for `implementacao-tokens-voice-core`.

- Parent plan: `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md`
- Parent branch: `implementacao-tokens`
- Integration target for this work is **not** `main`.
- Voice remains a channel/runtime into the existing Agent OS; no channel-specific agent is introduced.

## Current gate

`bash scripts/verify-voice-core.sh`

The gate runs TypeScript, focused voice tests, tenant isolation lint and a Next.js build. Database/RLS evidence is added alongside schema tasks and must be run before final completion.
