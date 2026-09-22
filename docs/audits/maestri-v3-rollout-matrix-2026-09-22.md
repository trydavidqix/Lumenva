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
| Graphiti local fallback | Ready | `GRAPHITI_MODE` defaults to `off`; Core returns an empty read-only graph without remote calls |
| Provider quotas | Unavailable unless officially collected | No quota is fabricated |
| GitHub Actions/MCP | Configuration pending in the real target environment | No production workflow was triggered |
| Jules CLI | Not installed | No official local Jules CLI was found or required |
| Jules SDK / Agentic Workflows | Installed and doctor-validated | SDK smoke passed; `gh-aw v0.88.8`, doctor PASS |
| Codex Action | Prepared, not executed | Manual `vps`-only workflow; `OPENAI_API_KEY` remains external |
| Jules Action | Prepared, not executed | Manual `vps`-only workflow; `JULES_API_KEY` remains external |
| GitHub Actions secrets | Jules configured | `JULES_API_KEY` was copied from Google Secret Manager project `lumenva`; value was never printed |
| Remote `vps` branch | Behind local worktree | New commits/workflows remain local; no push performed |
| Workflow syntax | Validated | Official `actionlint v1.7.12` passed both manual workflows |
| Codex GitHub MCP | Configured with official native binary | Worktree `.codex/config.toml` uses read-only + lockdown; Codex host auth probe remains `Unsupported` |
| Claude GitHub MCP | Configured but unhealthy | OAuth dynamic registration is unsupported by the configured endpoint |
| Claude Docs MCP | Healthy | `Connected` |
| Claude Railway MCP | Configured but unauthenticated | `Needs authentication` |
| Gemini MCP / gh-aw MCP | Gemini configured but disabled by host trust; gh-aw has no MCP | Project settings use official GitHub MCP read-only/lockdown; `gh aw mcp list` found no workflow MCP. Gemini exposes explicit `--skip-trust` for a session; it was not used automatically |

## Graphiti VPS contract reconciliation — Task 1

Auditoria realizada na branch isolada `vps`, sem alterar `main`, produção, flags ou
valores de secrets.

| Contract area | Maestri V3 | VPS/documented runtime | Result |
|---|---|---|---|
| Mode | `off \| shadow \| on` | Runbook describes legacy CRM `canary` as rollout vocabulary | Reconciled: V3 keeps the three modes; `canary` stays an external legacy policy |
| Endpoint | `GRAPHITI_BASE_URL` | `http://graphiti:8000` on private `ai-graph-internal` network | Name and topology match; no public URL added |
| App secret | `GRAPHITI_API_KEY` | Shared app/sidecar secret; adapter sends `X-Api-Key` | Name matches; value remains runtime-only |
| Timeout | `GRAPHITI_TIMEOUT_MS` | Maestri default `2000` ms | Compatible; no secret involved |
| Sidecar secrets | `GRAPHITI_NEO4J_PASSWORD`, `GRAPHITI_LLM_API_KEY`, `GRAPHITI_LLM_BASE_URL`, `GRAPHITI_LLM_MODEL`, `GRAPHITI_EMBEDDER_MODEL` | Documented in Infisical project `DeskcommCRM - Lumenva`, environment `prod` | Sidecar-only; never copied into Maestri prompts, Git, or Windows env |
| Provider/backend | Graphiti HTTP adapter | `zepai/graphiti:0.22.0` + Neo4j Community | Existing free backend is Neo4j, not FalkorDB; no duplicate installation |

Evidence boundary:

- Direct local evidence confirms the checked-out adapter consumes `GRAPHITI_MODE`,
  `GRAPHITI_BASE_URL`, `GRAPHITI_API_KEY` and `GRAPHITI_TIMEOUT_MS`, and fails closed
  to `NullKnowledgeGraph` when mode/configuration is invalid.
- VPS runbooks document the existing sidecar, private network, Infisical names and
  `prod` environment. They do not prove a current live Maestri round-trip.
- The local Infisical wrapper is present but returned no version/help/session output;
  no secret value was read or printed. A live names-only query therefore remains
  pending VPS/Infisical access, not a reason to install another CLI.

Task 1 decision: **RECONCILED / LIVE ROUND-TRIP PENDING**. Graphiti remains `OFF`
by default and no real tenant flag is changed.

## Guard

The package exposes:

```powershell
pnpm --dir packages/maestri-context-gateway run check:rollout
```

The guard returns `READY_FOR_VPS` only when the current branch is `vps`, the target is `vps`, production mode is disabled, and the worktree is clean. Any other state returns `BLOCKED` with deterministic blockers.

The unit test covers the allowed state and the three safety classes: wrong branch/target, production mode, and dirty worktree.

## F25 conclusion

The local rollout safety gate is implemented. F25 remains open for external configuration and compatibility cleanup: official provider quota sources, Graphiti endpoint/credentials, optional OTLP collector, real GitHub Actions/MCP configuration, and a controlled rollout on `vps`. No merge to `main` and no production deployment are authorized by this gate.

The local Graphiti gate is now closed safely: `createKnowledgeGraphFromEnv()` defaults to `NullKnowledgeGraph`, fails closed for incomplete `on`/`shadow` configuration, and the Core `/graph` endpoint remains read-only with an empty result when the provider is off.

## Official-source constraints

- The official GitHub MCP Server supports a native stdio binary or PAT/OAuth; the Docker path is explicitly excluded here because Docker is not installed.
- Codex Action requires a provider API secret in GitHub Actions; Jules Action requires `JULES_API_KEY`. No secrets are created automatically, so those workflows remain unconfigured until the owner supplies names, scope, and environment.
- The two workflow files are intentionally manual and `vps`-guarded. Official `actionlint v1.7.12` and static safety checks passed; `gh aw validate` is not applicable because these are standard YAML workflows and the repository has no Agentic Workflow Markdown source files. No workflow was dispatched.
- Remote metadata was read-only except for the explicitly authorized `JULES_API_KEY` secret write: repository `trydavidqix/Lumenva` has default branch `main`; the value was copied from Google Secret Manager without being printed; local `vps` changes were not pushed.
