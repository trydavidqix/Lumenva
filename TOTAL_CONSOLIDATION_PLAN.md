# Lumenva Total Consolidation — Execution Plan

**Status:** IN_PROGRESS  
**Repository:** `trydavidqix/Lumenva`  
**Production base:** `main` at `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`  
**Integration branch:** `integration/lumenva-complete`  
**Integration starting point:** `consolidation/lumenva-main-2026-09-27` at `f46cdd4ddd2c4edc6ec57f266e97e8cb9f6a83ac`  
**Frozen source set:** 63 remote branches from GitHub API on 2026-09-29, recorded in [BRANCH_RECONCILIATION_MANIFEST.md](BRANCH_RECONCILIATION_MANIFEST.md). Newly created `integration/lumenva-complete` is not part of those 63 source branches.

## Goal

Keep `main` stable. Make `integration/lumenva-complete` the canonical superset of all useful production-ready, partial, experimental, and documentation work from the 63 frozen sources. Preserve every ref until final reconciliation and explicit Owner approval.

## Classification

- **PRODUCTION_READY:** implementation has evidence of working behavior and suitable checks.
- **EXPERIMENTAL:** useful exploration, prototype, or unpromoted work; retain visibly non-production.
- **PARTIAL:** useful incomplete slice; retain with missing pieces and dependencies named.
- **DUPLICATE:** equivalent content already represented; cite target commit/path.
- **OBSOLETE:** no longer useful in current architecture; cite replacement/reason.
- **NEXUS_OUT_OF_SCOPE:** Maestri/MCG/runtime capability owned by Nexus; preserve only where useful to document the boundary or migration.
- **UNRESOLVED:** evidence insufficient; preserve and do not discard.

Each branch may contain multiple classes. Record decisions at commit/path or capability level, not only whole-branch level. Never infer disposition from branch name alone.

## Work sequence

1. **Freeze and archive baseline — COMPLETE:** 63 exact refs/SHAs captured. Verified bundle covers all 63 frozen branch tips (0 missing, 0 mismatched); path/hash are in the manifest.
2. **Parallel branch audit — IN PROGRESS:** four auditors cover disjoint groups (16, 16, 16, 15); independent archaeology reviews cross-branch feature coverage. All are read-only.
3. **Build reconciliation matrix — TODO:** merge audit findings; reconcile overlapping/contradictory claims; every decision cites commit and path/diff evidence.
4. **Port approved work — TODO:** create isolated worktrees for backend/database/security, frontend/Command Center, and voice/providers/infra. Only Orchestrator integrates approved minimal changes to `integration/lumenva-complete`.
5. **Wave validation — TODO:** GitHub Actions only for repo:check, lint, typecheck, build, unit/invariants/security and E2E parity. Compare to `main`; distinguish preexisting failures from new regressions.
6. **Independent final audit — TODO:** re-check all 63 frozen tips against final integration. Require 63/63 dispositions and zero useful work missing.
7. **Preservation gate — TODO:** final bundle verified; manifest includes original SHA, class, decision, preserved destination commit/path; integration remote sync verified.
8. **Owner review — WAITING FOR FINAL REPORT:** present complete report and request explicit authorization before deleting any branch. No branch deletion is authorized before that approval.

## Agent assignments

- **Agent 0 — Orchestrator:** root session; owns inventory, matrix, conflicts, integration branch, validation coordination, final report.
- **Agents 1–4 — Branch auditors:** disjoint frozen inventory groups, read-only.
- **Agent 5 — Code archaeology:** cross-branch capability gaps, read-only.
- **Agents 6–8 — Integrators:** not started; wait for approved audit findings and use isolated worktrees with disjoint scopes.
- **Agent 9 — Validation:** not started; runs remote Actions after each integration wave.
- **Agent 10 — Final audit:** not started; independent review after all approved work is ported.

No agent may create child agents, delete branches, merge a whole branch blindly, or push to `main`. Only the Orchestrator integrates into `integration/lumenva-complete`.

## Current checkpoint

- New integration branch was created and pushed at the exact PR #75 head, without changing `main` or merging PR #75.
- No source branch has been integrated or deleted yet.
- PR #75 remains open. Its latest checks were green before this task.
- Temporary spawn permission is task-scoped and will be restored after spawning the assigned auditors.

## Preliminary cross-branch archaeology (not a final disposition)

Independent read-only review compared the frozen trees with the integration starting tree `f46cdd4` and production `main` `3fbe74a`:

- Voice core paths (`apps/crm/lib/voice/**`) and the real-call evidence are already represented; do not port the whole `voz` or `vps` branch on that basis alone.
- Candidate useful partial content is absent: `ops/voice-asterisk/**` from frozen `voz` `c40cc4e` and `vps` `d04568d`, plus `.github/workflows/mcg.yml` from `TOKENS` `3de6694` / `lumenva-local-runtime` `339a19b`. Inspect each artifact for credentials, activation defaults, consumers and compatibility before deciding or porting.
- `vps-17455632840955604138` includes the `vps` content; it is not an independent voice implementation.
- Command Center branches include planning/runtime changes whose standalone ownership and integration are not established by path presence. Keep them unresolved until the branch auditors supply commit-level evidence.
- The frozen object for `feat/maestri-engineering-council` was unavailable to this checkout during archaeology. Preserve as unresolved; do not infer from its `-clean` sibling.

These are leads only. Branch rows remain pending until the four auditors reconcile the full commit/path evidence. No implementation has been ported from these leads.
