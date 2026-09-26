# Review consolidado V77 — Stripe Checkout: reserva idempotente PostgreSQL

Data: 2026-09-13  
Escopo: revisão independente read-only do commit Fiel.

## Entrega revisada

**Worktree:** `/home/claude/src/worktrees/bronze-stripe-checkout-security-fix-2026-09-13`  
**SHA:** `bc07b276d3c3d59896203a0b3a4888d708e79017` (`test(billing): mirror idempotency schema in postgres harness`).

Código lido:

- `apps/crm/app/api/v1/billing/checkout/route.ts`
- `apps/crm/lib/billing/stripe-browser-state.ts`
- `apps/crm/app/api/v1/billing/checkout/route.postgres.integration.test.ts`

O endpoint valida role/tenant e schema Zod strict antes de consumir o estado HMAC. `consumeCheckoutState` rejeita ausência de secret, payload inválido, assinatura inválida, organização/plano divergentes, nonce inválido e estado expirado/futuro. A reserva usa `idempotency_keys` com chave única `(organization_id, key, endpoint)`; `23505` retorna conflito sem criar segunda reserva. Falhas de banco são tratadas como erro, não como sucesso.

## Teste independente executado

Comando, a partir da raiz da worktree:

```text
node apps/crm/node_modules/vitest/vitest.mjs run --config apps/crm/vitest.config.ts apps/crm/app/api/v1/billing/checkout/route.postgres.integration.test.ts
```

O próprio teste subiu um container PostgreSQL 16 descartável, criou a tabela de idempotência com constraint única, executou duas requisições concorrentes usando dois clientes PostgreSQL independentes e removeu o container no teardown.

Saída observada:

```text
✓ route.postgres.integration.test.ts (1 test)
Test Files  1 passed (1)
Tests       1 passed (1)
EXIT=0
```

O teste verificou status `[200, 403]` e `SELECT count(*) ... = 1`; a segunda reserva foi rejeitada por conflito `23505`.

## Veredito

**PASS real (escopo da reserva single-use do checkout).** Não encontrei secret hardcoded: o segredo é lido de `STRIPE_CHECKOUT_STATE_SECRET` e a ausência falha fechando. A persistência e a corrida foram comprovadas em PostgreSQL real, não em `Map`/mock.

Limites: isto prova a reserva/idempotência do endpoint, não uma cobrança Stripe live, webhook, deploy ou RLS de produção. Esses continuam fora do escopo e `NOT_PROVEN`.

## Self-check

PASS — SHA e arquivos reais lidos, teste executado independentemente com PostgreSQL descartável, saída e EXIT registrados, container removido, sem side effect de produção.
