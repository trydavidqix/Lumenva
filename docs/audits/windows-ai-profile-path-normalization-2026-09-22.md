# Windows AI Profile Paths — Audit and Safe Normalization Plan

**Status:** audit and planning only; no profile paths, app state, credentials, installations, caches, or provider configuration were changed.
**Branch:** `vps`
**Canonical plan:** [`MAESTRI_AGENT_ARCHITECTURE.md`](../MAESTRI_AGENT_ARCHITECTURE.md), Phase 42.
**Audit date:** 2026-09-22.

## Objective

Resolve the reported ChatGPT app error attributed to a profile path without guessing, duplicating skills/plugins, resetting the app, or moving provider data into a nonstandard directory. Preserve each vendor's supported path model and make any later repair reversible.

## Findings from the read-only Windows inventory

Windows identity roots resolve to `C:\Users\David`; `APPDATA` and `LOCALAPPDATA` resolve under that profile. No persistent `CODEX_HOME`, `CODEX_DIR`, `GEMINI_CLI_HOME`, or `CLAUDE_CONFIG_DIR` override was found in the inspected process/user/machine environment.

| Product/data | Observed path/state | Assessment |
|---|---|---|
| ChatGPT/Codex profile | `C:\Users\David\.codex` | Exists as an ordinary directory; matches the documented Windows app home. |
| Codex config | `.codex\config.toml`, `.codex\AGENTS.md` | Present. A `CODEX_HOME` string also occurs inside one MCP server's `env` table; that is scoped to the child server, not a global Windows override. |
| Codex executables | `.codex\packages\standalone\current\bin\codex.exe` and `AppData\Local\Programs\OpenAI\Codex\bin\codex.exe` | Both exist and report `codex-cli 0.155.1`; both are 307,108,144 bytes with identical SHA-256 `EBA0F32C976667CB9298EFAFD98513E823EEDA7B576A03EC658BB8BE8D336316`. The MCG runner explicitly targets the first path. This is one byte-identical CLI payload reachable through two roots—not evidence that the profile itself was moved. Keep both roots until install ownership and update mechanism are confirmed. |
| Codex app package | `%LOCALAPPDATA%\Packages\OpenAI.Codex_2p2nqsd0c76g0` | Separate app-managed storage; do not relocate or hand-edit as part of normal profile cleanup. Registered app version observed: `26.917.6896.0`. AppX cmdlet/log inspection was unavailable in this runtime, so package logs were not verified. |
| Codex state | `.codex\.codex-global-state.json` and `.bak` | Both exist. Parsed with case-sensitive-safe PowerShell hashtable handling; both report an empty `local-projects` map. The known public multi-root `rootPaths` failure pattern was therefore not observed in these files. |
| OpenAI skills | `%USERPROFILE%\.agents\skills` (68 immediate folders); `.codex\skills\.system` | Personal skills are in the documented user root. Keep the bundled `.system` directory separate and untouched. |
| Codex hooks | Global `.codex\hooks.json` absent; project hook/config roots are distinct | Not itself an error. Official Codex supports `hooks.json` beside active config layers or inline hooks in `config.toml`; do not create a standalone hook path speculatively. |
| Antigravity/Gemini | `agy` 1.2.8; `gemini` 0.60.0; `.gemini\antigravity-cli\settings.json`, `.gemini\settings.json`, `.gemini\config\mcp_config.json` present | These represent different Google product generations/surfaces, not one interchangeable profile. Seven skill folders were observed under `.gemini\config\skills`; CLI skills must be checked separately before any change. |
| Claude Code | `claude` 2.1.280; `%USERPROFILE%\.claude\settings.json`; `.claude\skills` (10 immediate entries); `.claude\plugins` | Home exists at the provider-specific root. Skill/plugin overlap should be inventoried by manifest/name/hash, not resolved by blind copying. |
| App error evidence | No error text supplied; expected package log location was not found in the bounded check | Exact cause remains `UNDIAGNOSED`; the profile root itself matches the documented default. |

The OpenAI desktop app documentation states that native Windows ChatGPT/Codex uses `%USERPROFILE%\.codex`; WSL CLI defaults to its Linux home unless separately configured. OpenAI documents personal skills at `$HOME/.agents/skills`, repository skills at `.agents/skills`, and system skills as bundled. Codex hooks may be in `~/.codex/hooks.json` or `~/.codex/config.toml` (and project equivalents), so a global hooks file is optional, not a missing prerequisite. [Windows app and WSL paths](https://learn.chatgpt.com/docs/windows/windows-app?translationFallback=es-419) · [Codex skill locations](https://learn.chatgpt.com/docs/build-skills?translationFallback=es-419) · [Codex hooks](https://learn.chatgpt.com/docs/hooks).

Google documents distinct skill roots for Antigravity IDE (`~/.gemini/config/skills`) and Antigravity CLI (`~/.gemini/antigravity-cli/skills`), with `.agents/skills` as a workspace location. Gemini CLI migration also distinguishes its legacy paths from Antigravity's MCP/settings paths. Therefore the seven folders under `.gemini/config/skills` must not be moved to the CLI root without proving which runtime uses them. [Antigravity skills](https://www.antigravity.google/docs/skills?tab=ide) · [Gemini CLI migration](https://antigravity.google/docs/cli/gcli-migration/) · [Antigravity CLI settings](https://antigravity.google/docs/settings?tab=ide).

Anthropic's documented personal Claude Code skills root is `~/.claude/skills`, matching the observed provider-specific layout. [Claude Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview).

## Community signal and applicability

An open report in the official OpenAI Codex issue tracker describes a Windows desktop startup loop when one project's `local-projects.<id>.rootPaths` contains multiple roots. The local state and backup inspected here both have an empty `local-projects` map, so this report is a diagnostic lead, **not an established cause** for this user's failure. [Codex issue #38181](https://github.com/openai/codex/issues/38181).

The MCG runner at `C:\Users\David\.lumenva\maestri-context-gateway\bin\mcg-run.ps1` uses the standalone Codex path under `.codex\packages\standalone\current`. That executable exists and matches the other installed CLI byte-for-byte. The kit text's internal `codex-cto/` package layout does not state a target install path and does not prove that either Codex root was changed by the kit.

## Proposed sequence for any future repair (not executed)

1. **Capture the failure:** record exact app error text, timestamp, app version, whether it occurs at launch/open-project/terminal, selected Windows vs WSL mode, and the project path. Redact tokens and account identifiers.
2. **Read-only path diagnosis:** inspect only documented app logs and relevant state keys; compare primary and backup state; enumerate roots and worktrees; distinguish `%USERPROFILE%`, Codex home, project/worktree path, WSL Linux home, and app package storage. Do not dump full auth/state files.
3. **Classify the cause:** profile override, stale/nonexistent project root, multi-root serialization, Windows/WSL path boundary, unsupported config, version regression, or unknown. If no evidence identifies one, stop with `UNDIAGNOSED` and escalate with the minimal redacted log bundle.
4. **Prepare a dry-run migration only if necessary:** make a manifest of each proposed source/destination, provider/scope, file count, hashes, collisions, backup location, verification test, and rollback. Preserve originals and caches; never merge same-named skill folders automatically.
5. **Apply one reversible change at a time after owner approval:** copy (not move), verify hashes and provider discovery, restart only the relevant app/CLI, run smoke checks, then observe. Retain backup until acceptance; rollback by restoring the original config/state snapshot. No app reset/reinstall, credential re-login, secret copy, cache purge, junction/symlink, or broad profile rewrite without separate evidence and approval.

## Acceptance gates

- Exact reported error is captured and the diagnosis cites local evidence.
- Native Windows Codex app remains on `%USERPROFILE%\.codex`; WSL is treated separately.
- Every discovered skill/plugin/MCP/hook/auth/cache path is assigned to its owning runtime and supported scope.
- No duplicate folder is copied or merged without identity/hash review.
- Any approved migration has backup, manifest, integrity checks, smoke test, and rollback.
- App opens the intended project and the relevant provider discovers its existing config/skills without re-authentication or data loss.
- No Docker, reinstall, main-branch change, deployment, or unrelated setup change is included.

## Plan integration / non-duplication


The supplied `Texto colado.txt` describes a proposed/generated Maestri Agentic OS kit and claims a 91-file ZIP was created and copied to ChatGPT Library. The attachment directory contains only that text, not the ZIP; no matching ZIP or kit `install.ps1` was found in the checked Downloads/Desktop locations or the MCG workspace. The text lists package-internal directories but no absolute installation destinations or before/after path manifest. Therefore it is useful as package scope, but cannot by itself establish which Windows paths were changed. The plan now treats the kit installer as a future dry-run/manifest gate and records the MCG standalone Codex path above.
