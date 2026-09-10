---
source: operational-decision
date: 2026-09-10
type: decision
provenance: approved-now-tier
---

# Convenção de nomes V1

- Ficheiros Markdown: `kebab-case.md`; nomes descritivos e estáveis.
- Estado corrente: `Current-State.md`; loops: `Open-Loops.md`; formato: `memory-format.md`.
- Tipos e estados usam os identificadores definidos nos contratos, sem sinónimos.
- Datas em `YYYY-MM-DD`; SHA em minúsculas; comandos e chaves em backticks.
- Um documento tem uma fonte de verdade. Referências cruzadas usam caminho relativo e não duplicam dados do Postgres.
- Não criar suffixes `final`, `new`, `v2` ou `backup` para resolver conflito; versionar conteúdo no frontmatter/commit.
