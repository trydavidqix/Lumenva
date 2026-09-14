# Review consolidado V82 — Wave 16 Affect RLS e Wave 15 Resource Router

Data: 2026-09-13

## Wave 16 — Prisma

**Worktree:** `/home/claude/src/worktrees/psycheos-affect-ledger-2026-09-12`  
**SHA atual:** `ea93b856cdbeec462c032d0f48dfc475d3bf05bc` (inclui `6e709582`).

Revisei `affect-ledger-pg.ts` e `affect-ledger-pg.test.ts`. O schema agora tem `organization_id` na chave primária, RLS e `WITH CHECK`; o ledger rejeita `organizationId` divergente e o teste cobre read cross-tenant, replay, restart e UPDATE/DELETE append-only.

**Falha real:** a policy usa `current_setting('app.organization_id', true)`, e o próprio cliente não confiável executa `set_config` para esse valor. Uma role `NOSUPERUSER NOBYPASSRLS` pode escolher outro tenant no GUC; isso não é identidade derivada de JWT/membership. A prova demonstra a mecânica da policy, mas não uma origem confiável.

**Veredito: PASS-CONDICIONAL.** Persistência e RLS existem; falta derivar tenant de contexto autenticado não-forjável e provar isso com role de aplicação.

## Wave 15 — Telar

**Worktree:** `/home/claude/src/worktrees/wave15-resource-router-2026-09-13`  
**SHA:** `64a22267c4de591a58987fd7a0b33e3f36234e2e`.

Executei os testes reais, que subiram/removeram PostgreSQL descartável:

```text
✓ resource-router-rls.integration.test.ts (1 test)
✓ resource-router-persistence.integration.test.ts (2 tests)
Test Files  2 passed (2)
Tests       3 passed (3)
EXIT=0
```

Os testes mostram org-b sem enumeração de workers de org-a e escrita cross-tenant rejeitada, além de persistência/idempotência. **Ressalva de segurança:** a função `fn_user_org_ids()` do harness deriva organizações de `current_setting('app.org_ids', true)`, valor que a própria role pode alterar com `SET`. Portanto a prova é válida para o mecanismo RLS local, mas não prova autenticação/origem confiável em produção.

**Veredito: PASS-CONDICIONAL.** O critério solicitado de isolamento Postgres passou; para PASS absoluto é necessário ligar `fn_user_org_ids()` a membership/JWT confiável e testar que o caller não pode forjar o tenant.

## Self-check

PASS — código e migrations atuais lidos, testes executados de verdade, e a diferença entre isolamento mecânico e identidade confiável foi preservada.
