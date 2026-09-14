# Re-revisão — Delivery Receipt corrigido (Telar / Wave 10)

Data: 2026-09-13  
Método: revisão read-only do estado atual no worker; sem merge, deploy ou efeitos externos.

## Estado

- Worktree: `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`
- HEAD: `f80f06009452cc6015b9ae41029c0c9bd7740bfa` — `fix(wave10): scope and deep-freeze delivery receipts`
- Worktree limpo.

## Correções confirmadas

- A chave de armazenamento passou a ser `organization_id:receipt_id` (`receipt.ts:12-15,25-27`), e `receiptTenants` rejeita reutilização do mesmo ID por outro tenant (`:23-24`).
- Receipt existente exige actor, canal, plano/artifact compatíveis, validação dos dados e estado persistido `SUCCEEDED` (`:28-35`).
- `artifact_refs` e `evidence_refs` são cópias congeladas por `frozen()` (`:16,43-44`), eliminando a mutabilidade superficial anterior.
- O teste de segurança tenta mutar os arrays e tenta reutilizar o ID em outro tenant (`product-factory-receipt-security.test.ts:12-21`).

## Lacuna ainda aberta

**BLOCKED — revalidação do gate não é completa.** No caminho de receipt existente (`receipt.ts:28-35`), o código chama `validateDeliveryPlan`, mas não verifica novamente `plan.status === "APPROVED" || "PACKAGED"`; apenas exige que o estado persistido seja `SUCCEEDED`. Assim, um plano atualmente alterado para `DRAFT` pode devolver o receipt antigo se o estado persistido continuar `SUCCEEDED`. O caminho de criação nova usa `validateDeliveryPlanWithState`, que faz essa checagem (`delivery.ts:70-72`), mas o caminho idempotente corrigido não.

Também permanece uma condição de corrida em chamadas concorrentes com o mesmo `(tenant, receipt_id)`: o `Map` é consultado e preenchido após `await validateDeliveryPlanWithState`; duas chamadas podem passar simultaneamente e cada uma construir seu próprio objeto antes de `receipts.set`. Não há lock/Promise in-flight/constraint persistente demonstrado.

## Secrets

Não foram encontrados secrets hardcoded nem logging sensível no commit ou nos testes.

## Veredito final

**BLOCKED / não fecha de vez.** Tenant na idempotência e deep-freeze dos arrays estão corrigidos e testados. Ainda falta revalidar explicitamente o status `APPROVED`/`PACKAGED` no caminho de receipt existente e serializar criação concorrente do mesmo ID. Adicionar testes para receipt já existente com plano rebaixado a `DRAFT` e duas chamadas concorrentes antes de promover.

SELF-CHECK: PASS — SHA, trechos, testes, achados e limites documentados; revisão somente leitura.
