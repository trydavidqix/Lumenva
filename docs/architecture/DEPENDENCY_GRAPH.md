# DEPENDENCY_GRAPH — Phase 0 Business OS

Audit date: 2026-09-11
Authority: `~/master-blueprint-IMPLEMENTAVEL.md`, PHASE 0 and §17/Part F. The blueprint also contains a conflicting later §9 Phase 0→Wave 15 table; this audit follows §17/Part F because it is the requested section and records the conflict instead of silently choosing a new scope.
Current-state evidence: `~/src/Lumenva` at `business-os/phase-0-audit@f86d32a0`.

## Global order

`PHASE 0 AUDIT → WAVE 1 OPERATING CORE → WAVE 2 AGENT BIRTH → WAVE 3 SESSION RUNTIME → WAVE 4 BROWSERMESH/SHIFT → WAVE 5 COMMAND CENTER → WAVE 6 STUDIO → WAVE 7 EDITOR → WAVE 8 ASSETS → WAVE 9 PRODUCT FACTORY → WAVE 10 DELIVERY → WAVE 11 INTEGRATIONS → WAVE 12 MARKETING/VIDEO → WAVE 13 HERMES/ADVANCED MEMORY → WAVE 14 EVALS/AGENT EVOLUTION → WAVE 15 AUTONOMY/OPTIMIZATION`

The brackets indicate authorized parallel preparation only where the blueprint explicitly permits it. Phase 0 is sequential and creates no structural module.

## Waves 1–15

| Wave | Scope from blueprint | Direct dependencies | Real repo surfaces to reuse/audit | Exit dependency |
|---|---|---|---|---|
| 1 | Operating Core: jobs, events, evidence, policy, approvals, core contracts, MCP/CLI | Phase 0 | `apps/crm/lib/event-log/`, `apps/crm/lib/mcp/`, `apps/crm/app/api/v1/cron/`, `workers/` | W2 and W3 require job/event/evidence/state contracts |
| 2 | Agent Birth, source provenance, prompt compiler, skills/tools, certification | W1 | `apps/crm/lib/agent-engine/agent/`, `apps/crm/lib/ai/prompts/`, `apps/crm/lib/ai/skills/`, `apps/crm/lib/mcp/tools/` | W3 requires compiled identity, tools and policies |
| 3 | Session-aware runtime, context, memory, model lock, handoff, quotas, health/circuit | W1–W2 | `apps/crm/lib/agent-engine/`, `apps/crm/lib/ai/runtime/`, `apps/crm/lib/ai/handoff/`, `apps/crm/lib/voice/` | W4 and W5 require session/evidence/health contracts |
| 4 | BrowserMesh, worker lifecycle, Shift OS, adapters and evidence | W1, W3 | `workers/`, `docs/handoffs/`, `docs/runbooks/` | W5 and W6 require execution/evidence/health proof |
| 5 | Command Center routes, read-first chat, MCP/CLI equivalence | W1–W4 | `apps/crm/app/`, `apps/crm/app/api/mcp/`, `apps/crm/lib/mcp/`, `apps/crm/lib/navigation/` | W6+ require operator surface and approval path |
| 6 | Studio commercial MVP, ProjectSpec, templates, preview, portal | W1, W2, W5 | `apps/crm/app/`, `apps/site/`, `docs/design-system/` | W7 editor and W9 factory depend on ProjectSpec |
| 7 | Studio editor/canvas, inspector, patches, undo/redo | W6 | No canonical `packages/studio-canvas/` found; reuse current UI conventions | W8 depends on stable canvas/spec patches |
| 8 | Asset intelligence, OCR/vector/layers/reverse design, visual diff | W7 | `apps/crm/lib/content-os/`, media surfaces, `workers/` | W9 requires asset provenance and render evidence |
| 9 | Product Factory web: architect, generators, Git factory, QA/repair | W2, W6–W8 | `apps/crm/lib/`, `workers/`, `scripts/`; no canonical `packages/project-generator/` found | W10 requires generated release/deployment contracts |
| 10 | Mobile and production delivery, domains, monitoring, release/rollback, DR | W9, W4 | `ops/`, `docker/`, `docs/runbooks/`, `.github/` | W15 requires production/rollback evidence |
| 11 | Unified integrations: WhatsApp, Instagram, Facebook, email, voice, Google | W1, W2, W5 | `apps/crm/lib/channels/`, `apps/crm/lib/email/`, `apps/crm/lib/voice/`, `apps/crm/lib/nuvemshop/` | W12 requires provider boundary/security evidence |
| 12 | Marketing + Video: CMO/research/content/SEO/creative/community/analytics and deterministic video pipeline | W11 | `apps/crm/lib/content-os/`, `apps/crm/lib/content-os/providers/video-composer/`, `workers/` | W13 requires content/video provenance and export evidence |
| 13 | Hermes + Advanced Memory: semantic/episodic/procedural/operational memory, knowledge graph and governed learning candidates | W12 | `apps/crm/lib/agent-engine/memory/`, `apps/crm/lib/agent-engine/customer-memory/`, `apps/crm/lib/agent-engine/` | W14 requires memory provenance and candidate governance |
| 14 | Evals + Agent Evolution: regression, cross-model qualification, behavior fingerprints and governed promotion | W13 | `apps/crm/lib/agent-engine/evals/`, `apps/crm/lib/agent-engine/obs/`, `docs/specs/10-spec-ai-agents-runtime.md` | W15 requires evaluation and promotion evidence |
| 15 | Autonomy + Optimization: cost/free-first/workforce/host/quota prediction and progressive autonomy under governed promotion | W14 | `apps/crm/lib/agent-engine/`, `apps/crm/app/api/v1/metrics/`, `evidence/`, `docs/DEPLOY-CHECKLIST.md` | Final owner approval only; no self-modification reaches production |

## Authorized parallelism and hard stops

- Phase 0 is sequential; no structural module may start before this audit gate.
- W1 → W2 → W3 is a hard dependency chain.
- W5 may prepare in parallel with W4 only after W1–W3 contracts exist.
- W6 depends on the core and W5; W7 → W8 is sequential.
- W9 may prepare after W6, but final generation depends on W7–W8 evidence.
- W11 may split provider adapters after W2, but provider docs, sandbox and owner approval remain prerequisites.
- W12–W15 remain sequential gates; they are not shortcuts around missing earlier waves. Security, observability, rollback and LGPD remain cross-cutting acceptance requirements even where §17 names a different primary capability.
- Every wave requires current-SHA evidence, tests, risk update, cost/rollback proof and owner acceptance.
