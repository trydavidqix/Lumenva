# Business OS — Migration Plan (Waves 1–15)

Base: `business-os/phase-0-audit` @ `e45bdc4f`. This plan follows blueprint §17 and Part F, with the actual Lumenva paths from `GAP_ANALYSIS.md`. No structural code is created in Phase 0.

## Rules

- `REUSE` existing behavior and tests; `EXTEND` stable seams; `REFACTOR` only behind compatibility tests; `CREATE` only at the wave where the blueprint first needs it; `DEPRECATE` only after replacement evidence.
- Each wave has an owner, dependency gate, migration boundary and rollback/read-back evidence before the next wave.
- New schema is additive and tenant/RLS-safe. Existing migrations remain immutable.
- Provider/live actions are separate owner-gated work, never hidden inside a provider-free wave.

## Waves

| Wave | Blueprint scope | Classification and real paths | Deliverable / gate |
|---|---|---|---|
| 1 | Operating Core | `EXTEND` `apps/crm/lib/agent-engine/{contracts,kernel,queue,execution}`; `CREATE` `packages/shared`, policy/approval/evidence facades, dispatcher/scheduler workers; `REUSE` `apps/crm/lib/mcp` | Job state machine, event/evidence envelope, policy/approval contracts, MCP/CLI parity tests, tenant/RLS migration set. |
| 2 | Agent Birth + Prompt Compiler | `REUSE` agent contracts/product agents and docs; `CREATE` `packages/agent-factory`, `packages/prompt-compiler`, skill/tool registries; `EXTEND` `.claude/skills`, `.agents/skills` | Documentation intake + provenance report, deterministic compiled prompt hash, certification gate before publishing. |
| 3 | Session-aware Runtime MVP | `REFACTOR` current kernel/context/execution/memory/handoff behind `packages/agent-runtime`; `CREATE` `packages/model-router`; `REUSE` Mock/Gemini/Groq-compatible adapters where present | Session state/snapshot/epoch, context budget, handoff continuity, quota/health/circuit breaker and tool idempotency tests. |
| 4 | BrowserMesh + Shift OS | `EXTEND` current edge/resource/pacing code; `CREATE` `runtimes/browsermesh` integration and `packages/shift-os`; `REUSE` separate `~/src/BrowserMesh` | CRM job→BrowserMesh→evidence round trip; node/lease/heartbeat and rollback evidence. |
| 5 | Command Center | `CREATE` `apps/crm/app/command/`; `EXTEND` current admin/settings/inbox/agent surfaces; `REUSE` MCP/API contracts | READ-first operator views, then approved actions; UI/MCP/CLI authorization and idempotency equivalence. |
| 6 | Studio Commercial MVP | `EXTEND` existing `apps/crm/app/studio/`, creative/video services; `CREATE` studio-spec/templates/components/renderer and client portal seams | ProjectSpec versioning, preview, A/B/C and client approval event with evidence. |
| 7 | Studio Editor | `CREATE` `packages/studio-canvas`; `REUSE` ProjectSpec from Wave 6 | Stable patch IDs, undo/redo, responsive edits and deterministic replay tests. |
| 8 | Asset Intelligence | `CREATE` `packages/asset-engine`; `EXTEND` `services/video-composer`, media routes; `CREATE/EXTEND` BrowserMesh ffmpeg/remotion adapters | Layer manifest, OCR/vector/segmentation contracts, visual diff and artifact retention policy. |
| 9 | Product Factory Web | `CREATE` `packages/project-generator`, release manifest, `integrations/cloudflare`, `integrations/neon`, deploy worker; `REUSE` current deploy docs/scripts | Approved ProjectSpec→repo→QA→preview; resource metadata tenant-safe; no production deploy without approval. |
| 10 | Mobile + Delivery | `CREATE` mobile generator and `integrations/vercel`; `EXTEND` deploy runbooks/health probes | Mobile artifact, release/maintenance records, project health polling and rollback read-back. |
| 11 | Unified Integrations | `EXTEND` `apps/crm/lib/waha`, voice, ecommerce and webhook routes; `CREATE` canonical `packages/integrations`, Google/Meta adapters and integration worker | Normalized conversation/message/participant contract, webhook retry/idempotency tests, sandbox/provider gates separate. |
| 12 | Marketing + Video | `EXTEND` Content OS and `services/video-composer`; `CREATE` marketing worker/asset extensions; `REUSE` BrowserMesh heavy jobs | Script→storyboard→assets→voice→captions→render→QA→export evidence chain. |
| 13 | Hermes + Advanced Memory | `EXTEND` current Mem0/Graphiti/customer memory adapters; `CREATE` advanced `packages/memory`, Hermes adapter, memory worker | Semantic/episodic/procedural/operational memory with governed learning candidates; no auto-promotion. |
| 14 | Evals + Agent Evolution | `EXTEND` `apps/crm/lib/agent-engine/evals`, golden/benchmark suites; `CREATE/EXTEND` agent-evals/eval-worker | Cross-model qualification, behavior fingerprints, security/prompt regression and candidate→shadow→approved→active flow. |
| 15 | Autonomy + Optimization | `EXTEND` autonomy, budgets, pacing and model routing; `CREATE` workforce/host/quota prediction seams | Free-first routing, progressive autonomy and cost controls; self-improvement remains governed and cannot self-promote. |

## Dependency and rollback gates

1. Waves 1–3 require tenant/RLS, idempotency, evidence and state-reducer proofs before any agent migration.
2. Wave 4 requires a separate BrowserMesh evidence boundary; failure rolls jobs back to queued/blocked, not silent success.
3. Waves 5–8 require UI/API contract parity and artifact retention checks.
4. Waves 9–12 require release manifest, health/readiness and provider sandbox evidence; production credentials stay owner-controlled.
5. Waves 13–15 require governance/eval evidence; candidate memory/prompts/policies never become active without approval.

## Phase-0 backlog generated by this plan

- Create the remaining blueprint intake deliverables (`CURRENT_ARCHITECTURE`, `CAPABILITY_MAP`, `DOCUMENTATION_INTAKE`, `SOURCE_PROVENANCE`, `RISK_REGISTER`, `DEPENDENCY_GRAPH`, ADR candidates) before Wave 1 code.
- Assign an owner and acceptance test to every `PARTIAL`, `MISSING` and `UNKNOWN` row in `GAP_ANALYSIS.md`.
- Verify the separate BrowserMesh repository and provider documentation with dated evidence before Wave 4/11.
- Keep the existing CRM as compatibility surface until replacement contracts have passing equivalence tests; then deprecate paths explicitly.

