# Revisão consolidada — Wave 15 Resource Router e Wave 7 Evals/Variants

Data: 2026-09-13  
Método: leitura read-only e testes de integração com PostgreSQL descartável.

## Fornalha — Wave 15 Resource Router

Worktree `/home/claude/src/worktrees/wave15-resource-router-2026-09-13`, SHA `5d2acdea` (`fix(wave15): persist reroute idempotency`). Stores usam chaves compostas tenant/agent e tenant/task/reroute, `ON CONFLICT DO NOTHING` e consultas sempre filtradas por tenant. `routeResourcePersistedOnce` só devolve rota quando o claim de reroute vence.

Teste oficial criou PostgreSQL descartável e passou: **1 arquivo, 2 testes, exit 0** — reconstrução após pool novo e duas chamadas concorrentes com exatamente um claim.

**PASS.**

## Vértice — Wave 7 Studio Editor Evals/Variants

Commit `10b49c024025a03b469cb6bacfa9ac7ba5a997aa`; worktree atual HEAD `c15543b6` ainda contém `studio-editor-repository.ts` modificado e o teste de integração não commitado. `recordEditorEval` e `recordVariantMix` usam chaves compostas tenant/session/id e upsert idempotente; payload/evidence são JSONB e tenant é sempre coluna obrigatória.

Teste criou PostgreSQL descartável e executou dois escritores concorrentes para eval e variant mix: **1 arquivo, 1 teste, exit 0**; exatamente uma linha por chave. **PASS-CONDICIONAL** — a prova é do estado local sujo, não integralmente do SHA commitado.

## Veredito

- Wave 15 Resource Router: **PASS**.
- Wave 7 Evals/Variants: **PASS-CONDICIONAL** — commitar o repository/teste atual antes de promover.

SELF-CHECK: PASS — SHAs/status conferidos, concorrência PostgreSQL real executada e containers removidos pelos testes.
