# Revisão consolidada V73 — Wave 3 ToolLoopLock: prova e gap residual

Data: 2026-09-13  
Escopo: próximo gap `NOT_PROVEN` de maior risco fora do checkout Stripe: lock de execução distribuído da Wave 3.

## Identidade

- Worktree: `/home/claude/src/worktrees/wave3-session-runtime-skeleton-2026-09-12`
- SHA observado: `67448ad81cbb1de180a071baa4e0dcbe46a3d8bf`.
- A worktree tem alterações não commitadas em `dispatch-router.ts` e `dispatch-router.test.ts`; o lock revisado está no histórico `cf5d1913`/`6e9d9d53`.

## Teste real executado

Iniciei PostgreSQL 16 Docker descartável, exportei `SESSION_DATABASE_URL` e rodei:

```text
apps/crm/lib/agent-engine/session/postgres-tool-loop-lock.test.ts
```

Saída:

```text
✓ apps/crm/lib/agent-engine/session/postgres-tool-loop-lock.test.ts (1 test) 221ms
Test Files 1 passed (1)
Tests 1 passed (1)
EXIT:0
```

O teste comprovou, em PostgreSQL real, duas instâncias concorrentes disputando o mesmo lock: exatamente uma claim venceu, a outra foi rejeitada, e `iteration=1`, `version=1` foram persistidos.

## Falha de segurança encontrada

A migration `20260913010000_0164_hermes_tool_loop_locks.sql` define somente `lock_id`, `session_id`, `execution_epoch`, contadores e timestamps. Não existe `tenant_id`/`organization_id`, RLS, policy ou grant tenant-scoped. O store faz `UPDATE ... WHERE lock_id=$2`, portanto qualquer caller com acesso à tabela que conheça um `lock_id` pode disputar/ler lock de outra organização; não há vínculo de tenant no schema.

Além disso, o teste retorna silenciosamente quando `SESSION_DATABASE_URL` está ausente (`if (!url) return`), o que permite falso verde fora da execução que fiz.

## Veredito

**BLOCKED — Wave 3 ToolLoopLock.**

A atomicidade CAS está comprovada, mas o requisito de isolamento tenant e o gate fail-closed ainda não estão provados nem implementados na migration. Fechar exige adicionar tenant/organization ao schema e às predicates/policies RLS, validar o tenant no store, tornar o teste obrigatório e repetir concorrência com roles não-superuser em dois tenants.

SELF-CHECK: PASS
