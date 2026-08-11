# Task 6 — LangSmith-compatible offline evaluation runner

## Final status

Implemented the offline-first evaluation runner and `pnpm ai:eval:langsmith` command. It loads the 25 synthetic golden cases and evaluates deterministic tenant marker, required/forbidden content, authority domain, risk, secret redaction, and fallback behavior. The runner accepts an evaluation target so it can score supplied outputs instead of deriving a pass from the expected fixture; the package command labels its no-target baseline as `synthetic_reference`. Dataset upload is disabled by default and requires both `--upload-synthetic` and the existing `LANGSMITH_API_KEY` configuration.

## Commits

- `test(ai-observability): add LangSmith evaluation runner`

## Tests

- RED observed: `pnpm vitest run tests/unit/ai-platform-eval-langsmith.test.ts` failed before the runner existed.
- PASS: `pnpm vitest run tests/unit/ai-platform-eval-langsmith.test.ts` (6 tests).
- PASS: `pnpm ai:eval:langsmith` (25 cases; 0 failed; no upload; no LLM judge).
- PASS: `pnpm ai:eval:local` (25 cases; 0 duplicate IDs; status pass).
- PASS: `pnpm typecheck`, focused ESLint, and `git diff --check`.

## Concerns

- No `LANGSMITH_API_KEY` was available to the command, so no remote synthetic experiment ran and no account/provider was activated.
- LLM judging remains optional and requires an injected judge plus explicit enable flag and API-key configuration; the CLI does not supply one.
