# Review consolidado V76 — Wave 16 PsycheOS e Wave 13 Hermes

Data: 2026-09-13  
Escopo: revisão independente, read-only, do estado atual das worktrees no worker.

## Wave 16 — PsycheOS affect/boundary

**Worktree/SHA:** `/home/claude/src/worktrees/psycheos-affect-ledger-2026-09-12` @ `b6e3128649227460ea5b0dbd869834fa4904d732`.

**Evidência executada:**

- Vitest focado: `affect-ledger.test.ts`, `boundary-eval.test.ts`, `psycheos-regression.test.ts`, `psycheos-systemic.test.ts` — **4 ficheiros, 20 testes PASS, 0 FAIL**, EXIT=0.
- O teste adversarial de boundary injeta uma função contaminada e observa `FAIL`; o gate sistémico agrega quatro casos e calcula `failedCases` antes de retornar `PASS`/`FAIL`.
- PostgreSQL descartável Docker com `PSY_AFFECT_DATABASE_URL`: `affect-ledger-pg.test.ts` — **2 testes PASS, 0 FAIL**, EXIT=0; confirmou restart, idempotência e triggers que rejeitam UPDATE/DELETE.

**Achado:** o store PostgreSQL de affect (`psyche_affect_events`) não contém `tenant_id`, não habilita RLS e não impõe isolamento por organização. O ledger persistente aceita apenas `agent_id/session_id/event_id`; portanto a prova real cobre durabilidade/append-only, mas não tenancy. A avaliação de boundary também é uma função local, não uma prova de todos os callers de autoridade.

**Veredito: PASS-CONDICIONAL.** Os gaps anteriores de rates sem cap, kind desconhecido e boundary tautológico estão fechados no SHA revisto. Continua bloqueada a promoção como peça multi-tenant até adicionar tenant/organization derivado de boundary confiável, RLS e teste cross-tenant com role não-superuser; também falta ligar o gate a callers reais.

## Wave 13 — Hermes Memory Gateway / Source Registry

**Worktree/SHA:** `/home/claude/src/worktrees/wave13-hermes-source-registry-2026-09-12` @ `79d6c958d9903ffb3d375bfaa235ee25e95c2bfa`.

**Evidência executada:** os próprios testes subiram e removeram containers PostgreSQL descartáveis:

- `postgres-memory-gateway.integration.test.ts` — **1 teste PASS**, incluindo persistência após novo pool, replay idempotente e rejeição de leitura/escrita cross-tenant e INSERT forjado com role `NOSUPERUSER NOBYPASSRLS`.
- `source-registry-rls.integration.test.ts` — **1 teste PASS**, role não-superuser autenticada e `fn_user_org_ids()` derivando organizações de `auth.uid`; sessão de tenant viu exatamente uma organização.
- Comando Vitest focado terminou **2 ficheiros, 2 testes PASS, 0 FAIL, EXIT=0**.

**Inspeção:** migration habilita RLS e `USING`/`WITH CHECK` em `hermes_memory_records` e `hermes_source_registry`; chaves compostas incluem organização. O gateway valida `organizationId` antes de ler/escrever e usa `ON CONFLICT DO NOTHING`.

**Veredito: PASS.** O critério de tenant/RLS/persistência desta entrega está provado localmente com PostgreSQL real e role sem bypass. Isto não é prova de produção/deploy nem de todos os callers externos.

## Conclusão

Wave 16 permanece **PASS-CONDICIONAL** por ausência de tenant/RLS no affect ledger. Wave 13 fica **PASS** no escopo específico de Memory Gateway e Source Registry.

## Self-check

PASS — código real lido no worker, SHAs registrados, testes executados independentemente com saída/EXIT observáveis, containers descartáveis encerrados, e nenhuma credencial real ou efeito de produção usado.
