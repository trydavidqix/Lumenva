# F5 Customer360 integrity tests

Fonte: `/home/claude/plano-f5-f8.md:3-8`; `docs/stories/epics/EPIC-05-customer-360.md:681-783`; EPIC-09/10 RLS/audit DoD.

Escopo: testes provider-free de RLS tenant-safe, rollback transacional e atomicidade do contrato merge_queue já existente. Sem migrations, schema, credenciais, UI nova ou produção.

DoD: tenant cruzado não altera dados; falha intermédia restaura todas as mutações; payload primary/losers é validado e deduplicado; `test:fast`, typecheck, lint target, diff-check e worktree limpa; máximo 2 ciclos.
