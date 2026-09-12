---
type: current-state
project: Lumenva
status: maintained
last_updated: 2026-09-12
audited_against: f1/baseline-pnpm-2026-09-09 @ e020cd6f4f4a8958e8e30ab9ab29e53494565f9c
audit_worktree: f1/baseline-pnpm-2026-09-09
confidence: confirmada para Git, estrutura e gates locais; comportamento externo nao revalidado
---

# Estado atual - baseline F1

Monorepo Lumenva com apps/crm e apps/site.

## Gates

- EXIT_TYPECHECK=0
- EXIT_LINT_CHANNELS=0
- EXIT_LINT_TENANT=0
- EXIT_UNIT=0 em 823 ficheiros e 6652 testes.
- format=1686 ficheiros fora do formato; divida preexistente.
- harness=17 findings; divida preexistente.

Nao houve instalacao, download, push, deploy ou migracao. Publicacao, producao, integracoes externas, test:db, test:e2e e build permanecem nao provados nesta F1.

## Progresso comercial — 2026-09-12

- **Etapa 1 — fechada.** Entitlements e o gate central de módulos concluídos conforme o escopo comercial aprovado.
- **Etapa 2 — fechada.** Correções de produção/migrations concluídas conforme o escopo aprovado.
- **Etapa 3 — em andamento.** Integração Stripe em curso; o catálogo externo já tem produtos e preços criados.
- O frontend não é autoridade de pagamento: o estado final depende de webhook Stripe assinado e atualização server-side dos entitlements.
- A prioridade ativa permanece o primeiro cliente ponta a ponta; as restantes waves do Business OS ficam secundárias até esta etapa fechar.
