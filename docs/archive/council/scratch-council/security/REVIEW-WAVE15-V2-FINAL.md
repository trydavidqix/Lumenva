# Re-revisão final — Budget Ledger Wave 15

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker do estado atual e do teste de concorrência. Não executei o teste, Docker, build ou migration.

## Estado revisado

Worktree: `/home/claude/src/worktrees/wave15-resource-router-2026-09-13`  
HEAD: `931ed0ef7c2f33dbfe93824705b613ed74bc06a6` — `test(runtime): wait for postgres before budget ledger`

Implementação: `apps/crm/lib/memory/budget-ledger.ts`  
Teste: `apps/crm/lib/memory/budget-ledger.integration.test.ts`  
Commit de implementação atômica: `33b3987d` (`fix(runtime): reserve budgets atomically in postgres`).

## O teste concorrente prova atomicidade?

O teste (`budget-ledger.integration.test.ts:47-58`) lança 10 débitos concorrentes de 15 com limite 100 e espera 6 aceitos, 4 recusados e `consumed = 90`. O SQL usa `ON CONFLICT ... DO UPDATE ... WHERE consumed + amount <= limit` (`budget-ledger.ts:51-58`), portanto a atualização concorrente de uma linha existente é serializada pelo Postgres.

**Não executei o teste:** a evidência disponível nesta revisão é o código e o caso declarado, não uma saída real de 10 processos/conexões.

## Fail-open encontrado

**BLOCKED — a primeira inserção não aplica o limite.**

Em `budget-ledger.ts:52-56`, o `INSERT` inicial aceita qualquer `amount` não negativo sem condição `amount <= limit`. O `WHERE` de limite está somente no ramo `DO UPDATE`. Um orçamento inexistente pode, portanto, ser criado com `amount` maior que o próprio limite e já começar acima do teto. O teste concorrente não cobre esse caminho; começa com débitos de 15 e limite 100.

Também não há validação de consistência da `limit` entre chamadas: o primeiro caller define o limite na inserção (`:52-54`), e chamadas seguintes usam `budget_ledger.limit`, ignorando `EXCLUDED.limit`. A política de quem pode criar/alterar o teto não é modelada.

## Isolamento e persistência

- A chave primária `(tenant_id, budget_id)` (`budget-ledger.ts:24-31`) separa linhas por tenant no SQL; o débito usa ambos como parâmetros (`:58`).
- Não há autenticação/authorization do actor nem garantia de que o chamador pode debitar aquele tenant/budget. Isso é boundary NOT_PROVEN.
- `ensureBudgetLedger` cria tabela em runtime sem schema qualificado (`:22-33`); em produção, a migration/ownership/RLS efetiva não é demonstrada por este commit.

## Secret hardcoded

O teste contém `POSTGRES_PASSWORD=postgres` e password `postgres` (`budget-ledger.integration.test.ts:18,30`). É credencial de fixture local, não segredo de produção, mas é um literal hardcoded que não deve ser reutilizado fora do container efêmero de teste.

## Veredito final

**BLOCKED — o ledger melhora a serialização de updates concorrentes, mas não fecha o gap de orçamento de vez.** A primeira inserção pode ultrapassar o limite; o teste 10→6/4 não cobre esse caso e não foi executado nesta revisão. Corrigir com condição de inserção (`amount <= limit`), política imutável/administrada para `limit`, e prova real com isolamento/actor/RLS.

SELF-CHECK: PASS — HEAD, implementação e teste confirmados; revisão read-only, sem execução de Docker/testes/build/migration e sem exposição de credenciais além do literal já presente no teste.
