# Revisão consolidada V64 — Wave 13 Memory Gateway, Wave 10 Delivery e pendência Wave 6

Data: 2026-09-13  
Escopo: confirmação independente dos dois fechamentos reportados e decisão sobre o teste concorrente pendente do client portal.

## Wave 13 — Memory Gateway (Vértice)

- Worktree: `/home/claude/src/worktrees/wave13-hermes-source-registry-2026-09-12`
- SHA: `79d6c958d9903ffb3d375bfaa235ee25e95c2bfa` (`feat(wave13): persist memory gateway with tenant RLS`)
- Testes executados por mim: `postgres-memory-gateway.integration.test.ts` e `source-registry-rls.integration.test.ts`.
- Cada teste iniciou PostgreSQL Docker descartável e fez teardown próprio.
- Resultado: **2 arquivos / 2 testes PASS**, exit `0`.
- A prova cobriu persistência e reconstrução após novo pool, deduplicação, leitura/escrita cross-tenant rejeitada e role sem `BYPASSRLS` sujeita às policies.

**Veredito: PASS — Wave 13 Memory Gateway.**

## Wave 10 — Delivery persistido (Telar)

- Worktree: `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`
- SHA observado: `e611be04c0e62a7429ab14160352c13f5570e38c` (`test(wave10): apply real build plan migration`). `maestri check Telar` não estava disponível; portanto não foi possível confirmar SHA posterior além do estado real da worktree.
- PostgreSQL 16 descartável iniciado por mim; migration `20260913000000_build_plan_state.sql` aplicada; `DELIVERY_DATABASE_URL` e `DELIVERY_RECEIPT_DATABASE_URL` apontaram para a instância.
- Testes executados: `product-factory-delivery-postgres.integration.test.ts` e `product-factory-receipt-postgres.test.ts`.
- Resultado real: **2 arquivos / 3 testes PASS**, exit `0`.
- A prova cobriu execução somente após gate persistido, estado `SUCCEEDED`, concorrência de receipts em pools separados com uma linha canônica e gate `BLOCKED` persistido que rejeita replay.
- Container removido no teardown.

**Veredito: PASS — Wave 10 Delivery.**

## Wave 6 — token single-use concorrente

O teste concorrente ainda não foi executado: falta `STUDIO_PORTAL_TEST_DATABASE_URL`. A ausência não é apenas administrativa; sem essa variável não há prova de disputa real entre processos/conexões para o token single-use. O fluxo continua no veredito anterior **PASS-CONDICIONAL**.

**Recomendação: sim, vale mandar alguém configurar a variável e rodar o teste.** Deve ser PostgreSQL Docker descartável, com duas conexões/processos concorrentes, exatamente um consumo vencedor, segunda tentativa rejeitada e estado `used_at` persistido. O teste deve falhar quando a variável estiver ausente, não retornar verde silenciosamente.

## Resumo

- Wave 13 Memory Gateway: **PASS**.
- Wave 10 Delivery: **PASS**.
- Wave 6 client portal: **PASS-CONDICIONAL**, aguardando prova concorrente com `STUDIO_PORTAL_TEST_DATABASE_URL`.
- A contagem histórica de Waves com pelo menos uma peça crítica em PASS real permanece **16/16**, desde o PASS independente da Wave 9 registrado no V63.

SELF-CHECK: PASS
