# AI Platform baseline summary

Date: 2026-08-10

Branch baseline: `8116af42` (AI Platform branch updated with `origin/main`)

## Commands executed

- `pnpm install --frozen-lockfile` — passed; lockfile unchanged.
- `pnpm build` — passed. The historical `website/lib/contact-form` import failure is not present.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with 186 pre-existing warnings and no errors.
- `pnpm lint:channels` — failed on pre-existing channel-boundary debt outside the AI Platform scope.
- `pnpm test:unit` — failed outside the AI Platform scope: `tests/unit/import-puro-sem-env.test.ts` and `tests/unit/performed-at-um-relogio-so.test.ts`.
- `pnpm test:db` — blocked before database startup because Windows resolves `bash` to the WSL stub without `/bin/bash`. The Git Bash fallback reached Docker, but Docker Desktop's local daemon was stopped and requires Windows privileges to start.

## Runtime metrics

Not measured in Phase 0 because no AI Platform provider is enabled and this phase does not change agent runtime behavior. The required runtime metrics will be captured before any external provider rollout.

## Scope decision

No baseline defect was modified. The failed baseline checks are recorded as pre-existing, out-of-scope blockers for the Phase 0 release gate.
