# Revisão consolidada V72 — gap crítico escolhido: Stripe checkout nonce/replay

Data: 2026-09-13  
Escopo: prova independente do gap `NOT_PROVEN` de nonce único durável/distribuído no checkout Stripe.

## Base observada

- Worktree: `/home/claude/src/worktrees/bronze-stripe-checkout-security-fix-2026-09-13`
- HEAD: `07bf3c7dfbb517611a83c38ac6240e75274b651a` (`fix(billing): secure Bronze Stripe checkout flow`).
- Não houve novo commit nesta verificação.

## Evidência de teste

Executei os testes focados de rota e browser state:

```text
apps/crm/app/api/v1/billing/checkout/route.test.ts
apps/crm/lib/billing/stripe-browser-state.test.ts
```

Resultado real:

```text
Test Files 1 failed, 1 passed (2)
Tests 1 failed, 9 passed (10)
EXIT:1
```

Falha concreta em `route.test.ts:67`: a segunda submissão do mesmo `checkout_state` retornou `200`, embora o teste esperasse `403` por replay.

## Causa encontrada no código

`stripe-browser-state.ts` define `consumeCheckoutState` como `async` e retorna `Promise<boolean>`, usando `store.claim(...)` assíncrono. Porém `route.ts` chama:

```ts
if (!consumeCheckoutState(input.checkout_state, { ... })) {
  return fail("invalid_checkout_state", ...);
}
```

Sem `await`. O valor testado pelo `if` é uma Promise truthy, não o resultado booleano. Portanto a rota pode prosseguir sem aguardar o claim do nonce e sem bloquear replay; a falha observada é reproduzível executando o teste sozinho.

Além disso, a rota ainda exporta um `checkoutStateStore` baseado em `Set` local, enquanto a implementação nova define `CheckoutStateStore.claim`/`createPostgresCheckoutStateStore`. Não há wiring da store PostgreSQL no endpoint.

## Veredito

**BLOCKED — Stripe checkout nonce/replay.**

O gap escolhido não está apenas `NOT_PROVEN`: há regressão funcional demonstrada. Corrigir o `await`, ligar uma store persistente/atômica tenant-scoped ao endpoint e repetir os testes de rota mais uma prova entre dois processos/pools antes de promover a segurança do checkout.

SELF-CHECK: PASS
