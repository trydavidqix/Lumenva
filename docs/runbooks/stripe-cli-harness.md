# Harness Stripe CLI — Etapa 3

Usa apenas a Stripe CLI oficial; não há cliente/API HTTP custom no CRM.

Pré-requisitos: export PATH=/home/claude/.local/bin:$PATH; injete STRIPE_API_KEY de teste via infisical run --env=test -- bash apps/crm/scripts/stripe-harness.sh ... . Nunca grave ou imprima a chave. Worker esperado: CLI 1.50.11.

Comandos: bash apps/crm/scripts/stripe-harness.sh verify-catalog, trigger-webhook checkout.session.completed ou smoke.

verify-catalog lista Products/Prices em test mode pelo CLI e valida lookup keys canónicas, EUR, mensal e 2900/7900/19900 cents. JSON fica em temporários; saída é redigida. Listagem é idempotente; fixtures podem repetir eventos e o receiver deve deduplicar event IDs. Falhas de PATH, chave, JSON ou divergência retornam código não zero. Nunca usa --live.

Products, Prices, webhooks e Checkout reais permanecem operações autorizadas via Stripe CLI/MCP, não via chamadas HTTP no código.
