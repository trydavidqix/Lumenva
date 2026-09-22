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

## Guard

The package exposes:

```powershell
pnpm --dir packages/maestri-context-gateway run check:rollout
```

The guard returns `READY_FOR_VPS` only when the current branch is `vps`, the target is `vps`, production mode is disabled, and the worktree is clean. Any other state returns `BLOCKED` with deterministic blockers.

The unit test covers the allowed state and the three safety classes: wrong branch/target, production mode, and dirty worktree.

## F25 conclusion

The local rollout safety gate is implemented. F25 remains open for external configuration and compatibility cleanup: official provider quota sources, Graphiti endpoint/credentials, optional OTLP collector, real GitHub Actions/MCP configuration, and a controlled rollout on `vps`. No merge to `main` and no production deployment are authorized by this gate.
