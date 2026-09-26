# Revisão consolidada V74 — re-review Fiel Stripe checkout

Data: 2026-09-13  
Escopo: verificar se o endpoint realmente usa store PostgreSQL e se o teste de dois clientes prova replay distribuído.

## Identidade

- Worktree: `/home/claude/src/worktrees/bronze-stripe-checkout-security-fix-2026-09-13`
- SHA: `97fe8a485c8e126c67a9554d21b21d90c9707d91` (`test(billing): exercise persisted nonce at checkout endpoint`)
- Commit funcional anterior: `513da3d2` (`fix(billing): persist checkout nonce claims`).

## Código confirmado

- `route.ts` agora faz `await consumeCheckoutState(...)` e cria `createPostgresCheckoutStateStore(supabase)` no endpoint.
- Falha de claim/DB retorna `internal_error`; nonce inválido/replay retorna `403` antes de entitlement/Stripe.
- `stripe-browser-state.ts` usa insert idempotente em `idempotency_keys`, tratando `23505` como replay.

## Teste executado por mim

```text
apps/crm/app/api/v1/billing/checkout/route.test.ts
apps/crm/lib/billing/stripe-browser-state.test.ts
apps/crm/lib/billing/stripe-checkout.test.ts
```

Resultado real:

```text
Test Files 3 passed (3)
Tests 16 passed (16)
EXIT:0
```

## Limitação de evidência

O teste novo `enforces one-time nonce through two endpoint requests and independent pools` **não usa PostgreSQL nem dois pools reais**. Ele cria dois objetos `db()` mockados; ambos compartilham o `Set` de teste `claimedKeys`. Portanto prova apenas que o endpoint chama a abstração `from(...).insert(...)` e trata uma colisão simulada. Não prova RLS, constraint única real, persistência após restart ou concorrência entre processos.

## Veredito

**PASS-CONDICIONAL — endpoint Stripe checkout.**

O wiring e o `await` corrigem a falha anterior, e os 16 testes provider-free passam. Ainda falta prova independente com PostgreSQL real, dois clients/pools e tabela `idempotency_keys` com constraint tenant/endpoint/key; até essa execução, nonce distribuído permanece `NOT_PROVEN`.

SELF-CHECK: PASS
