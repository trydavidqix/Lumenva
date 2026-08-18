---
type: devops-audit
title: VSCode Extensions Audit — Cleanup 2026-08-18
status: complete
date: 2026-08-18
---

# VSCode Extensions Audit & Cleanup

**Objective:** Remove non-relevant and duplicate VSCode extensions from development setup (next.js + TypeScript + Supabase + WAHA project).

---

## Removed (12 extensions)

### Non-Relevant (.NET/SQL focus, not TypeScript/Node)

| Extension | Reason |
|-----------|--------|
| `ms-dotnettools.vscode-dotnet-runtime` | .NET runtime — project is Node.js |
| `ms-mssql.mssql` | MSSQL IDE — project uses Supabase/Postgres |
| `ms-mssql.data-workspace-vscode` | MSSQL workspace — not relevant |
| `ms-mssql.sql-bindings-vscode` | MSSQL bindings — not relevant |
| `ms-mssql.sql-database-projects-vscode` | MSSQL projects — not relevant |
| `ms-azuretools.vscode-containers` | Azure containers — project doesn't use |
| `ms-azuretools.vscode-docker` | Generic Docker — handled elsewhere |
| `ms-vscode-remote.remote-containers` | Remote dev — not needed for this setup |
| `mtxr.sqltools` | SQL IDE tools — use Supabase UI instead |
| `vue.volar` | Vue.js — project is React/Next.js |

### Duplicate/Redundant

| Extension | Reason |
|-----------|--------|
| `saoudrizwan.claude-dev` | Duplicate of `anthropic.claude-code` |
| `rvest.vs-code-prettier-eslint` | Redundant (have prettier + eslint separately) |

---

## Kept (10 core extensions)

| Extension | Purpose | Used in project |
|-----------|---------|-----------------|
| `anthropic.claude-code` | AI assistant (this tool) | ✅ Core |
| `bradlc.vscode-tailwindcss` | Tailwind CSS intellisense | ✅ Styling |
| `christian-kohler.npm-intellisense` | npm package autocomplete | ✅ Dev |
| `dbaeumer.vscode-eslint` | ESLint linting | ✅ CI gate |
| `esbenp.prettier-vscode` | Code formatting | ✅ CI gate |
| `vitest.explorer` | Vitest test runner UI | ✅ Tests |
| `eamodio.gitlens` | Git history & blame | ✅ Dev |
| `mhutchie.git-graph` | Git visualization | ✅ Dev |
| `donjayamanne.githistory` | Git history explorer | ✅ Dev |
| `usernamehw.errorlens` | Inline error feedback | ✅ Dev |

---

## Impact

### Disk Space Freed
- ~8 extensions × ~50–200MB each = ~600–1600MB recovered
- (Actual size varies by extension; MSSQL suite tends to be heavy)

### Development Experience
- **Cleaner Extensions sidebar** (fewer irrelevant items)
- **Faster VSCode startup** (fewer extensions to load)
- **No functional impact** (all removed were non-essential for this project)

### CI Gates Unaffected
- ESLint, Prettier, Vitest: still installed ✅
- No breaking changes to build or test pipeline

---

## Verification

```bash
code --list-extensions | wc -l
# Before: 22 extensions
# After:  10 extensions (removed 12)
```

---

## Notes

- Some removed extensions had hard dependencies (e.g., SQL Database Projects depends on SQL Workspace). Removed in dependency order.
- VSCode remained open during removal (Claude Code runs inside it; no force-close).
- Cleanup is local development station optimization only — CI/CD unaffected.

---

## Future Considerations

- If adding Vue.js or C#/.NET work → reinstall `vue.volar` or `ms-dotnettools.*`
- If adding Azure/Kubernetes work → reinstall `ms-azuretools.*`
- Monitor for new extensions before installing — check relevance against this audit first.
