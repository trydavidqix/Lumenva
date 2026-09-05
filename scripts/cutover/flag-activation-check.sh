#!/usr/bin/env bash
set -euo pipefail
flag="${1:-}"
case "$flag" in RGPD_STATE_MACHINE_V1|DPO_ASSESSMENT_V1|LEGAL_BASIS_V1|ERASURE_DECISION_V1|BREACH_WORKFLOW_V1|TRANSFER_GATE_V1|ECOMMERCE_PROVIDER_V1) ;; *) echo "uso: $0 FLAG" >&2; exit 2 ;; esac
current="${!flag-<não definido>}"
echo "flag=$flag current=$current (somente leitura)"
if [[ "$flag" == TRANSFER_GATE_V1 ]]; then
  echo "comando para ligar: export TRANSFER_GATE_V1=observe  # block só após aprovação"
  echo "comando para reverter: export TRANSFER_GATE_V1=off"
else
  echo "comando para ligar: export $flag=true"
  echo "comando para reverter: export $flag=false"
fi
case "$flag" in LEGAL_BASIS_V1) t=tests/unit/lgpd-legal-basis.test.ts ;; DPO_ASSESSMENT_V1) t=tests/unit/lgpd-dpo-assessment.test.ts ;; BREACH_WORKFLOW_V1) t=tests/unit/lgpd-breach.test.ts ;; RGPD_STATE_MACHINE_V1) t=tests/unit/lgpd-state-machine.test.ts ;; ECOMMERCE_PROVIDER_V1) t=tests/unit/ecommerce-provider-contract.test.ts ;; *) t= ;; esac
if [[ -n "$t" && -f "$t" ]]; then echo "validação local read-only: pnpm exec vitest run $t"; else echo "validação: consultar a ficha correspondente no runbook (read-only)"; fi
