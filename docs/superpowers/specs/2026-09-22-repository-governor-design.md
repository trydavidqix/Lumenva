# Repository Governor — Design Spec

**Status:** design approved in conversation; awaiting written-spec review before detailed implementation planning.
**Repository:** `trydavidqix/Lumenva`
**Target branch:** `vps`; never merge to `main` as part of this planning task.

## Purpose

Prevent architectural duplication and unsafe repository changes from reaching `main` by adding deterministic repository-specific checks to the existing GitHub Actions CI. The Governor supplements existing checks; it does not reimplement typecheck, lint, or test suites.

## Current verified baseline

- Root package manager is pnpm `9.15.9`; the repository is a pnpm monorepo with applications and packages.
- `.github/workflows/ci.yml` runs on pull requests and already executes typecheck, lint, harness checks, unit tests, shell tests, and database invariants.
- Existing migration policy is scoped to CRM and its baseline coverage; repository-wide migration governance is not established.
- `dependency-cruiser` and a Repository Governor implementation/configuration were not found in the audited worktree.
- GitHub API returned no repository rulesets. `main` branch protection has `strict=true`, `allow_force_pushes=false`, `enforce_admins=true`, but `required_status_checks.checks=[]` and `contexts=[]`. Therefore CI runs but no status check is currently required for merge.
- GitHub MCP's governance toolset exists, but current local integration is configured read-only. It is not a CI enforcement mechanism and stays read-only in this scope.

## Design

### Canonical architecture manifest

Add a small, reviewable manifest of canonical subsystems, owning paths, permitted aliases/legacy paths, and ownership. Do not infer duplication from directory names alone. A newly claimed canonical subsystem or ownership change requires human review through the repository's normal PR process.

### Deterministic Governor checks

The Governor is a local Node-based validator invoked by the existing CI workflow. It emits a stable PASS/FAIL report and nonzero exit status on configured blocking violations. Initial checks cover:

1. Manifest syntax, uniqueness, path existence, and conflicting canonical ownership.
2. Explicit architecture boundary rules; evaluate Dependency Cruiser only after inventorying real layers and known legacy violations. New rules must not make unrelated legacy debt fail without a migration/baseline strategy.
3. Documentation obligations mapped to changed path classes, with explicit exemptions.
4. Migration checks routed to the owning subsystem's existing policy; do not replace CRM policy or assume all migrations share one format.
5. A concise CI summary that links each failure to the violated rule and changed path.

Existing typecheck, lint, tests, security scans, and other CI jobs remain authoritative for their own domains. Governor must not duplicate or reinterpret their results.

### Branch freshness and GitHub enforcement

Do not create arbitrary stale-branch age or commit-count thresholds for MVP. Use GitHub's strict up-to-date requirement once named checks are configured as required. First establish the exact check names from successful PR runs, then separately propose/configure required checks and a PR requirement for `main`. GitHub settings changes are an external administrative action and are not part of local implementation without a separately approved rollout step.

### Optional integrations excluded from MVP

- GitHub MCP governance: read-only inspection only; no ruleset writes from agents.
- No Mergify, Codacy, PR-comment bot, merge queue, or branch-abandonment automation in MVP. Reassess only if measurable gaps remain after the native GitHub and CI gates operate.

## Failure and security behavior

- Missing or malformed manifest fails closed with a precise diagnostic.
- Unknown path categories are reported and fail only when the policy explicitly marks them blocking; avoid broad glob assumptions.
- Pull request code is treated as untrusted. The check runs with read-only repository permissions, no secrets, and no write-capable token. Do not execute changed scripts as a governance shortcut.
- Network/API availability is not required for the deterministic local Governor checks.
- If a rule cannot determine ownership or policy, report an explicit failure requiring a manifest/policy decision; do not silently pass.

## Acceptance criteria

- Repeated runs on the same tree produce deterministic output and exit status.
- Tests cover valid, invalid, duplicate, legacy-exempt, path traversal, and unknown-path cases.
- Existing CI jobs remain unchanged in meaning and continue to run.
- A representative PR with a forbidden dependency, missing required documentation, or invalid migration metadata fails the Governor with an actionable reason.
- A representative PR touching an approved legacy path passes without suppressing newly introduced violations elsewhere.
- GitHub branch protection is not reported as complete until API/UI state confirms the intended named checks are required and a test PR demonstrates enforcement.

## Scope boundaries

This is repository governance for the Lumenva monorepo, not a Maestri runtime governor, provider router, CRM feature, or general code-quality vendor evaluation. Implementation remains unstarted. The detailed task-by-task implementation plan is a separate artifact after this written spec is reviewed and approved.
