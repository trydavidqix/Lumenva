---
type: open-loops
project: Lumenva
last_updated: 2026-09-10
audited_against: f1/baseline-pnpm-2026-09-09 @ e020cd6f4f4a8958e8e30ab9ab29e53494565f9c
---

# Open loops - baseline F1

- Format baseline: format=1686 ficheiros falham prettier check no baseline e020cd6f; propor chore(format) repo-wide como PR isolado antes de F8.
- Harness baseline: harness=17 findings; agendar task de governanca, nao F1. Paths DeskcommCRM e CLAUDE.md alimentam task Batismo.
  - .claude/rules/git-workflow.md: missing-rule
  - .claude/rules/security.md: missing-rule
  - .claude/rules/multi-tenancy.md: missing-rule
  - .claude/rules/api-contract.md: missing-rule
  - .claude/rules/audit-observability.md: missing-rule
  - .claude/rules/lgpd.md: missing-rule
  - .claude/rules/whatsapp-waha.md: missing-rule
  - .claude/rules/data-modeling.md: missing-rule
  - .claude/rules/database-migrations.md: missing-rule
  - .claude/rules/testing-verification.md: missing-rule
  - .claude/rules/documentation.md: missing-rule
  - .claude/rules/graphify.md: missing-rule
  - .claude/rules/skill-routing.md: missing-rule
  - .gitignore: rules-not-versionable
  - CLAUDE.md: missing-doctrine
  - .claude/skills/DeskcommCRM/SKILL.md: missing-repo-skill
  - .agents/skills/DeskcommCRM/SKILL.md: missing-repo-skill

Estes loops nao estao resolvidos. Cada encerramento exige prova reproduzivel, exit code, SHA e revisao.
