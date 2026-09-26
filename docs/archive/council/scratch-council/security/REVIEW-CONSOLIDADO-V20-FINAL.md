# Re-revisão final — Delivery Receipt (Telar / Wave 10)

Data: 2026-09-13  
Método: revisão read-only do estado atual no worker; sem merge, deploy ou efeitos externos.

## Estado auditado

- Worktree: `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`
- HEAD: `21161bfc6e320fcf2fadf8faf3f6eab974c7c572` — `fix(wave10): serialize receipt creation`
- Worktree limpo.

## Correções confirmadas

- Reuso exige explicitamente `plan.status === "APPROVED" || "PACKAGED"` (`receipt.ts:42-44`), além da validação do artifact/evidence e estado persistido `SUCCEEDED` (`:46-50`). O teste de regressão para `DRAFT` cobre esse caminho (`product-factory-receipt-security.test.ts:24-27`).
- `withReceiptLock` serializa chamadas concorrentes para a mesma chave `(organization_id, receipt_id)` (`receipt.ts:18-28`). O teste usa `Promise.all` e confirma que ambas retornam o mesmo objeto (`product-factory-receipt-concurrency.test.ts:11-24`).
- Tenant na idempotência e deep-freeze dos arrays permanecem corretos e testados.

## Gap residual

**BLOCKED — exclusividade cross-tenant ainda não é atômica.** O lock é baseado em `key(plan.organization_id, receipt_id)` (`receipt.ts:37`), portanto dois tenants diferentes usam locks distintos. Em chamadas concorrentes com o mesmo `receipt_id`, ambos podem observar `receiptTenants` sem owner antes de qualquer `set` (`:38-40`), criar receipts em paralelo e gravar owners conflitantes. O teste cobre apenas reuso cross-tenant sequencial, não concorrente.

Além disso, a serialização é apenas um `Map` em memória; múltiplos processos/instâncias não compartilham o lock nem o mapa. Para garantia de idempotência em produção, é necessária constraint/insert atômico persistente ou lock distribuído com escopo global do ID, além de teste cross-tenant concorrente.

## Veredito

**BLOCKED — não fecha de vez.** As duas correções solicitadas (status no reuso e concorrência no mesmo tenant) estão implementadas e cobertas. Falta impedir colisão concorrente do mesmo ID entre tenants e substituir o estado/lock process-local por garantia compartilhada se houver mais de uma instância.

Não foram encontrados secrets hardcoded ou logging sensível.

SELF-CHECK: PASS — SHA, linhas, testes e risco residual documentados; revisão somente leitura.
