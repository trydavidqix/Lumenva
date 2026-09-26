# Revisão consolidada — Wave 2 Registry e Wave 1 Receipts

Data: 2026-09-13  
Método: leitura read-only e testes independentes com PostgreSQL descartável.

## Telar — Wave 2 Agent Definition Registry

Worktree `/home/claude/src/worktrees/wave2-agent-birth-2026-09-12`, SHA `21dd099c` (inclui migration/RLS e prova idempotente). O teste `agent-definition-registry-pg.integration.test.ts` aplica a migration `0168`, cria roles `authenticated` `NOSUPERUSER NOBYPASSRLS`, associa usuário a tenant via `fn_user_org_ids()` e disputa dois registros concorrentes com chave composta.

Execução independente com PostgreSQL descartável: **1 arquivo, 1 teste passou, exit 0**. Cross-tenant e exatamente um vencedor foram confirmados; container removido.

**PASS.**

## Fornalha — Wave 1 receipts/evidence

Worktree `/home/claude/src/worktrees/business-os-wave-1-operating-core-2026-09-11`, SHA `2583449e`. Store usa `ON CONFLICT (organization_id, idempotency_key)` e `get` filtra tenant; payload/evidence são colunas explícitas/JSONB.

Teste `receipt-store.integration.test.ts` executado contra PostgreSQL descartável: **1 arquivo, 1 teste passou, exit 0**; 16 writes concorrentes coalesceram em um receipt. Nesta execução usei role administrativa para o harness; a prova específica com role não-superuser sujeita a RLS não foi reproduzida.

**PASS-CONDICIONAL** — idempotência/concorrência provadas, RLS real com role restrita pendente.

`maestri check Telar` e `maestri check Fornalha` retornaram `No connection`; SHAs foram confirmados diretamente nos worktrees.

SELF-CHECK: PASS — testes reais executados, limitações de role explicitadas e containers removidos.
