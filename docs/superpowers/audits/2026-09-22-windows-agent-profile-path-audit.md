# Windows agent profile and path audit

Date: 2026-09-22
Scope: Windows profile, ChatGPT/Codex app and CLI, Claude Code, Gemini CLI, Antigravity, skills, plugins, hooks, MCP, path overrides, versions and authentication state. Read-only audit; no settings, credentials, PATH, installs or user data were changed.

## Result

The Windows profile resolves consistently to `%USERPROFILE%`; `HOMEDRIVE`/`HOMEPATH` agree, and no persistent `CODEX_HOME`, `CLAUDE_CONFIG_DIR` or Gemini home override was found. The Codex app and CLI use the expected `%USERPROFILE%\.codex` profile. The audit does not establish that the reported app error is fixed or identify its cause; no exact error log was available.

## Observed paths and state

| Surface | Default path | Observed state |
|---|---|---|
| Codex app and CLI | `%USERPROFILE%\.codex` | App and CLI are installed; the profile path matches the default. Standalone and app-managed runtimes are separate. |
| Codex skills | `%USERPROFILE%\.agents\skills`; project `.agents\skills` | Global and workspace skills are present; bundled `.codex\skills\.system` is separate. |
| Claude Code | `%USERPROFILE%\.claude` | Default directory exists; no `CLAUDE_CONFIG_DIR` override. Auth status was checked without reading credential files. |
| Antigravity IDE | `%USERPROFILE%\.gemini\config` | Global skills directory exists; MCP configuration file exists and is empty. |
| Antigravity CLI | `%USERPROFILE%\.gemini\antigravity-cli` | CLI settings exist; CLI-specific skills/plugins directories and configured MCP servers were not found. |
| Legacy Gemini CLI | `%USERPROFILE%\.gemini\settings.json` | Legacy CLI remains installed; its configuration is distinct from Antigravity. |
| Project config | Repo `.codex`, `.claude`, `.agents` | Codex project config and workspace skills exist; no project Claude MCP file was found at the audited root. |

No symlinks, moves, reinstalls, cleanup or Docker changes were made. The `CODEX_HOME` line inside `config.toml` is unverified and was not changed. No tokens, credential values, absolute owner paths or histories were recorded.

## Official path references

- [OpenAI Codex Windows app](https://learn.chatgpt.com/docs/windows/windows-app)
- [OpenAI Codex environment variables](https://learn.chatgpt.com/docs/config-file/environment-variables)
- [OpenAI Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Anthropic Claude Code directory](https://code.claude.com/docs/en/claude-directory)
- [Google Antigravity MCP](https://antigravity.google/docs/ide-mcp)
- [Google Antigravity skills](https://www.antigravity.google/docs/skills)
- [Google Gemini CLI migration](https://antigravity.google/docs/cli/gcli-migration/)

## Safe follow-up

Keep current profile roots. Obtain the exact app error before diagnosing or changing configuration. Any future migration requires an inventory, verified backup, dry run, rollback plan and explicit owner approval.
