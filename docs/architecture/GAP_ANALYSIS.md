# Business OS — Gap Analysis (Phase 0)

Audit date: 2026-09-11  
Audit branch: `business-os/phase-0-audit` @ `e45bdc4f`  
Repository audited: `~/src/Lumenva` on worker Linux  
Blueprint source: `~/master-blueprint-IMPLEMENTAVEL.md`, top-level principles and §17/Part F.

## Method and status vocabulary

The audit maps blueprint components to real repository paths. `EXISTS` means a usable implementation is present; `PARTIAL` means a related implementation exists but the blueprint contract, scope, or evidence is incomplete; `MISSING` means no credible implementation path was found; `OBSOLETE` means a path or design is explicitly superseded; `UNKNOWN` means the repository alone cannot prove the claim and a runtime/provider or owner decision is required.

This is a read-only audit. Counts and code paths are evidence from the checkout; production claims are not inferred from names or documentation.

## Component matrix

| Blueprint component | Status | Evidence in repository | Gap / proof boundary |
|---|---|---|---|
| CRM control plane | PARTIAL | `apps/crm/app/`, `apps/crm/components/`, `apps/crm/lib/`, 203 route handlers recorded in `docs/current-state.md` | CRM surfaces exist, but the complete Command Center surface in blueprint §4.1 is not present as one coherent module. |
| Organization tenancy / RLS | EXISTS | `supabase/migrations/`, `apps/crm/lib/auth/`, `apps/crm/lib/supabase/`, `organization_id` filters and RLS tests | Full cross-surface isolation still needs a single Phase-0 evidence index. |
| Operating Core: jobs | PARTIAL | `apps/crm/lib/agent-engine/queue/`, `apps/crm/lib/agent-engine/kernel/`, `apps/crm/lib/agent-engine/execution/` | No canonical `packages/` Job Engine with the blueprint queued→claimed→running→completed evidence contract. |
| Event contracts | PARTIAL | `apps/crm/lib/events/`, `apps/crm/lib/agent-engine/`, `event_log` migrations | Existing events are distributed; canonical versioned envelope and cross-plane registry are not demonstrated. |
| Evidence Engine | PARTIAL | `docs/evidence/`, `apps/crm/lib/agent-engine/obs/`, audit/event tables in migrations | Evidence artifacts exist, but no canonical `EvidenceItem/EvidenceBundle` package and no universal trace contract. |
| Policy Engine | PARTIAL | `apps/crm/lib/agent-engine/policies/`, `apps/crm/lib/agent-engine/autonomy/`, auth role guards | Runtime policies exist, but blueprint-wide actor/action policy package and approval integration are not unified. |
| Approval Engine | PARTIAL | `apps/crm/app/api/v1/approvals/`, approval migrations and UI routes | Approval flows exist in CRM; canonical reusable engine and MCP/CLI equivalence are not proven. |
| AgentDefinition / contracts | PARTIAL | `apps/crm/lib/agent-engine/contracts/`, `apps/crm/lib/agent-engine/agent/` | Several contracts exist; blueprint's complete identity/authority/autonomy/version bundle is distributed and not yet canonical. |
| MCP server + `lumenva` CLI | PARTIAL | `apps/crm/lib/mcp/`, `apps/crm/lib/mcp/tools/` | MCP tools exist; a first-class CLI sharing the same API, policy, idempotency and evidence was not found. |
| Agent Birth System | PARTIAL | `apps/crm/lib/agent-engine/product-agents/`, `apps/crm/lib/ai/agents/`, prompt and eval docs | Agent definitions and product agents exist, but the mandatory request→provenance→compile→certify→publish pipeline is incomplete. |
| Documentation Intake | PARTIAL | `docs/`, `docs/handoffs/`, `docs/audits/` | Many audits exist; no canonical `DocumentationIntakeReport` artifact for every agent. |
| Source Provenance | PARTIAL | `docs/audits/`, `docs/research/`, provider references | Provenance is documented ad hoc, not stored/versioned as a reusable map attached to AgentDefinition. |
| Prompt Compiler / versioning | PARTIAL | `apps/crm/lib/agent-engine/`, prompt-related docs and tests | Prompt composition exists in runtime code; blueprint hash/version/compiler artifact contract is not complete. |
| Skill Registry / progressive disclosure | PARTIAL | `.claude/skills/`, `.agents/skills/`, `apps/crm/lib/agent-engine/agent/` | Skills exist in filesystem and runtime references; registry/search/loader/version persistence is not canonical. |
| Tool Registry / capability discovery | PARTIAL | `apps/crm/lib/mcp/tools/`, `apps/crm/lib/agent-engine/tools/`, `apps/crm/lib/agent-engine/edge/` | Tool implementations exist; searchable registry with policy-filtered schemas is not a single package. |
| Session-aware runtime | PARTIAL | `apps/crm/lib/agent-engine/context/`, `kernel/`, `memory/`, `execution/`, `health/` | Runtime pieces are substantial; blueprint SessionService/Event/Snapshot/Epoch/Continuity bundle is not one canonical boundary. |
| Model Registry / Model Router | PARTIAL | `apps/crm/lib/agent-engine/models/`, `apps/crm/lib/ai/`, provider adapters | Model/provider code exists; blueprint lock, quota, drain and behavioral routing contract is incomplete. |
| Circuit breaker / Health Manager | PARTIAL | `apps/crm/lib/agent-engine/health/`, `apps/crm/lib/waha/health.ts`, health endpoints | Multiple local breakers/health checks exist; no cross-provider runtime HealthManager contract. |
| Memory / Customer Memory | PARTIAL | `apps/crm/lib/agent-engine/memory/`, `customer-memory/`, `docker/mem0/`, Graphiti docs | Memory integrations and flags exist; canonical durable memory package and governance flow are incomplete. |
| Handoff / continuity | PARTIAL | `apps/crm/lib/agent-engine/`, handoff tests/docs | Handoff contracts exist; universal HandoffPack and continuity validator across providers is not proven. |
| BrowserMesh execution plane | MISSING | References in docs and `apps/crm/lib/agent-engine/edge/`; no BrowserMesh repository under `~/src/Lumenva` | Blueprint maps BrowserMesh to a separate execution repository; local integration boundary is not implemented here. |
| Shift OS / Resource Router | PARTIAL | agent queue/pacing/resource references and docs | No canonical `packages/shift-os` planner/capacity/concurrency governor. |
| Command Center | PARTIAL | `apps/crm/app/command/` not present as a complete blueprint surface; admin/settings/inbox routes exist | Existing CRM/admin pages cover slices, not the full Overview/Jobs/Approvals/Incidents/Costs surface. |
| Studio Commercial MVP | PARTIAL | `apps/crm/app/studio/` and related docs/components | Some studio/product surfaces exist; ProjectSpec/template/preview/client portal acceptance chain is not complete. |
| Studio Editor / Canvas | MISSING | No canonical `packages/studio-canvas/` found | Blueprint Waves 7–8 capabilities are not present as the specified package boundary. |
| Asset Intelligence | PARTIAL | media/creative components and `services/video-composer/` | Media exists; OCR/vectorization/layers/reverse-design contract is not present as a governed asset engine. |
| Product Factory Web | PARTIAL | `services/`, generators/docs and deployment routes | Product delivery pieces exist, but canonical project-generator and release-manifest boundary is incomplete. |
| Mobile + Delivery | PARTIAL | deploy docs, Vercel/host scripts, no complete Expo generator | Delivery runbooks exist; mobile generator, release management and health polling are not complete. |
| Unified Business Integrations | PARTIAL | `apps/crm/lib/waha/`, `lib/voice/`, webhook routes, ecommerce adapters | WhatsApp/WAHA and voice slices exist; canonical integrations package across Meta/Google/email/calendar is incomplete. |
| Marketing + Video | PARTIAL | `services/video-composer/`, content-os code, marketing docs | Content/video paths exist; blueprint end-to-end CMO/research/asset/QA pipeline is not one contract. |
| Hermes / advanced memory | MISSING | Graphiti/Mem0 integrations and docs, no canonical Hermes package | Advanced governed memory/knowledge graph/learning promotion remains incomplete. |
| Evals / Agent Evolution | PARTIAL | `apps/crm/lib/agent-engine/evals/`, golden tests, benchmark code | Evals exist; continuous cross-model qualification and governed candidate promotion are incomplete. |
| Autonomy / optimization | PARTIAL | autonomy contracts, budgets, pacing and model routing | Local autonomy/budget controls exist; workforce/host/quota prediction and governed self-improvement are absent. |
| Infrastructure plane | PARTIAL | `docker/`, `supabase/`, `ops/`, `docs/runbooks/`, worker deployment paths | Operational infrastructure exists; canonical Business OS infra package and evidence graph are not unified. |
| Verification Engine | PARTIAL | tests, `docs/evidence/`, route and deployment checks | Verification is strong in local modules but not represented as a universal policy/evidence service. |
| Evidence / communication contracts | PARTIAL | handoffs, runbooks, evidence docs | Communication artifacts exist; machine-readable evidence lifecycle and task statuses are not universal. |

## Obsolete / unknown findings

- `docs/architecture/crm-vivo.architecture.json` is a **target plant**, not current-state proof; its own README says Waves 6–8 are ahead of code. Treating every card as `EXISTS` is **OBSOLETE reasoning**, not an obsolete file.
- Historical `DeskcommCRM`/rename references in archived docs are historical and must not be used as current architecture evidence.
- Provider/live readiness, BrowserMesh external repository state, production flags and external credentials are `UNKNOWN` from this repo-only audit unless a dated evidence artifact proves them.

## Exit-gate conclusion

The repository has substantial CRM, Agent OS, memory, WAHA, voice, LGPD and operational work, but it does not yet satisfy the blueprint's canonical package boundaries, birth pipeline, evidence engine, BrowserMesh integration, or complete 15-wave dependency graph. Phase 0 must therefore remain documentation-only until the target and migration plan below are accepted.

