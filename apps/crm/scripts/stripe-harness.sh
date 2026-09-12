#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/claude/.local/bin:${PATH:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="${STRIPE_CLI_BIN:-stripe}"
command -v "$CLI" >/dev/null || { echo "FAIL: Stripe CLI ausente no PATH."; exit 127; }
[[ -n "${STRIPE_API_KEY:-}" ]] || { echo "FAIL: STRIPE_API_KEY ausente; injete via Infisical."; exit 2; }
case "${1:-}" in
verify-catalog) p="$(mktemp)"; q="$(mktemp)"; trap 'rm -f "$p" "$q"' EXIT; "$CLI" products list --active true --type service --limit 100 --api-key "$STRIPE_API_KEY" --color off >"$p"; "$CLI" prices list --active true --type recurring --currency eur --limit 100 --api-key "$STRIPE_API_KEY" --color off >"$q"; (cd "$ROOT" && pnpm --dir apps/crm exec tsx scripts/stripe-harness.ts verify-catalog "$p" "$q") ;;
trigger-webhook) event="${2:-}"; case "$event" in checkout.session.completed|customer.subscription.created|customer.subscription.updated|invoice.paid|invoice.payment_failed) ;; *) echo "FAIL: fixture não permitido."; exit 2 ;; esac; "$CLI" trigger "$event" --api-key "$STRIPE_API_KEY" --color off ;;
smoke) "$0" verify-catalog; "$0" trigger-webhook checkout.session.completed ;;
*) echo "Uso: $0 {verify-catalog|trigger-webhook <event>|smoke}" >&2; exit 2 ;;
esac
