# Revisão consolidada V75 — Wave 10 build_plan_state e Wave 3 ToolLoopLock

Data: 2026-09-13  
Escopo: re-review read-only das alegações de RLS/tenant isolation.

## Wave 10 — build_plan_state (Bigorna)

- Worktree: `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`
- SHA: `b3744b87443536b1282db8b313987878ee558572` (`fix(wave10): enforce tenant RLS on delivery state`).
- A migration adiciona RLS, mas a policy usa `tenant_id = current_setting('app.tenant_id', true)`.

Esse GUC pode ser definido pelo próprio caller da sessão; não é derivado de `auth.uid()`/`fn_user_org_ids()`. Assim, uma role autenticada pertencente a tenant B pode definir `SET app.tenant_id = 'tenant-a'` e satisfazer a policy para ler/escrever A. A policy falha fechado apenas quando o GUC está ausente, não contra falsificação do valor.

Os testes PostgreSQL de delivery executados anteriormente cobrem gate/estado, mas não exercitam essa policy com role não-superuser e GUC forjado. A prova cross-tenant alegada não está presente no código da worktree.

**Veredito Wave 10: BLOCKED.** Substituir o GUC arbitrário por identidade derivada de claims/membership (`fn_user_org_ids()`), adicionar teste com role B tentando `SET app.tenant_id='A'`, leitura e escrita, e só então reavaliar.

## Wave 3 — ToolLoopLock (Fornalha)

- Worktree: `/home/claude/src/worktrees/wave3-session-runtime-skeleton-2026-09-12`
- SHA: `059bbc8aa1ffd0b0bdb28342ba57fe142aee72b9` (`fix(session): scope ToolLoopLock by tenant with RLS`).
- Migration adiciona `tenant_id`, índice único `(tenant_id, lock_id)` e policy baseada em `fn_user_org_ids()`.

O teste atualizado `postgres-tool-loop-lock.test.ts` configura duas Pools com `options: '-c app.org_ids=...'`, mas não cria nem autentica `tenant_a_user`/`tenant_b_user`; o parâmetro `options` não estabelece membership/RLS por si só. Na execução independente com PostgreSQL real e migrations aplicadas, o teste falhou em `test:27`: a sessão B ainda enxergou `lock-cas` de A (`expected []`, recebeu `[{ lock_id: 'lock-cas' }]`).

O teste concorrente/CAS só passa quando executado contra tabela sem a nova RLS; com o schema tenant-scoped, a prova de isolamento falha.

**Veredito Wave 3: BLOCKED.** Corrigir a criação/configuração das roles e contexto de tenant no teste, garantir que o store sempre inclua tenant na consulta, e repetir a prova com dois usuários não-superuser realmente isolados.

## Resultado

As duas alegações de fechamento não passam a PASS: Wave 10 tem policy forjável por GUC; Wave 3 tem teste RLS reproduzivelmente falhando. Nenhum secret hardcoded foi observado.

SELF-CHECK: PASS
