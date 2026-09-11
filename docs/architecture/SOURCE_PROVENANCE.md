# SOURCE_PROVENANCE — Phase 0 Business OS

Audit date: 2026-09-11
Audited checkout: `~/src/Lumenva`, branch `business-os/phase-0-audit` at `f86d32a0`
Authority: `~/master-blueprint-IMPLEMENTAVEL.md`, top-level plus `PHASE 0` and §17.

## Provenance rules

`BLUEPRINT` is the owner-approved target and sequencing authority. `REPO` is evidence of what exists in the audited checkout. `OFFICIAL` means official runtime/provider documentation referenced by the repository. `OWNER` means a decision explicitly attributed to the blueprint owner. `INFERENCE` is an audit conclusion derived from the preceding sources and is not itself an approved architecture decision.

## Decision and claim register

| Decision/claim | Classification | Origin | Evidence path | Audit status |
|---|---|---|---|---|
| Business OS is organized into control, intelligence, orchestration, execution, business operation, product delivery and infrastructure planes | target architecture | OWNER + BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:20-45` | CONFIRMED source; target not yet implemented as one platform |
| CRM is the control plane and Postgres is operational source of truth | doctrine | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:2.6-2.10` | CONFIRMED as target rule; current repo has `apps/crm` and Supabase assets |
| Tenant identity is `organization_id`; RLS is mandatory | security invariant | BLUEPRINT + REPO | `~/master-blueprint-IMPLEMENTAVEL.md:2.16`; `docs/specs/01-spec-platform-base.md`; `supabase/migrations/` | CONFIRMED doctrine; implementation is distributed across migrations/policies |
| Existing event substrate must be reused, not replaced by Kafka/NATS | architecture decision | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:GROUND RULES 0.1`; `docs/specs/07-spec-events-workers.md` | CONFIRMED target; `apps/crm/lib/event-log` exists |
| Phase 0 creates documentation and audit artifacts, not structural code | phase gate | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:PHASE 0` and `PHASE 0 — Canonical Audit` | CONFIRMED; this delivery changes docs only |
| Required Phase 0 artifacts include source provenance, risk and dependency maps | deliverable | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:613-618`, `7440-7448` | CONFIRMED; this delivery supplies the three requested artifacts |
| Wave 1 is the operating-core substrate: jobs, events, evidence, policy, approvals and core contracts | sequencing | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:WAVE 1`, `9779-9781` | CONFIRMED target; no `packages/` root exists in audited repo |
| Wave 2 depends on Wave 1 and owns Agent Birth, prompt compilation, skills and tools | sequencing | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:WAVE 2`, `9779-9782` | CONFIRMED target |
| Wave 3 depends on Waves 1–2 and owns session-aware runtime, routing, memory and handoff | sequencing | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:WAVE 3`, `9779-9783` | CONFIRMED target; current agent runtime is under `apps/crm/lib/agent-engine`, not canonical `packages/agent-runtime` |
| BrowserMesh/Shift precede Command Center | sequencing | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:WAVE 4-5`, `9779-9785` | CONFIRMED target |
| Studio, editor, assets, Product Factory and delivery are ordered Waves 6–10 | sequencing | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:WAVE 6-10`, `9779-9789` | CONFIRMED target; current repo has CRM/site surfaces but no audited canonical `packages/studio-*` tree |
| Unified integrations, Marketing/Video, Hermes/Advanced Memory, Evals/Agent Evolution and Autonomy/Optimization are Waves 11–15 | sequencing | BLUEPRINT | `~/master-blueprint-IMPLEMENTAVEL.md:WAVE 11-15`, §17/Part F lines 677-689 and 7518-7524 | CONFIRMED target for this audit; later §9 table uses a conflicting governance/observability/business-ops sequence and remains OWNER_REQUIRED to reconcile |
| Documentation precedence is CLAUDE.md > docs/specs > docs/prd > HANDOFF > README | repository documentation rule | REPO | `docs/index.md:12-15` | CONFIRMED repository rule |
| Current repo has mature CRM, audit, event-log, agent-engine, voice, LGPD and provider integrations | current capability | REPO | `apps/crm/lib/`, `apps/crm/app/api/`, `supabase/`, `workers/`, `docs/current-state.md` | CONFIRMED by path inventory; completeness varies per module |
| Current production/runtime claims in `docs/current-state.md` are historical snapshots, not Phase 0 target proof | evidence boundary | REPO + INFERENCE | `docs/current-state.md` front matter and audit warning | INFERRED; must be reverified before release claims |
| `packages/` canonical Business OS package tree is absent in the audited root | gap | REPO | `find packages` returned no directory; blueprint §0.1/§17 lists packages by Wave | CONFIRMED gap, not permission to create code in Phase 0 |

## Source classes still required before later waves

- `OFFICIAL`: provider/runtime docs must be indexed per blueprint before provider adapters are built; no provider was selected by this Phase 0 audit.
- `OWNER`: unresolved product/operational choices must be recorded with the owner and not upgraded from `INFERENCE`.
- `REPO`: every later capability claim must include a real path, commit and verification result.

## Explicit non-decisions

This audit does not select Telnyx, SIP, Pipecat, a model provider, a memory provider, a deployment target, or a package implementation strategy. Those choices remain `UNKNOWN` or `OWNER_REQUIRED` until their declared wave and source review.

## Blueprint discrepancy requiring owner resolution

`§17/Part F` defines Waves 12–15 as Marketing/Video, Hermes/Advanced Memory, Evals/Agent Evolution and Autonomy/Optimization. The later `§9 Phase 0 → Wave 15` table lists Governance/Security, Observability/Reliability, Business Operations and Integrated Acceptance instead. This delivery follows §17/Part F because that section is in scope, records the conflict explicitly, and does not treat either sequence as an implementation authorization.
