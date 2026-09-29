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
2. **Parallel branch audit — FIRST PASS COMPLETE:** four auditors returned disjoint reports covering 16, 16, 16, and 15 refs; independent archaeology reviewed cross-branch capability coverage. The consolidated provisional findings are in [BRANCH_AUDIT_SUMMARY.md](BRANCH_AUDIT_SUMMARY.md). Root reconciliation remains in progress; no branch disposition is final until its target evidence is checked.
3. **Build reconciliation matrix — IN PROGRESS:** four branch auditors and code archaeology returned first-pass reports. Root is reconciling overlapping claims, tree moves, PR evidence, and source-only deltas; every final decision must cite commit and path/diff evidence.
4. **Port approved work — IN PROGRESS:** Agents 6–8 reviewed backend/security, Command Center/runtime, and voice/infra in isolated worktrees. Root integrated only the selected experimental runtime/Command Center files and non-wired WAHA adapter (five commits, current local candidate `eb532b8f`). The backend review found no clearly missing permitted slice. More candidate documentation/config deltas remain under review.
5. **Wave validation — IN PROGRESS:** baseline run `36529426649` on starting candidate `f75d0121` passed `verify` and `invariants`. This does not validate the newer wave. After pushing the reviewed candidate, run repo:check, lint, typecheck, build, unit/invariants/security and E2E parity through GitHub Actions only; classify preexisting versus candidate-only failures.
6. **Independent final audit — TODO:** re-check all 63 frozen tips against final integration. Require 63/63 dispositions and zero useful work missing.
7. **Preservation gate — TODO:** final bundle verified; manifest includes original SHA, class, decision, preserved destination commit/path; integration remote sync verified.
8. **Owner review — WAITING FOR FINAL REPORT:** present complete report and request explicit authorization before deleting any branch. No branch deletion is authorized before that approval.

## Agent assignments

- **Agent 0 — Orchestrator:** root session; owns inventory, matrix, conflicts, integration branch, validation coordination, final report.
- **Agents 1–4 — Branch auditors:** disjoint frozen inventory groups, read-only.
- **Agent 5 — Code archaeology:** cross-branch capability gaps, read-only.
- **Agents 6–8 — Integrators:** completed the first selected wave in three isolated worktrees; only Root integrated their scoped commits. Backend found no missing slice; Command Center/runtime remains experimental and awaits Actions; WAHA remains experimental, unconfigured and awaits Actions.
- **Agent 9 — Validation:** pending candidate push; runs remote Actions after integration wave.
- **Agent 10 — Final audit:** pending after all approved work is ported; independently verifies 63/63 destinations and zero useful work missing.

No agent may create child agents, delete branches, merge a whole branch blindly, or push to `main`. Only the Orchestrator integrates into `integration/lumenva-complete`.

## Current checkpoint

- New integration branch was created and pushed at the exact PR #75 head, without changing `main` or merging PR #75.
- No source branch has been integrated or deleted yet.
- PR #75 remains open. Its latest checks were green before this task.
- The temporary spawn permission has been restored to the original hook policy; the permit marker is absent and the configured hook hash matches its pre-task backup. `config.toml` was not changed.
- First-pass findings identify candidate CRM voice/notification, WAHA, runtime, MCG workflow, and governance slices; no code has been ported.

## Preliminary cross-branch archaeology (not a final disposition)

Independent read-only review compared the frozen trees with the integration starting tree `f46cdd4` and production `main` `3fbe74a`:

- Voice core paths (`apps/crm/lib/voice/**`) and the real-call evidence are already represented; do not port the whole `voz` or `vps` branch on that basis alone.
- Candidate useful partial content is absent: `ops/voice-asterisk/**` from frozen `voz` `c40cc4e` and `vps` `d04568d`, plus `.github/workflows/mcg.yml` from `TOKENS` `3de6694` / `lumenva-local-runtime` `339a19b`. Inspect each artifact for credentials, activation defaults, consumers and compatibility before deciding or porting.
- `vps-17455632840955604138` includes the `vps` content; it is not an independent voice implementation.
- Command Center branches include planning/runtime changes whose standalone ownership and integration are not established by path presence. Keep them unresolved until the branch auditors supply commit-level evidence.
- The frozen object for `feat/maestri-engineering-council` was unavailable to this checkout during archaeology. Preserve as unresolved; do not infer from its `-clean` sibling.

These are leads only. Branch rows remain pending until the four auditors reconcile the full commit/path evidence. No implementation has been ported from these leads.
