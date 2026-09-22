# Maestri V3 rollout matrix — 2026-09-22

## Scope

This gate is for the isolated `vps` branch only. It is read-only with respect to deployment: it validates state and never deploys, merges, installs Docker, or changes production.

## Matrix

| Check | Expected result | Current evidence |
|---|---|---|
| Branch `vps` | Allowed target | Current worktree is `vps` |
| Target `vps` | Allowed | `MAESTRI_TARGET=vps` |
| Target `main` | Blocked | `target_must_be_vps` |
| Target `production` | Blocked | `production_disabled`, `target_must_be_vps` |
| Dirty worktree | Blocked | `dirty_worktree` |
| Docker | Not required | Docker was not installed |
| OTLP collector | Optional/unavailable | No external collector installed or started |
| Graphiti provider | External configuration pending | No endpoint is assumed or fabricated |
| Provider quotas | Unavailable unless officially collected | No quota is fabricated |
| GitHub Actions/MCP | Configuration pending in the real target environment | No production workflow was triggered |
| Jules CLI | Not installed | No official local Jules CLI was found or required |
| Jules SDK / Agentic Workflows | Installed and doctor-validated | SDK smoke passed; `gh-aw v0.88.8`, doctor PASS |
| Codex Action | Prepared, not executed | Manual `vps`-only workflow; `OPENAI_API_KEY` remains external |
| Jules Action | Prepared, not executed | Manual `vps`-only workflow; `JULES_API_KEY` remains external |
| GitHub Actions secrets | Not configured | Remote `gh secret list` returned no repository secrets |
| Remote `vps` branch | Behind local worktree | New commits/workflows remain local; no push performed |
| Codex GitHub MCP | Configured with official native binary | Worktree `.codex/config.toml` uses read-only + lockdown; Codex host auth probe remains `Unsupported` |
| Claude GitHub MCP | Configured but unhealthy | OAuth dynamic registration is unsupported by the configured endpoint |
| Claude Docs MCP | Healthy | `Connected` |
| Claude Railway MCP | Configured but unauthenticated | `Needs authentication` |
| Gemini MCP / gh-aw MCP | No usable configured server | Gemini list was not configured; `gh aw mcp list` found no workflow MCP |

## Guard

The package exposes:

```powershell
pnpm --dir packages/maestri-context-gateway run check:rollout
```

The guard returns `READY_FOR_VPS` only when the current branch is `vps`, the target is `vps`, production mode is disabled, and the worktree is clean. Any other state returns `BLOCKED` with deterministic blockers.

The unit test covers the allowed state and the three safety classes: wrong branch/target, production mode, and dirty worktree.

## F25 conclusion

The local rollout safety gate is implemented. F25 remains open for external configuration and compatibility cleanup: official provider quota sources, Graphiti endpoint/credentials, optional OTLP collector, real GitHub Actions/MCP configuration, and a controlled rollout on `vps`. No merge to `main` and no production deployment are authorized by this gate.

## Official-source constraints

- The official GitHub MCP Server supports a native stdio binary or PAT/OAuth; the Docker path is explicitly excluded here because Docker is not installed.
- Codex Action requires a provider API secret in GitHub Actions; Jules Action requires `JULES_API_KEY`. No secrets are created automatically, so those workflows remain unconfigured until the owner supplies names, scope, and environment.
- The two workflow files are intentionally manual and `vps`-guarded. Static safety checks passed; `gh aw validate` is not applicable because these are standard YAML workflows and the repository has no Agentic Workflow Markdown source files. No workflow was dispatched.
- Remote metadata was read-only: repository `trydavidqix/Lumenva` has default branch `main`, no repository Actions secrets were listed, and the local `vps` changes were not pushed.
