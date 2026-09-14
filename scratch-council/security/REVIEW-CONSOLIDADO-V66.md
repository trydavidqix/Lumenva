# Revisão consolidada V66 — Wave 14 Watchdog RLS/Manifesto

Data: 2026-09-13  
Escopo: revisão read-only do fechamento do watchdog persistido da Wave 14.

## Identidade

- Worktree: `/home/claude/src/worktrees/wave14-15-evals-autonomy-2026-09-12`
- SHA: `62d4a6814e78a47f0de2bdf6584dad7189cca492` (`docs(wave14): align watchdog migration manifest`)
- Histórico funcional imediato: `4bf44ec4` (persistência com tenant RLS), `48806832` (replay/ciclos concorrentes), `1ecd752b` (correção de colisão de versão de migration).
- Worktree sem alterações reportadas por `git status --short`.

## Código e migration

- `PostgresNoProgressWatchdog.observe` valida tenant, job e ciclo, abre transação, rejeita ciclo não monotônico e usa `FOR UPDATE` para obter o último estado.
- Replay do mesmo `(organization_id, job_id, cycle)` retorna o sinal persistido, sem duplicar observação.
- Conflito de inserção `23505` faz rollback e relê a linha vencedora; falhas diferentes propagam e fazem rollback.
- `20260913030100_0167_psyche_watchdog_observations.sql` define chave primária tenant/job/cycle, checks de ciclo/status, RLS com `fn_user_org_ids()`, `USING` e `WITH CHECK`, e grants restritos a `authenticated`.
- Não foram encontrados secrets hardcoded ou logging de dados sensíveis.

## Teste executado por mim

```text
apps/crm/lib/psycheos/postgres-no-progress-watchdog.integration.test.ts
```

O teste iniciou PostgreSQL 16 Docker descartável, criou role `watchdog_test` como `NOSUPERUSER NOBYPASSRLS`, aplicou a migration, verificou persistência após novo pool, replay, dois ciclos concorrentes e isolamento cross-tenant. O container foi removido no teardown.

Saída real:

```text
✓ apps/crm/lib/psycheos/postgres-no-progress-watchdog.integration.test.ts (1 test) 2947ms
Test Files 1 passed (1)
Tests 1 passed (1)
EXIT:0
```

## Veredito

**PASS — Wave 14 Watchdog RLS/Manifesto.**

O estado é durável, tenant-scoped e fail-closed para replay/conflito; a prova PostgreSQL real cobre restart, concorrência e tentativa cross-tenant. O commit final alinha o manifesto à migration funcional já testada.

SELF-CHECK: PASS
