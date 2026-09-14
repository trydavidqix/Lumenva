# Revisão consolidada — Wave 12, Wave 5 e Wave 1 receipts

Data: 2026-09-13  
Escopo: revisão read-only nos worktrees do worker; testes focados executados independentemente.

## Telar — Wave 12 gate de publicação

- Worktree: `/home/claude/src/worktrees/wave12-marketing-content-2026-09-13`
- Estado observado: HEAD `09d688a6` (`test(wave12): prove publication service provenance gate`), contendo `ef20e79b` e `09d688a6` sobre o SHA anterior `d10235cc`.
- `publishContentItem` agora chama `assertPublishableContent` antes de consultar/agendar o item quando `input.provenance` está presente (`publication-service.ts:117-120`). O teste dedicado tenta publicar freshness `stale` e confirma que o job não é agendado.
- Testes executados: `content-os-publication-service.test.ts` 7/7, `content-provenance.test.ts` 4/4 e `content-os-publication-service-provenance.test.ts` 1/1. Total **12/12**, exit `0`.
- Gap residual: `provenance` permanece opcional no tipo/input. Uma chamada sem provenance bypassa o gate de freshness e segue para quality/consent/publication. Se provenance é requisito do contrato Wave 12, falta rejeitar ausência e teste explícito desse caso.
- Sem segredo hardcoded ou logging sensível identificado.

**Veredito: PASS-CONDICIONAL.** A correção fecha o caso stale fornecido ao serviço; tornar provenance obrigatório (ou provar que ausência é intencional e segura) é necessário para PASS definitivo.

## Fornalha — Wave 5 Command Center RLS

- Worktree: `/home/claude/src/worktrees/wave5-command-center-2026-09-12`
- SHA: `ca864c499c47a71af8f4674306f131b7acd8f53d` (`fix(wave5): enforce command center overview tenant RLS`).
- Migration `20260913150000_command_center_overview_rls.sql` cria chave primária `organization_id`, habilita RLS e aplica `USING`/`WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()))` para `FOR ALL`.
- `saveOverview` e `loadOverview` usam `organization_id` como chave/filtro e validam mismatch de tenant.
- Prova executada: `overview-state-persistence.integration.test.ts` falhou com `command_center_overviews_migration_required` (o teste inicia PostgreSQL descartável, mas não aplica a migration). O teste RLS falhou com `COMMAND_CENTER_DATABASE_URL_required`; não houve prova real com role sem BYPASSRLS. Outros testes de custos/approvals ficaram skipped por ausência de banco.
- Sem segredo hardcoded ou logging sensível identificado.

**Veredito: PASS-CONDICIONAL.** A policy SQL é tenant-scoped e fail-closed no desenho, mas RLS real e persistência não foram comprovados nesta execução. Aplicar migration no harness e fornecer banco descartável com role `authenticated`/sem BYPASSRLS é obrigatório para PASS.

## Vértice — Wave 1 receipts RLS

- Worktree: `/home/claude/src/worktrees/business-os-wave-1-operating-core-2026-09-11`
- Estado observado: HEAD `2583449e` (`feat(operating-core): persist tenant-scoped execution receipts`), migration `20260913140000_0165_operating_core_receipts.sql` presente. Não havia conexão Maestri do agente “Vértice” para consultar SHA adicional (`maestri list` mostrou apenas Claude; `maestri check Vértice` indisponível).
- Migration: `organization_id uuid NOT NULL` com FK para `organizations`; unicidade `(organization_id,idempotency_key)`; RLS habilitado; policy `FOR ALL TO authenticated` com `USING` e `WITH CHECK` via `fn_user_org_ids()`; grants explícitos para `authenticated` e `service_role`.
- Store filtra `get` por `(organization_id,id)` e usa `ON CONFLICT (organization_id,idempotency_key)` para idempotência.
- Testes: `receipt-store.test.ts` **4/4 passou**, exit `0`. `receipt-store.integration.test.ts` ficou **1 skipped** porque `OPERATING_CORE_TEST_DATABASE_URL` não estava configurada; portanto não houve prova PostgreSQL/RLS/concorrência nesta rodada.
- Sem segredo hardcoded ou logging sensível identificado.

**Veredito: PASS-CONDICIONAL.** O contrato e a policy são tenant-scoped, mas a prova real com role não-superuser/RLS e concorrência permanece não executada.

## Consolidado

- Wave 12: **PASS-CONDICIONAL** — ausência de provenance ainda pode bypassar o novo gate.
- Wave 5: **PASS-CONDICIONAL** — RLS desenhado corretamente, prova real bloqueada por migration/`COMMAND_CENTER_DATABASE_URL` ausentes.
- Wave 1 receipts: **PASS-CONDICIONAL** — unit verde; integração Postgres/RLS skipped por `OPERATING_CORE_TEST_DATABASE_URL` ausente.

<self-check>PASS — SHAs/HEADs, código, migrations e saídas reais foram verificados; ausência de prova não foi promovida a PASS.</self-check>
