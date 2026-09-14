# Revisão consolidada — Wave 10, Wave 13 e entrega Telar não identificada

Data: 2026-09-13  
Método: inspeção read-only e testes focados no worker.

## Fornalha — Wave 10 Delivery Gate

Worktree `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`, estado final observado `3f4c84d5` (`test(wave10): prove blocked gate in postgres`). O código mantém bloqueio antes de `execute()` quando o estado persistido é `BLOCKED`/`SUCCEEDED` ou quando o plano não está `APPROVED`/`PACKAGED`.

Teste unitário: **2 arquivos, 3 testes, exit 0**. Executei também o teste PostgreSQL com container descartável; ele falhou por incompatibilidade do schema mínimo do harness (a tabela criada manualmente não tinha o default de `id`, produzindo `null value in column "id"`), antes de testar a asserção. Assim, a prova real do commit de teste PostgreSQL não foi reproduzida neste harness.

**PASS-CONDICIONAL** — gate fail-closed confirmado no código/unitário; integração Postgres precisa ser repetida aplicando a migration/schema completo.

## Vértice — Wave 13 source registry + tenant isolation

Worktree `/home/claude/src/worktrees/wave13-hermes-source-registry-2026-09-12`, HEAD `ca6776f7`. `createPostgresSourceRegistry` valida URI/protocolo, inclui `organization_id` na chave e em todos os `INSERT ... ON CONFLICT (organization_id, source_id)` e `SELECT ... WHERE organization_id = $1`; o nome de tabela é validado contra identificador simples. A migration `0163_hermes_source_registry.sql` define unique composto e RLS por tenant.

Teste independente: `source-registry.test.ts` + `freshness-engine.test.ts`: **2 arquivos, 9 testes passaram, exit 0**. Não houve integração PostgreSQL/RLS real nesta execução.

**PASS-CONDICIONAL** — isolamento tenant está implementado e coberto por unit tests; RLS/concorrência contra banco real permanecem NOT_PROVEN.

## Telar — peça adicional com concorrência PostgreSQL

`maestri check Telar` retornou `No connection to 'Telar'`. A inspeção dos worktrees não identificou uma nova peça/commit atribuível a Telar além dos worktrees já auditados. **UNKNOWN / não revisado** até receber worktree e SHA exatos.

## Veredito

- Wave 10 Fornalha: **PASS-CONDICIONAL**.
- Wave 13 Vértice: **PASS-CONDICIONAL**.
- Peça Telar adicional: **BLOCKED/UNKNOWN** — worktree e commit não identificados.

SELF-CHECK: PASS — SHAs conferidos, falha de harness registrada sem mascaramento e containers descartáveis removidos.
