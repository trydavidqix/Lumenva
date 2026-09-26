---
name: orchestration
description: Use for classifying code/config/harness work, routing providers, collecting same-HEAD evidence, checking orchestration state, or explaining a governance block. Lazy-load only when a task needs provider routing or completion evidence.
---

# Orchestration workflow

1. Read `docs/engineering/AGENT_GOVERNANCE.md` and the applicable repository rules.
2. For a relevant change, run `node tooling/agent-governance/gate.mjs begin --kind code --summary "..."` before the first mutation. Use `--kind small` only for a bounded isolated change. Use `--kind docs-only` only when the documentation has no operational effect.
3. Follow the printed executor/reviewer assignment. Never report an unavailable provider as dispatched. Codex Cloud without `CODEX_CLOUD_ENV_ID` must remain `CONFIG_REQUIRED`.
4. Import only observed provider evidence with `record`; every receipt must match run ID, role, branch, and current HEAD. Never author a fake receipt.
5. Require green GitHub Actions evidence at that same SHA. Run `complete`; resolve every reported blocker. Any new commit requires a fresh run and fresh evidence.
